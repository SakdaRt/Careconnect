export type AvatarVariant = 'thumb' | 'sm' | 'md' | 'lg';

/**
 * Build avatar URL from userId + avatarVersion + variant.
 * Returns undefined if user has no avatar (version=0 or missing).
 *
 * URL pattern: /uploads/avatars/{userId}/{variant}.webp?v={version}
 * Falls back to legacy path if avatar string is provided instead of version.
 */
export function getAvatarUrl(
  userId?: string | null,
  avatarVersion?: number | null,
  variant: AvatarVariant = 'sm',
  legacyAvatar?: string | null,
  name?: string | null,
): string | undefined {
  if (userId && avatarVersion && avatarVersion > 0) {
    return `/uploads/avatars/${userId}/${variant}.webp?v=${avatarVersion}`;
  }

  if (legacyAvatar) {
    if (legacyAvatar.startsWith('http://') || legacyAvatar.startsWith('https://') || legacyAvatar.startsWith('/')) {
      return legacyAvatar;
    }
    return `/uploads/${legacyAvatar}`;
  }

  if (name) {
    const sizeMap: Record<AvatarVariant, number> = { thumb: 64, sm: 128, md: 256, lg: 512 };
    const px = sizeMap[variant] || 128;
    const seed = userId ? userId.replace(/-/g, '').slice(0, 8) : '000000';
    const hue = parseInt(seed, 16) % 360;
    const bgHex = hslToHex(hue, 55, 45);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${px}&background=${bgHex}&color=ffffff&bold=true&format=svg`;
  }

  return undefined;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `${f(0)}${f(8)}${f(4)}`;
}
