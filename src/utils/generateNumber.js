// src/utils/generateNumber.js

/**
 * Generate a unique sequential-style number for blood requests / donations.
 * Format:  REQ-2025-XXXX  /  DON-2025-XXXX
 */
function generateRequestNumber() {
  const year  = new Date().getFullYear();
  const rand  = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${year}-${rand}`;
}

function generateDonationNumber() {
  const year  = new Date().getFullYear();
  const rand  = Math.floor(1000 + Math.random() * 9000);
  return `DON-${year}-${rand}`;
}

module.exports = { generateRequestNumber, generateDonationNumber };
