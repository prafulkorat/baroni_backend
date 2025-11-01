/**
 * Timezone helper utility
 * Converts local time to UTC based on country timezone
 */

// Country to timezone offset mapping (in hours)
// Supports multiple variations/languages for country names
const COUNTRY_TIMEZONES = {
  // India variations
  'India': 5.5,      // IST (UTC+5:30)
  'भारत': 5.5,      // Hindi
  'Bharat': 5.5,    // Alternative
  'IN': 5.5,        // ISO code
  // Mali variations
  'Mali': 0,        // GMT (UTC+0)
  'ML': 0,          // ISO code
};

/**
 * Get timezone offset for a country
 * @param {string} country - Country name (supports multiple languages/variations)
 * @returns {number} Timezone offset in hours (e.g., 5.5 for IST)
 */
export const getCountryTimezoneOffset = (country) => {
  if (!country) {
    // Default to UTC if no country specified
    return 0;
  }
  
  // Normalize country name - trim and check case-insensitive
  const normalizedCountry = typeof country === 'string' ? country.trim() : '';
  
  // Direct lookup
  if (COUNTRY_TIMEZONES.hasOwnProperty(normalizedCountry)) {
    return COUNTRY_TIMEZONES[normalizedCountry];
  }
  
  // Case-insensitive lookup
  const lowerCountry = normalizedCountry.toLowerCase();
  for (const [key, offset] of Object.entries(COUNTRY_TIMEZONES)) {
    if (key.toLowerCase() === lowerCountry) {
      return offset;
    }
  }
  
  // Default to UTC if country not found
  return 0;
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
  
  // Log country recognition for debugging
  console.log(`[TimezoneConversion] Country lookup: "${country}" -> offset: ${offsetHours}h`);
  
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
  const offsetMs = offsetHours * 60 * 60 * 1000;
  const utcTimestamp = localTimeInUTC - offsetMs;
  
  // Create Date object from UTC timestamp
  // This Date object represents the exact UTC time and will be stored correctly in MongoDB
  const utcDate = new Date(utcTimestamp);
  
  // Log for debugging (shows the conversion calculation)
  console.log(`[TimezoneConversion] Conversion details:`, {
    local: `${dateStr} ${timeStr}`,
    country: country || 'unknown',
    offsetHours,
    localTimeComponents: `${hours}:${minutes}`,
    localTimeInUTCTimestamp: localTimeInUTC,
    offsetMs,
    utcTimestamp,
    utcTimeISO: utcDate.toISOString(),
    verification: offsetHours > 0 ? `Local time ${hours}:${minutes} - ${offsetHours}h = UTC ${utcDate.getUTCHours()}:${utcDate.getUTCMinutes()}` : 'No offset applied'
  });
  
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

