/**
 * Safely extract a displayable error string from any API error shape.
 * Handles: string, {message}, {code, message}, null/undefined, and other objects.
 */
export function getErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาด'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    if (typeof obj.code === 'string' && obj.code) return obj.code;
  }
  return fallback;
}
