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

  return undefined;
}
