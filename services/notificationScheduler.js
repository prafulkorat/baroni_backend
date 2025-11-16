import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import LiveShow from '../models/LiveShow.js';
import NotificationHelper from '../utils/notificationHelper.js';

class NotificationScheduler {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Initialize all scheduled jobs
   */
  init() {
    // Appointment reminders - run every 1 minute
    this.scheduleAppointmentReminders();
    
    // Live show reminders - run every 5 minutes
    this.scheduleLiveShowReminders();
    
    console.log('Notification scheduler initialized');
  }

  /**
   * Schedule appointment reminders
   */
  scheduleAppointmentReminders() {
    console.log('[AppointmentReminder] Scheduling appointment reminder cron job - runs every 1 minute');
    const job = cron.schedule('*/1 * * * *', async () => {
      try {
        console.log('[AppointmentReminder] Cron job triggered');
        await this.sendAppointmentReminders();
      } catch (error) {
        console.error('[AppointmentReminder] ✗ Error in appointment reminder cron job:', error);
        console.error('[AppointmentReminder] Error stack:', error.stack);
      }
    });

    this.jobs.set('appointmentReminders', job);
    console.log('[AppointmentReminder] ✓ Appointment reminder cron job scheduled successfully');
  }

  /**
   * Schedule live show reminders
   */
  scheduleLiveShowReminders() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.sendLiveShowReminders();
      } catch (error) {
        console.error('Error in live show reminder job:', error);
      }
    });

    this.jobs.set('liveShowReminders', job);
  }

  /**
   * Parse appointment date and time to get scheduled start time
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @param {string} timeStr - Time string in format like "09:30 AM" or "11:10 - 11:15"
   * @returns {Date} Parsed date object
   */
  parseAppointmentStartTime(dateStr, timeStr) {
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
  }

  /**
   * Send appointment reminders for appointments starting in 10 minutes
   * Sends to both star and fan
   * All times are in UTC to avoid timezone mismatches
   */
  async sendAppointmentReminders() {
    // Check if notification cron is enabled via environment variable
    const notificationCronEnabled = process.env.NOTIFICATION_CRON === 'true';
    
    if (!notificationCronEnabled) {
      console.log(`[AppointmentReminder] ⚠ Notification cron is disabled (NOTIFICATION_CRON=${process.env.NOTIFICATION_CRON || 'not set'}). Skipping appointment reminders.`);
      return;
    }
    
    // Get current UTC time
    const now = new Date();
    const nowUTC = new Date(now.toISOString());
    console.log(`[AppointmentReminder] ===== Starting reminder check at ${nowUTC.toISOString()} (UTC) =====`);
    
    // Find all approved appointments (not completed, cancelled, or rejected)
    // We need to check both: appointments without reminder AND appointments at exact time
    const appointments = await Appointment.find({
      status: { $in: ['approved', 'in_progress'] },
      paymentStatus: { $in: ['pending', 'completed'] } // Only if payment is not refunded
    }).populate('starId', 'name pseudo fcmToken apnsToken appNotification')
      .populate('fanId', 'name pseudo fcmToken apnsToken appNotification');

    console.log(`[AppointmentReminder] Found ${appointments.length} appointments to check`);

    let remindersSent = 0;
    let skippedAlreadySent = 0;
    let skippedOutOfRange = 0;
    let errors = 0;

    for (const appointment of appointments) {
      try {
        // Use UTC start time if available (preferred for new appointments)
        let scheduledStartTimeUTC;
        if (appointment.utcStartTime) {
          scheduledStartTimeUTC = new Date(appointment.utcStartTime);
          console.log(`[AppointmentReminder] Using UTC start time for appointment ${appointment._id}: ${scheduledStartTimeUTC.toISOString()}`);
        } else {
          // Fallback: parse from date and time (for backward compatibility with old appointments)
          // Note: This may not be accurate for cross-timezone scenarios
          scheduledStartTimeUTC = this.parseAppointmentStartTime(appointment.date, appointment.time);
          console.log(`[AppointmentReminder] Using parsed local time (fallback) for appointment ${appointment._id}: ${scheduledStartTimeUTC.toISOString()}`);
        }
        
        if (isNaN(scheduledStartTimeUTC.getTime())) {
          console.error(`[AppointmentReminder] Invalid date/time for appointment ${appointment._id}: date=${appointment.date}, time=${appointment.time}, utcStartTime=${appointment.utcStartTime}`);
          continue;
        }
        
        // Calculate time until appointment (both in UTC)
        // Positive value = future, Negative value = past
        const timeUntilAppointmentMs = scheduledStartTimeUTC.getTime() - nowUTC.getTime();
        const minutesUntilAppointment = Math.floor(timeUntilAppointmentMs / (1000 * 60));
        const secondsUntilAppointment = Math.floor(timeUntilAppointmentMs / 1000);
        
        console.log(`[AppointmentReminder] Appointment ${appointment._id}:`, {
          date: appointment.date,
          time: appointment.time,
          utcStartTime: appointment.utcStartTime ? new Date(appointment.utcStartTime).toISOString() : 'N/A',
          scheduledStartTimeUTC: scheduledStartTimeUTC.toISOString(),
          currentUTC: nowUTC.toISOString(),
          minutesUntil: minutesUntilAppointment,
          secondsUntil: secondsUntilAppointment,
          starId: appointment.starId?._id,
          fanId: appointment.fanId?._id,
          status: appointment.status,
          reminderSent: appointment.reminderSent
        });
        
        // Case 1: Send reminder 10 minutes before appointment (exactly 9-11 minutes window)
        // This ensures we catch the appointment in the 10-minute window
        // Case 2: Send notification at exact appointment time (at start time or after, but NOT 1 minute before)
        // IMPORTANT: Do NOT send notification 1 minute before - only send at start time (0) or after (negative = already started)
        // Changed condition to ensure we NEVER send when minutesUntilAppointment > 0 (i.e., before appointment time)
        const shouldSend10MinReminder = minutesUntilAppointment >= 9 && minutesUntilAppointment <= 11 && !appointment.reminderSent;
        // Only send when appointment has started (0 or negative minutes), NOT before (positive minutes)
        // This prevents sending notifications 1 minute before appointment
        const shouldSendStartNotification = minutesUntilAppointment <= 0 && minutesUntilAppointment >= -5; // At start time (0) or up to 5 minutes after, but NOT before
        
        if (shouldSend10MinReminder) {
          // 10-minute reminder before appointment (UTC-based)
          const freshAppointment = await Appointment.findById(appointment._id);
          if (freshAppointment?.reminderSent) {
            skippedAlreadySent++;
            console.log(`[AppointmentReminder] Skipping 10-min reminder for appointment ${appointment._id} - already sent`);
            continue;
          }
          
          console.log(`[AppointmentReminder] ✨ Sending 10-minute reminder (UTC-based) for appointment ${appointment._id}`);
          console.log(`[AppointmentReminder]   - Appointment UTC time: ${scheduledStartTimeUTC.toISOString()}`);
          console.log(`[AppointmentReminder]   - Current UTC time: ${nowUTC.toISOString()}`);
          console.log(`[AppointmentReminder]   - Minutes until appointment: ${minutesUntilAppointment}`);
          
          try {
            // Send reminder to both star and fan
            await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REMINDER', appointment, {
              currentUserId: null, // Send to both users
              minutesUntil: minutesUntilAppointment
            });
            
            // Mark reminder as sent to avoid duplicates (atomic update)
            // Store UTC time for tracking
            await Appointment.findByIdAndUpdate(appointment._id, {
              reminderSent: true,
              reminderSentAt: nowUTC
            });
            
            remindersSent++;
            console.log(`[AppointmentReminder] ✓ Successfully sent 10-min reminder (UTC) for appointment ${appointment._id}`);
            console.log(`[AppointmentReminder]   - Star: ${appointment.starId?.name || 'N/A'} (${appointment.starId?._id})`);
            console.log(`[AppointmentReminder]   - Fan: ${appointment.fanId?.name || 'N/A'} (${appointment.fanId?._id})`);
          } catch (notifyError) {
            errors++;
            console.error(`[AppointmentReminder] ✗ Failed to send 10-min reminder for appointment ${appointment._id}:`, notifyError);
          }
        } else if (shouldSendStartNotification) {
          // Appointment is starting NOW (within 0 to -5 minutes window) - UTC-based
          // IMPORTANT: Check if we already sent a start notification recently to prevent duplicates
          const freshAppointment = await Appointment.findById(appointment._id);
          
          // Check if a start notification was already sent within the last 6 minutes
          // This prevents duplicate notifications when cron runs every minute
          const startNotificationAlreadySent = freshAppointment?.reminderSentAt && 
            (nowUTC.getTime() - freshAppointment.reminderSentAt.getTime()) < (6 * 60 * 1000); // Within last 6 minutes
          
          if (startNotificationAlreadySent) {
            skippedAlreadySent++;
            const minutesSinceLastNotification = Math.floor((nowUTC.getTime() - freshAppointment.reminderSentAt.getTime()) / (60 * 1000));
            console.log(`[AppointmentReminder] ⚠ Skipping START notification for appointment ${appointment._id} - already sent ${minutesSinceLastNotification} minute(s) ago`);
            console.log(`[AppointmentReminder]   - Last notification sent at: ${freshAppointment.reminderSentAt?.toISOString()}`);
            console.log(`[AppointmentReminder]   - Current time: ${nowUTC.toISOString()}`);
            continue;
          }
          
          // Check if we sent a 10-minute reminder recently (6-15 minutes ago)
          // If yes, we might want to send start notification only to star (not fan) to avoid duplicate
          // But first check if we already sent a start notification (within last 6 min) - if yes, skip entirely
          const timeSinceLastNotification = freshAppointment?.reminderSentAt ? 
            (nowUTC.getTime() - freshAppointment.reminderSentAt.getTime()) : Infinity;
          const recent10MinReminder = timeSinceLastNotification >= (6 * 60 * 1000) && // More than 6 minutes ago
                                      timeSinceLastNotification < (15 * 60 * 1000); // But within last 15 minutes
          
          if (recent10MinReminder) {
            // A 10-min reminder was sent 6-15 minutes ago
            // Now we're at start time, so we should send start notification only to star (fan already got 10-min reminder)
            // But we need to check if we already sent start notification to star in a previous cron run
            // Since reminderSentAt was set 6-15 minutes ago, we know no start notification was sent yet
            console.log(`[AppointmentReminder] 10-min reminder was sent ${Math.floor(timeSinceLastNotification / (60 * 1000))} minutes ago`);
            console.log(`[AppointmentReminder] Sending START notification only to star (fan already got 10-min reminder)`);
            
            try {
              // Send start notification only to star (not fan) since fan already got reminder
              await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REMINDER', appointment, {
                currentUserId: appointment.fanId?._id || appointment.fanId, // Skip fan, only send to star
                minutesUntil: 0, // At start time
                isStartTime: true,
                isStartingNow: true,
                skipFan: true // Flag to skip fan notification
              });
              // Update reminder sent timestamp to prevent duplicate start notifications
              await Appointment.findByIdAndUpdate(appointment._id, {
                reminderSent: true,
                reminderSentAt: nowUTC
              });
              remindersSent++;
              console.log(`[AppointmentReminder] ✓ Sent START notification only to star (fan skipped - already notified)`);
            } catch (notifyError) {
              errors++;
              console.error(`[AppointmentReminder] ✗ Failed to send start notification to star:`, notifyError);
            }
            continue;
          }
          
          console.log(`[AppointmentReminder] ✨ Sending START notification (UTC-based) for appointment ${appointment._id}`);
          console.log(`[AppointmentReminder]   - Appointment UTC time: ${scheduledStartTimeUTC.toISOString()}`);
          console.log(`[AppointmentReminder]   - Current UTC time: ${nowUTC.toISOString()}`);
          console.log(`[AppointmentReminder]   - Minutes from now: ${minutesUntilAppointment} (appointment ${minutesUntilAppointment >= 0 ? 'starting' : 'started'})`);
          console.log(`[AppointmentReminder]   - No recent notification found, sending to both users`);
          
          try {
            // Send start notification to both star and fan (only if no recent notification was sent)
            await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REMINDER', appointment, {
              currentUserId: null, // Send to both users
              minutesUntil: 0, // At start time
              isStartTime: true,
              isStartingNow: true
            });
            
            // Update reminder sent timestamp to prevent duplicate notifications
            // This ensures we don't send another notification for the next 6 minutes
            await Appointment.findByIdAndUpdate(appointment._id, {
              reminderSent: true,
              reminderSentAt: nowUTC
            });
            
            remindersSent++;
            console.log(`[AppointmentReminder] ✓ Successfully sent START notification (UTC) for appointment ${appointment._id}`);
            console.log(`[AppointmentReminder]   - Star: ${appointment.starId?.name || 'N/A'} (${appointment.starId?._id})`);
            console.log(`[AppointmentReminder]   - Fan: ${appointment.fanId?.name || 'N/A'} (${appointment.fanId?._id})`);
          } catch (notifyError) {
            errors++;
            console.error(`[AppointmentReminder] ✗ Failed to send start notification for appointment ${appointment._id}:`, notifyError);
          }
        } else {
          skippedOutOfRange++;
          if (minutesUntilAppointment > 0 && minutesUntilAppointment < 15) {
            // Log appointments that are close but not in range (for debugging)
            console.log(`[AppointmentReminder] Appointment ${appointment._id} is ${minutesUntilAppointment} minutes away (not in 9-11 or ±1 minute range)`);
          } else if (minutesUntilAppointment >= -5 && minutesUntilAppointment <= 5) {
            // Log appointments that just passed or are about to start (for debugging)
            console.log(`[AppointmentReminder] Appointment ${appointment._id} is ${minutesUntilAppointment} minutes from now (recently started or starting soon)`);
          }
        }
      } catch (error) {
        errors++;
        console.error(`[AppointmentReminder] ✗ Error processing appointment ${appointment._id}:`, error);
        console.error(`[AppointmentReminder] Error stack:`, error.stack);
      }
    }
    
    console.log(`[AppointmentReminder] ===== Reminder check completed =====`);
    console.log(`[AppointmentReminder] Summary:`, {
      totalChecked: appointments.length,
      remindersSent,
      skippedAlreadySent,
      skippedOutOfRange,
      errors
    });
    
    if (remindersSent > 0) {
      console.log(`[AppointmentReminder] ✓ Successfully sent ${remindersSent} appointment reminders`);
    }
  }

  /**
   * Send live show reminders for shows starting within 30 minutes
   */
  async sendLiveShowReminders() {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const liveShows = await LiveShow.find({
      status: 'active',
      date: {
        $gte: now,
        $lte: thirtyMinutesFromNow
      }
    }).populate('starId', 'name pseudo');

    for (const liveShow of liveShows) {
      try {
        const timeUntilShow = liveShow.date.getTime() - now.getTime();
        const minutesUntilShow = Math.floor(timeUntilShow / (1000 * 60));

        if (minutesUntilShow <= 30 && minutesUntilShow > 0) {
          // Send live show starting notification
          await NotificationHelper.sendLiveShowNotification('LIVE_SHOW_STARTING', liveShow);
          
          console.log(`Live show reminder sent for show ${liveShow._id}`);
        }
      } catch (error) {
        console.error(`Error sending reminder for live show ${liveShow._id}:`, error);
      }
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        nextDate: job.nextDate()
      };
    }
    return status;
  }
}

export default new NotificationScheduler();
