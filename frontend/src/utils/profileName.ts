const GENERATED_DISPLAY_NAME_PATTERN = /^ผู้(?:ว่าจ้าง|ดูแล)\s+[A-Z0-9]{4}$/u;

export const FULL_NAME_INPUT_GUIDE = 'กรอกชื่อและนามสกุลเต็ม เช่น "สมชาย ใจดี"';

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

export function toDisplayNameFromFullName(value: string): string | null {
  const normalized = normalizeSpaces(value || '');
  if (!normalized) return null;
  if (GENERATED_DISPLAY_NAME_PATTERN.test(normalized)) return null;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return null;

  const firstName = parts[0];
  const lastName = parts.slice(1).join('').replace(/[^\p{L}\p{N}]/gu, '');
  if (lastName.length < 2) return null;

  const lastInitial = Array.from(lastName)[0];
  if (!lastInitial) return null;

  return `${firstName} ${lastInitial}.`;
}

export function isConfiguredDisplayName(value?: string | null): boolean {
  const normalized = normalizeSpaces(String(value || ''));
  if (!normalized) return false;
  if (GENERATED_DISPLAY_NAME_PATTERN.test(normalized)) return false;
  return /^(\S+)\s+(\S)\.$/u.test(normalized);
}
