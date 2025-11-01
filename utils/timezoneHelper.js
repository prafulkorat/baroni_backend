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
 * @returns {Date} UTC Date object (represents the exact UTC time)
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
  // India = UTC+5:30 (offset is +5.5), Mali = UTC+0 (offset is 0)
  const offsetHours = getCountryTimezoneOffset(country);
  
  // Convert local time to UTC
  // Example: If appointment is 09:30 AM IST (UTC+5:30), we need 04:00 UTC
  // Formula: UTC = Local - Offset
  // If Local is 09:30 (IST, UTC+5:30), then UTC = 09:30 - 5:30 = 04:00
  
  // Create UTC timestamp for the local time components
  // Date.UTC() creates a timestamp as if the given time is in UTC
  // Then we subtract the offset to convert from local to UTC
  const localTimeInUTC = Date.UTC(
    year || 0,
    (month || 1) - 1, // Month is 0-indexed
    day || 1,
    hours,
    minutes,
    0,
    0
  );
  
  // Subtract the timezone offset to get actual UTC time
  // offsetHours is positive for timezones ahead of UTC (like IST +5:30)
  // So we subtract it: UTC = LocalInUTC - Offset
  const utcTimestamp = localTimeInUTC - (offsetHours * 60 * 60 * 1000);
  
  // Create Date object from UTC timestamp
  // This Date object represents the exact UTC time and will be stored correctly in MongoDB
  const utcDate = new Date(utcTimestamp);
  
  // Log for debugging (can be removed in production)
  console.log(`[TimezoneConversion] Local time: ${dateStr} ${timeStr} (${country || 'unknown'}, offset: ${offsetHours}h)`);
  console.log(`[TimezoneConversion] UTC time: ${utcDate.toISOString()}`);
  console.log(`[TimezoneConversion] UTC timestamp: ${utcTimestamp}`);
  
  return utcDate;
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

