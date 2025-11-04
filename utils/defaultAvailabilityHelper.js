import Availability from '../models/Availability.js';
import User from '../models/User.js';

/**
 * Generate default daily slots for a new Star
 * Creates 5 slots from 21:00 - 23:00 (each slot is 20 minutes)
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
        const user = await User.findById(userId).select('role');
        if (!user) {
            console.error(`[DefaultSlots] User not found: ${userId}`);
            return;
        }

        if (user.role !== 'star') {
            console.warn(`[DefaultSlots] User ${userId} is not a star (role: ${user.role}). Skipping default slots creation.`);
            return;
        }

        console.log(`[DefaultSlots] Creating default slots for star ${userId}`);

        // Generate 5 slots of 20 minutes each starting from 21:00
        const defaultSlots = [
            { slot: '21:00 - 21:20', status: 'available' },
            { slot: '21:20 - 21:40', status: 'available' },
            { slot: '21:40 - 22:00', status: 'available' },
            { slot: '22:00 - 22:20', status: 'available' },
            { slot: '22:20 - 22:40', status: 'available' }
        ];

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalYMD(today);

        // Check if availability already exists for today
        const existingAvailability = await Availability.findOne({
            userId: userId,
            date: todayStr
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

            // Set isDaily flag
            existingAvailability.isDaily = true;
            existingAvailability.isWeekly = false;
            await existingAvailability.save();
            console.log(`[DefaultSlots] Updated existing availability for user ${userId} on ${todayStr}. Added ${addedCount} new slots.`);
        } else {
            // Create new availability with default slots
            const createdAvailability = await Availability.create({
                userId: userId,
                date: todayStr,
                isDaily: true,
                isWeekly: false,
                timeSlots: defaultSlots
            });
            console.log(`[DefaultSlots] ✅ Created default availability for user ${userId} on ${todayStr} with ${defaultSlots.length} slots`);
            console.log(`[DefaultSlots] Availability ID: ${createdAvailability._id}`);
        }
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

