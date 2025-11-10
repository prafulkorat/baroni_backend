import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js'; // Added import for Appointment
import User from '../models/User.js';
import { convertLocalToUTC } from '../utils/timezoneHelper.js';
import { cleanupWeeklyAvailabilities, deleteTimeSlotFromWeeklyAvailabilities, deleteTimeSlotByIdFromWeeklyAvailabilities } from '../services/weeklyAvailabilityService.js';
import { deleteTimeSlotFromDailyAvailabilities, deleteTimeSlotByIdFromDailyAvailabilities } from '../services/dailyAvailabilityService.js';

// Enhanced availability mode switching handler
const handleAvailabilityModeSwitching = async (userId, isWeekly, isDaily) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatLocalYMD(today);

    // Find all future availabilities for this user
    const futureAvailabilities = await Availability.find({
        userId: userId,
        date: { $gte: todayStr }
    });

    if (futureAvailabilities.length === 0) {
        return; // No existing availabilities, no cleanup needed
    }

    // Check for active appointments in all future availabilities
    const availabilityIds = futureAvailabilities.map(a => a._id);
    const activeAppointments = await Appointment.find({
        starId: userId,
        availabilityId: { $in: availabilityIds },
        status: { $in: ['pending', 'approved'] }
    });

    // Allow adding new slots even with active appointments
    // Only prevent mode switching if there are active appointments and user is trying to change mode
    if (activeAppointments.length > 0) {
        // Check if user is trying to switch modes (has existing availabilities with different mode)
        const hasExistingWeekly = futureAvailabilities.some(a => a.isWeekly);
        const hasExistingDaily = futureAvailabilities.some(a => a.isDaily);
        const hasExistingSpecific = futureAvailabilities.some(a => !a.isWeekly && !a.isDaily);
        
        // More lenient mode switching detection - only block if switching between weekly/daily modes
        const isTryingToSwitchMode = (isWeekly && hasExistingDaily) ||
                                   (isDaily && hasExistingWeekly);
        
        if (isTryingToSwitchMode) {
            const appointmentDetails = activeAppointments.map(apt => ({
                appointmentId: apt._id,
                date: apt.date,
                time: apt.time,
                status: apt.status
            }));

            throw new Error(`Cannot switch availability mode. You have ${activeAppointments.length} active appointment(s) scheduled. Please complete or cancel them first. Details: ${JSON.stringify(appointmentDetails)}`);
        }
        // If not switching modes, allow adding new slots
    }

    // Only proceed with cleanup if no active appointments and user is switching modes
    if (activeAppointments.length === 0) {
        if (isWeekly) {
            // Switching to weekly mode - cleanup daily and specific date availabilities
            await cleanupNonWeeklyAvailabilities(userId);
        } else if (isDaily) {
            // Switching to daily mode - cleanup weekly and specific date availabilities
            await cleanupWeeklyAvailabilities(userId);
            await cleanupSpecificDateAvailabilities(userId);
        } else {
            // Switching to specific date mode - cleanup weekly and daily availabilities
            await cleanupWeeklyAvailabilities(userId);
            await cleanupDailyAvailabilities(userId);
        }
    }
    // If there are active appointments, skip cleanup to preserve existing slots
};

// Cleanup non-weekly availabilities (daily and specific date)
const cleanupNonWeeklyAvailabilities = async (userId) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalYMD(today);

        const nonWeeklyAvailabilities = await Availability.find({
            userId: userId,
            date: { $gte: todayStr },
            $or: [
                { isWeekly: false },
                { isWeekly: { $exists: false } }
            ]
        });

        let removedCount = 0;
        for (const availability of nonWeeklyAvailabilities) {
            await availability.deleteOne();
            removedCount++;
        }

        console.log(`[AvailabilitySwitch] Cleaned up ${removedCount} non-weekly availabilities for user ${userId}`);
        return { removed: removedCount };
    } catch (error) {
        console.error('[AvailabilitySwitch] Error cleaning up non-weekly availabilities:', error);
        throw error;
    }
};

// Cleanup specific date availabilities (neither weekly nor daily)
const cleanupSpecificDateAvailabilities = async (userId) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalYMD(today);

        const specificDateAvailabilities = await Availability.find({
            userId: userId,
            date: { $gte: todayStr },
            isWeekly: false,
            isDaily: false
        });

        let removedCount = 0;
        for (const availability of specificDateAvailabilities) {
            await availability.deleteOne();
            removedCount++;
        }

        console.log(`[AvailabilitySwitch] Cleaned up ${removedCount} specific date availabilities for user ${userId}`);
        return { removed: removedCount };
    } catch (error) {
        console.error('[AvailabilitySwitch] Error cleaning up specific date availabilities:', error);
        throw error;
    }
};

// Cleanup daily availabilities
const cleanupDailyAvailabilities = async (userId) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalYMD(today);

        const dailyAvailabilities = await Availability.find({
            userId: userId,
            date: { $gte: todayStr },
            isDaily: true
        });

        let removedCount = 0;
        for (const availability of dailyAvailabilities) {
            await availability.deleteOne();
            removedCount++;
        }

        console.log(`[AvailabilitySwitch] Cleaned up ${removedCount} daily availabilities for user ${userId}`);
        return { removed: removedCount };
    } catch (error) {
        console.error('[AvailabilitySwitch] Error cleaning up daily availabilities:', error);
        throw error;
    }
};

const sanitize = (doc) => ({
    id: doc._id,
    userId: doc.userId,
    date: doc.date,
    isDaily: !!doc.isDaily,
    isWeekly: !!doc.isWeekly,
    timeSlots: Array.isArray(doc.timeSlots)
        ? doc.timeSlots.map((t) => ({ id: t._id, slot: t.slot, status: t.status }))
        : [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

const to24Hour = (time) => {
    if (typeof time !== 'string') throw new Error('Invalid time');
    const raw = time.trim();

    // Already 24-hour format
    const h24Match = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (h24Match) {
        const hh = parseInt(h24Match[1], 10);
        const mm = h24Match[2];
        if (parseInt(mm, 10) > 59) throw new Error('Minute must be 00-59');
        const hhStr = String(hh).padStart(2, '0');
        return `${hhStr}:${mm}`;
    }

    // AM/PM format (for backward compatibility)
    const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
        let hh = parseInt(ampmMatch[1], 10);
        const mm = ampmMatch[2];
        const suffix = ampmMatch[3].toUpperCase();
        if (hh < 1 || hh > 12) throw new Error('Hour must be 1-12');
        if (parseInt(mm, 10) > 59) throw new Error('Minute must be 00-59');

        // Convert to 24-hour format
        if (suffix === 'PM' && hh !== 12) hh += 12;
        if (suffix === 'AM' && hh === 12) hh = 0;

        const hhStr = String(hh).padStart(2, '0');
        return `${hhStr}:${mm}`;
    }

    throw new Error('Invalid time format. Expected HH:MM (24-hour) or HH:MM AM/PM');
};

const normalizeTimeSlotString = (slot) => {
    if (typeof slot !== 'string') throw new Error('Invalid time slot');
    const parts = slot.split('-');
    if (parts.length !== 2) throw new Error('Time slot must be in start-end format');
    const start = to24Hour(parts[0]);
    const end = to24Hour(parts[1]);
    return `${start} - ${end}`;
};

// Parse a YYYY-MM-DD string into a local Date at midnight (avoids UTC shift)
const parseLocalYMD = (ymd) => {
    const s = String(ymd || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error('Invalid date format; expected YYYY-MM-DD');
    const year = parseInt(m[1], 10);
    const monthIndex = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    return new Date(year, monthIndex, day);
};

// Format a Date into YYYY-MM-DD using local time
const formatLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const createAvailability = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }

        const isWeekly = Boolean(req.body.isWeekly);
        const isDaily = Boolean(req.body.isDaily);

        if (isWeekly && isDaily) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: Both isWeekly and isDaily cannot be true at the same time.'
            });
        }

        // Enhanced availability mode switching logic
        await handleAvailabilityModeSwitching(req.user._id, isWeekly, isDaily);

        // Get user's country for timezone conversion
        const user = await User.findById(req.user._id).select('country').lean();
        const userCountry = user?.country || null;

        // Helper function to calculate UTC times for a slot
        const calculateUTCTimes = (slotString, dateStr, country) => {
            try {
                const parts = slotString.split(' - ');
                if (parts.length !== 2) {
                    return { utcStartTime: null, utcEndTime: null };
                }

                const startTimeStr = parts[0].trim();
                const endTimeStr = parts[1].trim();

                // Convert start time to UTC
                const utcStartTime = convertLocalToUTC(dateStr, startTimeStr, country);
                
                // Convert end time to UTC
                const utcEndTime = convertLocalToUTC(dateStr, endTimeStr, country);

                return { utcStartTime, utcEndTime };
            } catch (error) {
                console.error(`[Availability] Error calculating UTC times for slot ${slotString}:`, error);
                return { utcStartTime: null, utcEndTime: null };
            }
        };

        // Helper function to normalize time slots with UTC times
        const normalizeTimeSlots = (timeSlots, dateStr) => {
            return Array.isArray(timeSlots)
                ? timeSlots.map((t) => {
                    if (typeof t === 'string') {
                        const slot = normalizeTimeSlotString(String(t));
                        const { utcStartTime, utcEndTime } = calculateUTCTimes(slot, dateStr, userCountry);
                        return { 
                            slot, 
                            status: 'available',
                            utcStartTime,
                            utcEndTime
                        };
                    }
                    if (t && typeof t === 'object') {
                        const slot = normalizeTimeSlotString(String(t.slot || ''));
                        const status = t.status === 'unavailable' ? 'unavailable' : 'available';
                        // Calculate UTC times if not already present
                        let utcStartTime = t.utcStartTime;
                        let utcEndTime = t.utcEndTime;
                        
                        if (!utcStartTime || !utcEndTime) {
                            const calculated = calculateUTCTimes(slot, dateStr, userCountry);
                            utcStartTime = calculated.utcStartTime || utcStartTime;
                            utcEndTime = calculated.utcEndTime || utcEndTime;
                        }
                        
                        return { 
                            slot, 
                            status,
                            utcStartTime,
                            utcEndTime
                        };
                    }
                    throw new Error('Invalid time slot entry');
                })
                : [];
        };

        // Helper function to validate time slots for today
        const validateTimeSlotsForToday = (timeSlots) => {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

            for (const timeSlot of timeSlots) {
                const slotString = typeof timeSlot === 'string' ? timeSlot : timeSlot.slot;
                const parts = slotString.split(' - ');
                if (parts.length === 2) {
                    const startTime = parts[0].trim();
                    const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
                    if (timeMatch) {
                        const hour = parseInt(timeMatch[1], 10);
                        const minute = parseInt(timeMatch[2], 10);

                        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                            const slotTime = hour * 60 + minute;
                            if (slotTime <= currentTime) {
                                return {
                                    isValid: false,
                                    message: `Cannot create availability for past time slots. Time slot "${slotString}" is in the past.`
                                };
                            }
                        }
                    }
                }
            }
            return { isValid: true };
        };

        // Helper function to upsert availability for a single date
        const upsertOne = async (isoDateStr, normalizedTimeSlots) => {
            const existingAvailability = await Availability.findOne({
                userId: req.user._id,
                date: String(isoDateStr).trim(),
            });

            if (existingAvailability) {
                // Check if there are any active appointments for this availability
                const activeAppointments = await Appointment.find({
                    starId: req.user._id,
                    availabilityId: existingAvailability._id,
                    status: { $in: ['pending', 'approved'] }
                });

                if (activeAppointments.length > 0) {
                    // Check if we're trying to add new slots that conflict with booked slots
                    const existingSlots = existingAvailability.timeSlots || [];
                    const newSlots = normalizedTimeSlots;
                    const existingSlotsMap = new Map();
                    existingSlots.forEach((slot) => {
                        existingSlotsMap.set(slot.slot, slot);
                    });

                    // Get all booked time slots from active appointments
                    const bookedSlots = new Set();
                    activeAppointments.forEach(apt => {
                        bookedSlots.add(apt.time);
                    });

                    // Check if any new slots conflict with booked slots
                    const conflictingSlots = newSlots.filter(newSlot => {
                        // Check if this new slot conflicts with any booked slot
                        return bookedSlots.has(newSlot.slot);
                    });
                    
                    if (conflictingSlots.length > 0) {
                        const appointmentDetails = activeAppointments.map(apt => ({
                            appointmentId: apt._id,
                            date: apt.date,
                            time: apt.time,
                            status: apt.status,
                            fanId: apt.fanId
                        }));

                        throw new Error(`Cannot add time slots that are already booked. The following slots are already taken: ${conflictingSlots.map(s => s.slot).join(', ')}. Please choose different time slots. Details: ${JSON.stringify(appointmentDetails)}`);
                    }
                }

                // Merge existing slots with new slots - preserve all existing slots
                const existingSlots = existingAvailability.timeSlots || [];
                const newSlots = normalizedTimeSlots;
                const existingSlotsMap = new Map();
                
                // Create a map of existing slots by slot string for quick lookup
                existingSlots.forEach((slot) => {
                    existingSlotsMap.set(slot.slot, slot);
                });
                
                // Merge new slots with existing slots - don't delete existing slots
                newSlots.forEach((newSlot) => {
                    if (existingSlotsMap.has(newSlot.slot)) {
                        // Slot already exists - only update status if different
                        const existingSlot = existingSlotsMap.get(newSlot.slot);
                        if (existingSlot.status !== newSlot.status) {
                            existingSlot.status = newSlot.status;
                        }
                    } else {
                        // New slot - add it to existing slots
                        existingSlots.push(newSlot);
                    }
                });
                
                // Preserve all existing slots - don't replace, just merge
                existingAvailability.timeSlots = existingSlots;
                
                // Update mode flags without affecting existing slots
                if (isWeekly) {
                    existingAvailability.isWeekly = true;
                    existingAvailability.isDaily = false;
                }
                if (isDaily) {
                    existingAvailability.isDaily = true;
                    existingAvailability.isWeekly = false;
                }
                
                const saved = await existingAvailability.save();
                console.log(`[Availability] Merged slots for date ${isoDateStr}: ${existingSlots.length} total slots (${newSlots.length} new slots added)`);
                return { action: 'updated', doc: saved };
            }

            const created = await Availability.create({
                userId: req.user._id,
                date: String(isoDateStr).trim(),
                isWeekly: isWeekly && !isDaily,
                isDaily: isDaily,
                timeSlots: normalizedTimeSlots,
            });
            return { action: 'created', doc: created };
        };

        // Helper function to process a single date
        const processSingleDate = async (date, timeSlots) => {
            // Validate that the date is not in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of today
            const inputDate = parseLocalYMD(date);

            if (inputDate < today) {
                throw new Error(`Cannot create availability for past date: ${date}`);
            }

            // If the date is today, validate that time slots are not in the past
            const isToday = inputDate.getTime() === today.getTime();
            if (isToday) {
                const validation = validateTimeSlotsForToday(timeSlots);
                if (!validation.isValid) {
                    throw new Error(validation.message);
                }
            }

            // Normalize time slots
            let normalized;
            try {
                normalized = normalizeTimeSlots(timeSlots, date);
            } catch (e) {
                throw new Error('Invalid timeSlots: provide strings or { slot, status } with valid formats');
            }

            return { date: inputDate, normalized };
        };

        // Check if it's multiple dates format
        if (req.body.dates && Array.isArray(req.body.dates)) {
            // Multiple dates format
            const results = [];
            const errors = [];

            for (const dateObj of req.body.dates) {
                try {
                    const { date, normalized } = await processSingleDate(dateObj.date, dateObj.timeSlots);

                    if (!isWeekly && !isDaily) {
                        // Single date processing
                        const { action, doc } = await upsertOne(String(dateObj.date).trim(), normalized);
                        results.push({
                            date: dateObj.date,
                            action,
                            data: sanitize(doc)
                        });
                    } else if (isWeekly) {
                        // Weekly processing for this date
                        const dates = [];
                        const start = parseLocalYMD(dateObj.date);
                        for (let i = 0; i < 6; i++) {
                            const d = new Date(start);
                            d.setDate(start.getDate() + i * 7);
                            const iso = formatLocalYMD(d);
                            dates.push(iso);
                        }

                        const weeklyResults = [];
                        for (const d of dates) {
                            const r = await upsertOne(d, normalized);
                            weeklyResults.push(sanitize(r.doc));
                        }
                        results.push({
                            date: dateObj.date,
                            action: 'weekly',
                            data: weeklyResults
                        });
                    } else if (isDaily) {
                        // Daily processing for this date: create this date + next 6 consecutive days (7 total)
                        const dates = [];
                        const start = parseLocalYMD(dateObj.date);
                        for (let i = 0; i < 7; i++) {
                            const d = new Date(start);
                            d.setDate(start.getDate() + i);
                            const iso = formatLocalYMD(d);
                            dates.push(iso);
                        }

                        const dailyResults = [];
                        for (const d of dates) {
                            const r = await upsertOne(d, normalized);
                            dailyResults.push(sanitize(r.doc));
                        }
                        results.push({
                            date: dateObj.date,
                            action: 'daily',
                            data: dailyResults
                        });
                    }
                } catch (error) {
                    errors.push({
                        date: dateObj.date,
                        error: error.message
                    });
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Some dates failed to process',
                    errors,
                    results
                });
            }

            const statusCode = results.some(r => r.action === 'created') ? 201 : 200;
            const message = results.length === 1
                ? (results[0].action === 'created' ? 'Availability created successfully' : 'Availability updated successfully')
                : 'Multiple availabilities processed successfully';

            return res.status(statusCode).json({
                success: true,
                data: results,
                message
            });
        } else {
            // Single date format (backward compatibility)
            const { date, timeSlots } = req.body;

            const { date: inputDate, normalized } = await processSingleDate(date, timeSlots);

            if (!isWeekly && !isDaily) {
                const { action, doc } = await upsertOne(String(date).trim(), normalized);
                const statusCode = action === 'created' ? 201 : 200;
                const message = action === 'created' ? 'Availability created successfully' : 'Availability updated successfully';
                return res.status(statusCode).json({ 
                    success: true, 
                    data: [sanitize(doc)], 
                    message 
                });
            }

            if (isWeekly) {
                // isWeekly: create for the given date and next 5 same weekdays (6 total)
                const dates = [];
                const start = parseLocalYMD(date);
                for (let i = 0; i < 6; i++) {
                    const d = new Date(start);
                    d.setDate(start.getDate() + i * 7);
                    const iso = formatLocalYMD(d);
                    dates.push(iso);
                }

                const results = [];
                for (const d of dates) {
                    // All generated dates are >= start, which we've already validated is not in the past
                    const r = await upsertOne(d, normalized);
                    results.push(sanitize(r.doc));
                }
                return res.status(201).json({ success: true, data: results, message: 'Weekly availabilities created/updated successfully' });
            }

            if (isDaily) {
                // isDaily: create for the given date and next 6 days (7 total)
                const dates = [];
                const start = parseLocalYMD(date);
                for (let i = 0; i < 7; i++) {
                    const d = new Date(start);
                    d.setDate(start.getDate() + i);
                    const iso = formatLocalYMD(d);
                    dates.push(iso);
                }

                const results = [];
                for (const d of dates) {
                    const r = await upsertOne(d, normalized);
                    results.push(sanitize(r.doc));
                }
                return res.status(201).json({ success: true, data: results, message: 'Daily availabilities created/updated successfully' });
            }
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const listMyAvailabilities = async (req, res) => {
    try {
        // Filter out past availabilities
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        const todayStr = formatLocalYMD(today); // Availability.date is stored as YYYY-MM-DD string

        const items = await Availability.find({
            userId: req.user._id,
            date: { $gte: todayStr } // Compare strings in YYYY-MM-DD format
        }).sort({ date: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Availabilities retrieved successfully',
            data: items.map(item => sanitize(item))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAvailability = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }
        const item = await Availability.findOne({ _id: req.params.id, userId: req.user._id });
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({
            success: true,
            message: 'Availability retrieved successfully',
            data: [sanitize(item)]
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const updateAvailability = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }
        const { date, timeSlots, status, isWeekly, isDaily } = req.body;
        const item = await Availability.findOne({ _id: req.params.id, userId: req.user._id });
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        // Get user's country for timezone conversion
        const user = await User.findById(req.user._id).select('country').lean();
        const userCountry = user?.country || null;

        // Helper function to calculate UTC times for a slot
        const calculateUTCTimes = (slotString, dateStr, country) => {
            try {
                const parts = slotString.split(' - ');
                if (parts.length !== 2) {
                    return { utcStartTime: null, utcEndTime: null };
                }

                const startTimeStr = parts[0].trim();
                const endTimeStr = parts[1].trim();

                // Convert start time to UTC
                const utcStartTime = convertLocalToUTC(dateStr, startTimeStr, country);
                
                // Convert end time to UTC
                const utcEndTime = convertLocalToUTC(dateStr, endTimeStr, country);

                return { utcStartTime, utcEndTime };
            } catch (error) {
                console.error(`[Availability] Error calculating UTC times for slot ${slotString}:`, error);
                return { utcStartTime: null, utcEndTime: null };
            }
        };

        // Handle mode switching in update
        if (req.body.hasOwnProperty('isWeekly') || req.body.hasOwnProperty('isDaily')) {
            const newIsWeekly = Boolean(isWeekly);
            const newIsDaily = Boolean(isDaily);


            try {
                await handleAvailabilityModeSwitching(req.user._id, newIsWeekly, newIsDaily);

                // Update the current item's mode flags
                if (req.body.hasOwnProperty('isWeekly')) {
                    item.isWeekly = newIsWeekly;
                    if (newIsWeekly) {
                        item.isDaily = false;
                    }
                }

                if (req.body.hasOwnProperty('isDaily')) {
                    item.isDaily = newIsDaily;
                    if (newIsDaily) {
                        item.isWeekly = false;
                    }
                }
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        // Validate date if provided
        if (date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const inputDate = new Date(date);

            if (inputDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot update availability to past dates'
                });
            }
            item.date = String(date).trim();
        }
        if (Array.isArray(timeSlots)) {
            try {
                // Check if there are any active appointments for this availability
                const activeAppointments = await Appointment.find({
                    starId: req.user._id,
                    availabilityId: item._id,
                    status: { $in: ['pending', 'approved'] }
                });

                if (activeAppointments.length > 0) {
                    // Check if we're trying to add new slots that conflict with booked slots
                    const existingSlots = item.timeSlots || [];
                    const newSlots = timeSlots;
                    const existingSlotsMap = new Map();
                    existingSlots.forEach((slot) => {
                        existingSlotsMap.set(slot.slot, slot);
                    });

                    // Get all booked time slots from active appointments
                    const bookedSlots = new Set();
                    activeAppointments.forEach(apt => {
                        bookedSlots.add(apt.time);
                    });

                    // Check if any new slots conflict with booked slots
                    const conflictingSlots = [];
                    newSlots.forEach(newSlot => {
                        const slotString = typeof newSlot === 'string' ? newSlot : newSlot.slot;
                        const normalizedSlot = normalizeTimeSlotString(slotString);
                        
                        // Check if this is a new slot (not existing) and conflicts with booked slots
                        if (!existingSlotsMap.has(normalizedSlot) && bookedSlots.has(normalizedSlot)) {
                            conflictingSlots.push(normalizedSlot);
                        }
                    });
                    
                    if (conflictingSlots.length > 0) {
                        const appointmentDetails = activeAppointments.map(apt => ({
                            appointmentId: apt._id,
                            date: apt.date,
                            time: apt.time,
                            status: apt.status,
                            fanId: apt.fanId
                        }));

                        return res.status(400).json({
                            success: false,
                            message: `Cannot add time slots that are already booked. The following slots are already taken: ${conflictingSlots.join(', ')}. Please choose different time slots.`,
                            data: { appointmentDetails }
                        });
                    }
                }

                // If updating time slots for today, validate they're not in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const itemDate = new Date(item.date);
                const isToday = itemDate.getTime() === today.getTime();

                if (isToday) {
                    const now = new Date();
                    const currentTime = now.getHours() * 60 + now.getMinutes();

                    for (const timeSlot of timeSlots) {
                        const slotString = typeof timeSlot === 'string' ? timeSlot : timeSlot.slot;
                        const parts = slotString.split(' - ');
                        if (parts.length === 2) {
                            const startTime = parts[0].trim();

                            // Only check the start time, not the end time
                            const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
                            if (timeMatch) {
                                const hour = parseInt(timeMatch[1], 10);
                                const minute = parseInt(timeMatch[2], 10);

                                if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                                    const slotTime = hour * 60 + minute;
                                    if (slotTime <= currentTime) {
                                        return res.status(400).json({
                                            success: false,
                                            message: `Cannot update availability with past time slots. Time slot "${slotString}" is in the past.`
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                item.timeSlots = timeSlots.map((t) => {
                    if (typeof t === 'string') {
                        const slot = normalizeTimeSlotString(String(t));
                        const dateStr = item.date || date;
                        const { utcStartTime, utcEndTime } = calculateUTCTimes(slot, dateStr, userCountry);
                        return { 
                            slot, 
                            status: 'available',
                            utcStartTime,
                            utcEndTime
                        };
                    }
                    if (t && typeof t === 'object') {
                        const slot = normalizeTimeSlotString(String(t.slot || ''));
                        const s = t.status === 'unavailable' ? 'unavailable' : 'available';
                        // Calculate UTC times if not already present
                        let utcStartTime = t.utcStartTime;
                        let utcEndTime = t.utcEndTime;
                        
                        if (!utcStartTime || !utcEndTime) {
                            const dateStr = item.date || date;
                            const calculated = calculateUTCTimes(slot, dateStr, userCountry);
                            utcStartTime = calculated.utcStartTime || utcStartTime;
                            utcEndTime = calculated.utcEndTime || utcEndTime;
                        }
                        
                        return { 
                            slot, 
                            status: s,
                            utcStartTime,
                            utcEndTime
                        };
                    }
                    throw new Error('Invalid time slot entry');
                });
            } catch (e) {
                return res.status(400).json({ success: false, message: 'Invalid timeSlots: provide strings or { slot, status } with valid formats' });
            }
        }
        const updated = await item.save();
        return res.json({
            success: true,
            message: 'Availability updated successfully',
            data: [sanitize(updated)]
        });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Availability for this date already exists' });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const deleteAvailability = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }
        const deleted = await Availability.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({
            success: true,
            message: 'Availability deleted successfully'
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const deleteTimeSlotByDate = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }

        const date = String(req.body.date || '').trim();
        let slotToDelete;
        try {
            slotToDelete = normalizeTimeSlotString(String(req.body.slot || ''));
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid slot format' });
        }

        const availability = await Availability.findOne({ userId: req.user._id, date });
        if (!availability) return res.status(404).json({ success: false, message: 'Availability for this date not found' });

        // Find the specific time slot to check its status
        const timeSlot = availability.timeSlots.find((t) => t.slot === slotToDelete);
        if (!timeSlot) {
            return res.status(404).json({ success: false, message: 'Time slot not found' });
        }

        // Check if the time slot is booked (unavailable status)
        if (timeSlot.status === 'unavailable') {
            // Check if there are any pending or approved appointments for this slot
            const appointment = await Appointment.findOne({
                starId: req.user._id,
                availabilityId: availability._id,
                timeSlotId: timeSlot._id,
                status: { $in: ['pending', 'approved'] }
            });

            if (appointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete this time slot. It has an active appointment. Please complete or reject the appointment first.',
                    data: {
                        appointmentId: appointment._id,
                        appointmentStatus: appointment.status,
                        fanId: appointment.fanId
                    }
                });
            }
        }

        // If this is a weekly availability, delete the time slot from all weekly availabilities
        if (availability.isWeekly) {
            try {
                const weeklyResult = await deleteTimeSlotFromWeeklyAvailabilities(req.user._id, slotToDelete);
                return res.json({
                    success: true,
                    message: `Time slot deleted from ${weeklyResult.processed} weekly availabilities (${weeklyResult.updated} updated, ${weeklyResult.removed} removed)`,
                    data: { weeklyResult }
                });
            } catch (error) {
                console.error('Error deleting from weekly availabilities:', error);
                return res.status(500).json({ success: false, message: 'Error deleting from weekly availabilities' });
            }
        }

        // If this is a daily availability OR client requests cascading daily deletion, delete across all daily availabilities
        const cascadeDaily = availability.isDaily || Boolean(req.body.isDaily);
        if (cascadeDaily) {
            try {
                const dailyResult = await deleteTimeSlotFromDailyAvailabilities(req.user._id, slotToDelete);
                return res.json({
                    success: true,
                    message: `Time slot deleted from ${dailyResult.processed} daily availabilities (${dailyResult.updated} updated, ${dailyResult.removed} removed)`,
                    data: { dailyResult }
                });
            } catch (error) {
                console.error('Error deleting from daily availabilities:', error);
                return res.status(500).json({ success: false, message: 'Error deleting from daily availabilities' });
            }
        }

        // Handle non-weekly availability
        const beforeCount = availability.timeSlots.length;
        const remaining = (availability.timeSlots || []).filter((t) => t.slot !== slotToDelete);

        if (remaining.length === beforeCount) {
            return res.status(404).json({ success: false, message: 'Time slot not found' });
        }

        if (remaining.length === 0) {
            await availability.deleteOne();
            return res.json({
                success: true,
                message: 'Time slot deleted and availability removed (no remaining slots)'
            });
        }

        availability.timeSlots = remaining;
        const saved = await availability.save();
        return res.json({
            success: true,
            message: 'Time slot deleted successfully',
            data: {
                availability: sanitize(saved)
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const deleteTimeSlotById = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessage = getFirstValidationError(errors);
            return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
        }

        const availabilityId = req.params.id;
        const slotId = req.params.slotId;

        const availability = await Availability.findOne({ _id: availabilityId, userId: req.user._id });
        if (!availability) return res.status(404).json({ success: false, message: 'Availability not found' });

        // Find the specific time slot to check its status
        const timeSlot = availability.timeSlots.find((t) => String(t._id) === String(slotId));
        if (!timeSlot) {
            return res.status(404).json({ success: false, message: 'Time slot not found' });
        }

        // Check if the time slot is booked (unavailable status)
        if (timeSlot.status === 'unavailable') {
            // Check if there are any pending or approved appointments for this slot
            const appointment = await Appointment.findOne({
                starId: req.user._id,
                availabilityId: availability._id,
                timeSlotId: timeSlot._id,
                status: { $in: ['pending', 'approved'] }
            });

            if (appointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete this time slot. It has an active appointment. Please complete or reject the appointment first.',
                    data: {
                        appointmentId: appointment._id,
                        appointmentStatus: appointment.status,
                        fanId: appointment.fanId
                    }
                });
            }
        }

        // If this is a weekly availability, delete the time slot from all weekly availabilities
        if (availability.isWeekly) {
            try {
                const weeklyResult = await deleteTimeSlotByIdFromWeeklyAvailabilities(req.user._id, slotId);
                return res.json({
                    success: true,
                    message: `Time slot deleted from ${weeklyResult.processed} weekly availabilities (${weeklyResult.updated} updated, ${weeklyResult.removed} removed)`,
                    data: { weeklyResult }
                });
            } catch (error) {
                console.error('Error deleting from weekly availabilities:', error);
                return res.status(500).json({ success: false, message: 'Error deleting from weekly availabilities' });
            }
        }

        // If this is a daily availability OR client requests cascading daily deletion via query, delete across all daily availabilities
        const cascadeDaily = availability.isDaily || String(req.query.isDaily || '').toLowerCase() === 'true';
        if (cascadeDaily) {
            try {
                const dailyResult = await deleteTimeSlotByIdFromDailyAvailabilities(req.user._id, slotId);
                return res.json({
                    success: true,
                    message: `Time slot deleted from ${dailyResult.processed} daily availabilities (${dailyResult.updated} updated, ${dailyResult.removed} removed)`,
                    data: { dailyResult }
                });
            } catch (error) {
                console.error('Error deleting from daily availabilities:', error);
                return res.status(500).json({ success: false, message: 'Error deleting from daily availabilities' });
            }
        }

        // Handle non-weekly availability
        const beforeCount = availability.timeSlots.length;
        availability.timeSlots = (availability.timeSlots || []).filter((t) => String(t._id) !== String(slotId));

        if (availability.timeSlots.length === beforeCount) {
            return res.status(404).json({ success: false, message: 'Time slot not found' });
        }

        if (availability.timeSlots.length === 0) {
            await availability.deleteOne();
            return res.json({
                success: true,
                data: {
                    message: 'Time slot deleted and availability removed (no remaining slots)'
                }
            });
        }

        const saved = await availability.save();
        return res.json({
            success: true,
            data: {
                message: 'Time slot deleted successfully',
                availability: sanitize(saved)
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};


