import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import { moveEscrowToJackpot } from './starWalletService.js';
import NotificationHelper from '../utils/notificationHelper.js';
import { deleteConversationBetweenUsers } from './messagingCleanup.js';

/**
 * Parse appointment date and time to get scheduled start time
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in format like "09:30 AM" or "11:10 - 11:15"
 * @returns {Date} Parsed date object
 */
const parseAppointmentStartTime = (dateStr, timeStr) => {
  const [year, month, day] = (dateStr || '').split('-').map((v) => parseInt(v, 10));
  let hours = 0;
  let minutes = 0;
  
  if (typeof timeStr === 'string') {
    // Handle format like "09:30 - 09:50" or "09:30 AM"
    const timePart = timeStr.split('-')[0].trim(); // Get first part if range
    const m = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      hours = parseInt(m[1], 10);
      minutes = parseInt(m[2], 10);
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  }
  
  return new Date(year || 0, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
};

/**
 * Process appointments that should be completed or rescheduled
 * 1. If duration >= 300 seconds OR 5 minutes passed since scheduled time with any duration -> mark completed
 * 2. If 5 minutes passed since scheduled time with NO duration -> mark rescheduled
 * @returns {Promise<Object>} Processing result
 */
export const processCompletedAppointments = async () => {
  try {
    const COMPLETE_DURATION_SECONDS = 300; // 5 minutes
    const RESCHEDULE_TIMEOUT_MINUTES = 5; // 5 minutes after scheduled time
    
    const now = new Date();
    const rescheduleThreshold = new Date(now.getTime() - (RESCHEDULE_TIMEOUT_MINUTES * 60 * 1000));
    
    // Find appointments that are approved or in_progress
    const appointments = await Appointment.find({
      status: { $in: ['approved', 'in_progress'] },
      paymentStatus: { $in: ['pending', 'completed'] } // Only process if payment is not refunded
    }).lean();

    console.log(`[AppointmentCompletionScheduler] Checking ${appointments.length} appointments`);

    let completedCount = 0;
    let rescheduledCount = 0;
    let errorCount = 0;

    for (const appt of appointments) {
      try {
        const scheduledStartTime = parseAppointmentStartTime(appt.date, appt.time);
        const timeSinceScheduled = now.getTime() - scheduledStartTime.getTime();
        const minutesSinceScheduled = timeSinceScheduled / (60 * 1000);
        
        const hasDuration = appt.callDuration && appt.callDuration > 0;
        const durationReached = appt.callDuration >= COMPLETE_DURATION_SECONDS;
        const timePassedWithDuration = minutesSinceScheduled >= RESCHEDULE_TIMEOUT_MINUTES && hasDuration;
        
        // Case 1: Mark as completed if:
        // - Duration reached 300 seconds, OR
        // - 5+ minutes passed since scheduled time AND has some duration (even minimal)
        if (durationReached || timePassedWithDuration) {
          const appointment = await Appointment.findById(appt._id);
          if (!appointment) continue;
          
          // Move escrow to jackpot for the star
          try {
            await moveEscrowToJackpot(appointment.starId, appointment._id, null);
            console.log(`[AppointmentCompletionScheduler] Moved escrow to jackpot for star ${appointment.starId}, appointment ${appointment._id}`);
          } catch (walletError) {
            console.error(`[AppointmentCompletionScheduler] Failed to move escrow to jackpot for appointment ${appointment._id}:`, walletError);
          }

          // Update appointment status
          appointment.status = 'completed';
          appointment.paymentStatus = 'completed';
          appointment.completedAt = new Date();
          await appointment.save();

          // Send completion notification
          try {
            await NotificationHelper.sendAppointmentNotification('APPOINTMENT_COMPLETED', appointment, { 
              currentUserId: appointment.fanId 
            });
            console.log(`[AppointmentCompletionScheduler] Sent completion notification for appointment ${appointment._id}`);
          } catch (notificationError) {
            console.error(`[AppointmentCompletionScheduler] Error sending completion notification:`, notificationError);
          }

          // Cleanup messages between fan and star after completion
          try {
            await deleteConversationBetweenUsers(appointment.fanId, appointment.starId);
          } catch (_e) {}

          completedCount++;
          console.log(`[AppointmentCompletionScheduler] Completed appointment ${appointment._id} - Duration: ${appointment.callDuration}s, Time since scheduled: ${minutesSinceScheduled.toFixed(2)} min`);
        }
        // Case 2: Mark as rescheduled if 5+ minutes passed with NO duration
        else if (minutesSinceScheduled >= RESCHEDULE_TIMEOUT_MINUTES && !hasDuration) {
          const appointment = await Appointment.findById(appt._id);
          if (!appointment) continue;
          
          appointment.status = 'rescheduled';
          await appointment.save();
          
          rescheduledCount++;
          console.log(`[AppointmentCompletionScheduler] Marked appointment ${appointment._id} as rescheduled - No duration recorded, ${minutesSinceScheduled.toFixed(2)} min since scheduled`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[AppointmentCompletionScheduler] Error processing appointment ${appt._id}:`, error);
      }
    }

    return {
      success: true,
      message: `Processed: ${completedCount} completed, ${rescheduledCount} rescheduled, ${errorCount} errors`,
      completedCount,
      rescheduledCount,
      errorCount
    };
  } catch (error) {
    console.error('[AppointmentCompletionScheduler] Error in processCompletedAppointments:', error);
    throw error;
  }
};

/**
 * Start the appointment completion scheduler
 * Runs every 1 minute to check for appointments ready to be marked as completed
 */
export const startAppointmentCompletionScheduler = () => {
  // Run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      console.log('[AppointmentCompletionScheduler] Running appointment completion check...');
      const result = await processCompletedAppointments();
      console.log('[AppointmentCompletionScheduler] Completion check completed:', result);
    } catch (error) {
      console.error('[AppointmentCompletionScheduler] Error in scheduled check:', error);
    }
  });

  console.log('[AppointmentCompletionScheduler] Appointment completion scheduler started - checking every 1 minute');
};

/**
 * Stop the appointment completion scheduler
 */
export const stopAppointmentCompletionScheduler = () => {
  cron.getTasks().forEach(task => {
    if (task.name === 'appointment-completion-check') {
      task.stop();
    }
  });
  console.log('[AppointmentCompletionScheduler] Appointment completion scheduler stopped');
};

