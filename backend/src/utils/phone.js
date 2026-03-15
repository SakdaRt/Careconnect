/**
 * Phone Number Utilities — CareConnect
 *
 * Canonical format: 0xxxxxxxxx (Thai mobile, 10 digits starting with 0)
 * DB storage: 0xxxxxxxxx
 * Display: 0xxxxxxxxx
 * SMSOK provider: +66xxxxxxxxx (converted only at provider layer)
 *
 * All phone numbers MUST go through normalizePhone() before save/compare/lookup.
 */

/**
 * Normalize any phone input to canonical Thai format: 0xxxxxxxxx
 * Accepts: 0xxxxxxxxx, +66xxxxxxxxx, 66xxxxxxxxx, 0xx-xxx-xxxx
 * Returns: '0xxxxxxxxx' or null if invalid
 */
export function normalizePhone(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');

  let national = '';
  if (digits.startsWith('66') && digits.length === 11) {
    national = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9 && /^[689]/.test(digits)) {
    national = digits;
  } else {
    return null;
  }

  if (national.length !== 9) return null;
  if (!/^[2-9]/.test(national)) return null;

  return `0${national}`;
}

/**
 * Convert canonical phone (0xxxxxxxxx) to E.164 format (+66xxxxxxxxx)
 * Used ONLY for SMS provider (SMSOK) — never for storage or display.
 */
export function toE164(canonicalPhone) {
  if (!canonicalPhone) return null;
  const n = normalizePhone(canonicalPhone);
  if (!n) return null;
  return `+66${n.slice(1)}`;
}

/**
 * Validate that a string is a valid Thai mobile phone number.
 * Returns true/false — does NOT normalize.
 */
export function isValidThaiPhone(value) {
  return normalizePhone(value) !== null;
}
