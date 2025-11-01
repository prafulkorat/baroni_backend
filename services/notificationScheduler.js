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
   */
  async sendAppointmentReminders() {
    const now = new Date();
    console.log(`[AppointmentReminder] ===== Starting reminder check at ${now.toISOString()} =====`);
    
    // Find all approved appointments (not completed, cancelled, or rejected)
    const appointments = await Appointment.find({
      status: { $in: ['approved', 'in_progress'] },
      paymentStatus: { $in: ['pending', 'completed'] }, // Only if payment is not refunded
      reminderSent: { $ne: true } // Only appointments that haven't received reminder yet
    }).populate('starId', 'name pseudo fcmToken apnsToken appNotification')
      .populate('fanId', 'name pseudo fcmToken apnsToken appNotification');

    console.log(`[AppointmentReminder] Found ${appointments.length} appointments to check`);

    let remindersSent = 0;
    let skippedAlreadySent = 0;
    let skippedOutOfRange = 0;
    let errors = 0;

    for (const appointment of appointments) {
      try {
        // Parse appointment date and time to get scheduled start time
        const scheduledStartTime = this.parseAppointmentStartTime(appointment.date, appointment.time);
        
        if (isNaN(scheduledStartTime.getTime())) {
          console.error(`[AppointmentReminder] Invalid date/time for appointment ${appointment._id}: date=${appointment.date}, time=${appointment.time}`);
          continue;
        }
        
        // Calculate time until appointment
        const timeUntilAppointment = scheduledStartTime.getTime() - now.getTime();
        const minutesUntilAppointment = Math.floor(timeUntilAppointment / (1000 * 60));
        const secondsUntilAppointment = Math.floor(timeUntilAppointment / 1000);
        
        console.log(`[AppointmentReminder] Appointment ${appointment._id}:`, {
          date: appointment.date,
          time: appointment.time,
          scheduledStartTime: scheduledStartTime.toISOString(),
          minutesUntil: minutesUntilAppointment,
          secondsUntil: secondsUntilAppointment,
          starId: appointment.starId?._id,
          fanId: appointment.fanId?._id,
          status: appointment.status,
          reminderSent: appointment.reminderSent
        });
        
        // Send reminder if appointment is between 9-11 minutes away (to avoid duplicates)
        // This ensures it's sent once when we're exactly 10 minutes away
        if (minutesUntilAppointment >= 9 && minutesUntilAppointment <= 11) {
          // Double-check reminder wasn't sent (race condition protection)
          const freshAppointment = await Appointment.findById(appointment._id);
          if (freshAppointment?.reminderSent) {
            skippedAlreadySent++;
            console.log(`[AppointmentReminder] Skipping appointment ${appointment._id} - reminder already sent`);
            continue;
          }
          
          console.log(`[AppointmentReminder] Sending reminder for appointment ${appointment._id} (${minutesUntilAppointment} minutes until start)`);
          
          try {
            // Send reminder to both star and fan
            await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REMINDER', appointment, {
              currentUserId: null, // Send to both users
              minutesUntil: minutesUntilAppointment
            });
            
            // Mark reminder as sent to avoid duplicates (atomic update)
            await Appointment.findByIdAndUpdate(appointment._id, {
              reminderSent: true,
              reminderSentAt: new Date()
            });
            
            remindersSent++;
            console.log(`[AppointmentReminder] ✓ Successfully sent reminder for appointment ${appointment._id}`);
            console.log(`[AppointmentReminder]   - Star: ${appointment.starId?.name || 'N/A'} (${appointment.starId?._id})`);
            console.log(`[AppointmentReminder]   - Fan: ${appointment.fanId?.name || 'N/A'} (${appointment.fanId?._id})`);
          } catch (notifyError) {
            errors++;
            console.error(`[AppointmentReminder] ✗ Failed to send reminder for appointment ${appointment._id}:`, notifyError);
          }
        } else {
          skippedOutOfRange++;
          if (minutesUntilAppointment > 0 && minutesUntilAppointment < 15) {
            // Log appointments that are close but not in range (for debugging)
            console.log(`[AppointmentReminder] Appointment ${appointment._id} is ${minutesUntilAppointment} minutes away (out of 9-11 range)`);
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
