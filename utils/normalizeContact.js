export const normalizeContact = (raw) => {
  if (typeof raw !== 'string') return raw;
  // remove all whitespace characters
  const noSpaces = raw.replace(/\s+/g, '');
  // ensure the number starts with '+' for international format
  return noSpaces.startsWith('+') ? noSpaces : `+${noSpaces}`;
};

// Helper function to remove '+' prefix for OTP sending
export const removePlusPrefix = (contact) => {
  if (typeof contact !== 'string') return contact;
  return contact.startsWith('+') ? contact.slice(1) : contact;
};



