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
    const job = cron.schedule('*/1 * * * *', async () => {
      try {
        await this.sendAppointmentReminders();
      } catch (error) {
        console.error('Error in appointment reminder job:', error);
      }
    });

    this.jobs.set('appointmentReminders', job);
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
    
    // Find all approved appointments (not completed, cancelled, or rejected)
    const appointments = await Appointment.find({
      status: { $in: ['approved', 'in_progress'] },
      paymentStatus: { $in: ['pending', 'completed'] } // Only if payment is not refunded
    }).populate('starId', 'name pseudo')
      .populate('fanId', 'name pseudo');

    let remindersSent = 0;

    for (const appointment of appointments) {
      try {
        // Parse appointment date and time to get scheduled start time
        const scheduledStartTime = this.parseAppointmentStartTime(appointment.date, appointment.time);
        
        // Calculate time until appointment
        const timeUntilAppointment = scheduledStartTime.getTime() - now.getTime();
        const minutesUntilAppointment = Math.floor(timeUntilAppointment / (1000 * 60));
        
        // Send reminder if appointment is between 9-11 minutes away (to avoid duplicates)
        // This ensures it's sent once when we're exactly 10 minutes away
        if (minutesUntilAppointment >= 9 && minutesUntilAppointment <= 11) {
          // Check if reminder was already sent (using a flag in appointment)
          if (appointment.reminderSent) {
            console.log(`[AppointmentReminder] Reminder already sent for appointment ${appointment._id}`);
            continue;
          }
          
          // Send reminder to both star and fan
          await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REMINDER', appointment, {
            currentUserId: null, // Send to both users
            minutesUntil: minutesUntilAppointment
          });
          
          // Mark reminder as sent to avoid duplicates
          appointment.reminderSent = true;
          appointment.reminderSentAt = new Date();
          await appointment.save();
          
          remindersSent++;
          console.log(`[AppointmentReminder] Reminder sent for appointment ${appointment._id} - ${minutesUntilAppointment} minutes until start`);
        }
      } catch (error) {
        console.error(`[AppointmentReminder] Error processing appointment ${appointment._id}:`, error);
      }
    }
    
    if (remindersSent > 0) {
      console.log(`[AppointmentReminder] Sent ${remindersSent} appointment reminders`);
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
