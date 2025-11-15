import cron from 'node-cron';
import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js';
import Transaction from '../models/Transaction.js';

/**
 * Process locked slots - check payment status and unlock/book accordingly
 * Runs every 1 minute to check for locked slots
 */
const SLOT_LOCK_TIMEOUT_MINUTES = 10; // Timeout for locked slots - unlock after 10 minutes if payment not completed

export const processLockedSlots = async () => {
  try {
    console.log('[SlotLockScheduler] Starting locked slots check...');
    
    // Find all availabilities with locked slots
    const availabilities = await Availability.find({
      'timeSlots.status': 'locked',
      'timeSlots.paymentReferenceId': { $exists: true, $ne: null }
    });

    let unlockedCount = 0;
    let bookedCount = 0;
    let errorCount = 0;

    for (const availability of availabilities) {
      for (const slot of availability.timeSlots) {
        if (slot.status === 'locked' && slot.paymentReferenceId) {
          try {
            // Check if payment was completed by finding transaction
            const transaction = await Transaction.findOne({
              externalPaymentId: slot.paymentReferenceId,
              status: 'completed'
            });

            if (transaction) {
              // Payment completed - find the appointment and mark slot as unavailable (booked)
              const appointment = await Appointment.findOne({
                transactionId: transaction._id,
                availabilityId: availability._id,
                timeSlotId: slot._id
              });

              if (appointment) {
                // Mark slot as unavailable (booked) - ensure it's updated even if already unavailable
                const updateResult = await Availability.updateOne(
                  { 
                    _id: availability._id, 
                    'timeSlots._id': slot._id,
                    'timeSlots.status': { $in: ['locked', 'available'] } // Only update if locked or available
                  },
                  { 
                    $set: { 
                      'timeSlots.$.status': 'unavailable',
                      'timeSlots.$.paymentReferenceId': null,
                      'timeSlots.$.lockedAt': null
                    } 
                  }
                );
                
                if (updateResult.matchedCount > 0 && updateResult.modifiedCount > 0) {
                  bookedCount++;
                  console.log(`[SlotLockScheduler] ✓ Slot marked as unavailable - appointment ${appointment._id}, payment ${slot.paymentReferenceId}, updateResult:`, updateResult);
                } else if (updateResult.matchedCount > 0) {
                  console.log(`[SlotLockScheduler] Slot already unavailable for appointment ${appointment._id}`);
                } else {
                  console.warn(`[SlotLockScheduler] No slot matched for appointment ${appointment._id} - slot may already be unavailable`);
                }
              } else {
                console.warn(`[SlotLockScheduler] No appointment found for transaction ${transaction._id}, slot ${slot._id}`);
              }
            } else {
              // Check if payment timeout (more than SLOT_LOCK_TIMEOUT_MINUTES since locked)
              const lockedAt = slot.lockedAt ? new Date(slot.lockedAt) : null;
              if (lockedAt) {
                const now = new Date();
                const minutesSinceLocked = (now.getTime() - lockedAt.getTime()) / (1000 * 60);
                
                // If locked for more than SLOT_LOCK_TIMEOUT_MINUTES and payment not completed, unlock
                if (minutesSinceLocked > SLOT_LOCK_TIMEOUT_MINUTES) {
                  // Check if transaction exists but not completed
                  const pendingTransaction = await Transaction.findOne({
                    externalPaymentId: slot.paymentReferenceId
                  });

                  if (!pendingTransaction || pendingTransaction.status !== 'completed') {
                    // Unlock the slot
                    await Availability.updateOne(
                      { _id: availability._id, 'timeSlots._id': slot._id },
                      { 
                        $set: { 
                          'timeSlots.$.status': 'available',
                          'timeSlots.$.paymentReferenceId': null,
                          'timeSlots.$.lockedAt': null
                        } 
                      }
                    );
                    unlockedCount++;
                    console.log(`[SlotLockScheduler] Slot unlocked due to timeout (${SLOT_LOCK_TIMEOUT_MINUTES} min) - payment ${slot.paymentReferenceId}, locked for ${minutesSinceLocked.toFixed(2)} minutes`);
                  }
                }
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`[SlotLockScheduler] Error processing locked slot ${slot._id}:`, error);
          }
        }
      }
    }

    console.log(`[SlotLockScheduler] Check completed - Booked: ${bookedCount}, Unlocked: ${unlockedCount}, Errors: ${errorCount}`);
    
    return {
      success: true,
      bookedCount,
      unlockedCount,
      errorCount
    };
  } catch (error) {
    console.error('[SlotLockScheduler] Error in processLockedSlots:', error);
    throw error;
  }
};

/**
 * Start the slot lock scheduler
 * Runs every 1 minute to check for locked slots
 */
export const startSlotLockScheduler = () => {
  // Run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      await processLockedSlots();
    } catch (error) {
      console.error('[SlotLockScheduler] Error in scheduled check:', error);
    }
  });

  console.log('[SlotLockScheduler] Slot lock scheduler started - checking every 1 minute');
};

/**
 * Stop the slot lock scheduler
 */
export const stopSlotLockScheduler = () => {
  // Note: node-cron doesn't provide easy way to stop individual jobs
  // This is a placeholder for future implementation
  console.log('[SlotLockScheduler] Slot lock scheduler stop requested');
};

