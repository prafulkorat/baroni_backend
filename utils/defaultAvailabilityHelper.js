import Availability from '../models/Availability.js';
import User from '../models/User.js';
import { convertLocalToUTC } from './timezoneHelper.js';

/**
 * Generate default weekly slots for a new Star
 * Creates 5 slots from 21:00 - 23:00 (each slot is 20 minutes) for next 7 days (1 week)
 * Slots: 21:00-21:20, 21:20-21:40, 21:40-22:00, 22:00-22:20, 22:20-22:40
 * @param {string|ObjectId} userId - User ID of the new star
 * @returns {Promise<void>}
 */
export const createDefaultDailySlots = async (userId) => {
    try {
        if (!userId) {
            console.error('[DefaultSlots] User ID is required');
            return;
        }

        // Verify user exists and is actually a star
        const user = await User.findById(userId).select('role country').lean();
        if (!user) {
            console.error(`[DefaultSlots] User not found: ${userId}`);
            return;
        }

        if (user.role !== 'star') {
            console.warn(`[DefaultSlots] User ${userId} is not a star (role: ${user.role}). Skipping default slots creation.`);
            return;
        }

        console.log(`[DefaultSlots] Creating default weekly slots for star ${userId}`);

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
                console.error(`[DefaultSlots] Error calculating UTC times for slot ${slotString}:`, error);
                return { utcStartTime: null, utcEndTime: null };
            }
        };

        // Generate 5 slots of 20 minutes each starting from 21:00
        const slotStrings = [
            '21:00 - 21:20',
            '21:20 - 21:40',
            '21:40 - 22:00',
            '22:00 - 22:20',
            '22:20 - 22:40'
        ];

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Create slots for next 7 days (today + 6 more days = 1 week)
        const datesToCreate = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            datesToCreate.push(formatLocalYMD(date));
        }

        console.log(`[DefaultSlots] Creating slots for ${datesToCreate.length} days: ${datesToCreate.join(', ')}`);

        let createdCount = 0;
        let updatedCount = 0;

        // Create availability for each date
        for (const dateStr of datesToCreate) {
            // Create slots with UTC times for this date
            const defaultSlots = slotStrings.map(slotString => {
                const { utcStartTime, utcEndTime } = calculateUTCTimes(slotString, dateStr, user.country || null);
                return {
                    slot: slotString,
                    status: 'available',
                    utcStartTime,
                    utcEndTime
                };
            });

            // Check if availability already exists for this date
            const existingAvailability = await Availability.findOne({
                userId: userId,
                date: dateStr
            });

            if (existingAvailability) {
                // If availability exists, merge slots (avoid duplicates)
                const existingSlotsMap = new Map();
                existingAvailability.timeSlots.forEach(slot => {
                    existingSlotsMap.set(slot.slot, slot);
                });

                let addedCount = 0;
                // Add default slots if they don't exist
                defaultSlots.forEach(defaultSlot => {
                    if (!existingSlotsMap.has(defaultSlot.slot)) {
                        existingAvailability.timeSlots.push(defaultSlot);
                        addedCount++;
                    }
                });

                // Set isWeekly flag (weekly mode)
                existingAvailability.isWeekly = true;
                existingAvailability.isDaily = false;
                await existingAvailability.save();
                updatedCount++;
                console.log(`[DefaultSlots] Updated existing availability for user ${userId} on ${dateStr}. Added ${addedCount} new slots.`);
            } else {
                // Create new availability with default slots
                await Availability.create({
                    userId: userId,
                    date: dateStr,
                    isWeekly: true,
                    isDaily: false,
                    timeSlots: defaultSlots
                });
                createdCount++;
                console.log(`[DefaultSlots] ✅ Created default availability for user ${userId} on ${dateStr} with ${defaultSlots.length} slots`);
            }
        }

        console.log(`[DefaultSlots] ✅ Completed: Created ${createdCount} new availabilities, updated ${updatedCount} existing availabilities for user ${userId}`);
    } catch (error) {
        console.error(`[DefaultSlots] ❌ Error creating default slots for user ${userId}:`, error);
        console.error(`[DefaultSlots] Error stack:`, error.stack);
        // Don't throw error to avoid breaking the star creation flow
    }
};

/**
 * Format date to YYYY-MM-DD format
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
const formatLocalYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

