/**
 * Phone Number Utilities — CareConnect (Frontend)
 *
 * Canonical format: 0xxxxxxxxx (Thai mobile, 10 digits starting with 0)
 * Display: 0xxxxxxxxx or 0xx-xxx-xxxx
 */

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');

  let national = '';
  if (digits.startsWith('66') && digits.length === 11) {
    national = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9 && /^[2-9]/.test(digits)) {
    national = digits;
  } else {
    return null;
  }

  if (national.length !== 9 || !/^[2-9]/.test(national)) return null;
  return `0${national}`;
}

export function formatPhoneDisplay(value: string | null | undefined): string {
  const n = normalizePhone(value);
  if (!n) return value || '';
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
}

export function isValidThaiPhone(value: string | null | undefined): boolean {
  return normalizePhone(value) !== null;
}
