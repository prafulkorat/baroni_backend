/**
 * Timezone helper utility
 * Converts local time to UTC based on country timezone
 */

// Country to timezone offset mapping (in hours)
const COUNTRY_TIMEZONES = {
  'India': 5.5,  // IST (UTC+5:30)
  'Mali': 0,     // GMT (UTC+0)
};

/**
 * Get timezone offset for a country
 * @param {string} country - Country name
 * @returns {number} Timezone offset in hours (e.g., 5.5 for IST)
 */
export const getCountryTimezoneOffset = (country) => {
  if (!country) {
    // Default to UTC if no country specified
    return 0;
  }
  return COUNTRY_TIMEZONES[country] ?? 0;
};

/**
 * Convert local date and time to UTC Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format (local time)
 * @param {string} timeStr - Time string in format like "09:30 AM" or "11:10 - 11:15" (local time)
 * @param {string} country - Country name (e.g., 'India', 'Mali')
 * @returns {Date} UTC Date object
 */
export const convertLocalToUTC = (dateStr, timeStr, country) => {
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
  
  // Get timezone offset for the country (in hours)
  const offsetHours = getCountryTimezoneOffset(country);
  
  // Create a Date object representing the local time in the country's timezone
  // We use Date.UTC() to create a UTC timestamp, then subtract the offset to get the correct UTC time
  // For example: If appointment is 09:30 AM IST (UTC+5:30), we need 04:00 UTC
  // So: UTC timestamp = local timestamp - offset
  const utcTimestamp = Date.UTC(
    year || 0,
    (month || 1) - 1, // Month is 0-indexed
    day || 1,
    hours,
    minutes,
    0,
    0
  ) - (offsetHours * 60 * 60 * 1000);
  
  return new Date(utcTimestamp);
};

/**
 * Parse appointment date and time (for backward compatibility)
 * Returns local time Date object (same as before)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in format like "09:30 AM" or "11:10 - 11:15"
 * @returns {Date} Parsed date object in local time
 */
export const parseAppointmentStartTime = (dateStr, timeStr) => {
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

