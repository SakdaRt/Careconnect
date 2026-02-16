export const AUTH_SCOPED_KEYS = [
  'careconnect_token',
  'careconnect_refresh_token',
  'careconnect_user',
  'careconnect_active_role',
  'pendingRole',
  'pendingAccountType',
] as const;

type ScopedAuthKey = (typeof AUTH_SCOPED_KEYS)[number] | string;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getScopedStorageItem(key: ScopedAuthKey): string | null {
  const session = getSessionStorage();
  const local = getLocalStorage();

  const sessionValue = session?.getItem(key) ?? null;
  if (sessionValue !== null) return sessionValue;

  const legacyValue = local?.getItem(key) ?? null;
  if (legacyValue !== null && session) {
    session.setItem(key, legacyValue);
    local?.removeItem(key);
  }

  return legacyValue;
}

export function setScopedStorageItem(key: ScopedAuthKey, value: string): void {
  const session = getSessionStorage();
  const local = getLocalStorage();

  if (session) {
    session.setItem(key, value);
    local?.removeItem(key);
    return;
  }

  local?.setItem(key, value);
}

export function removeScopedStorageItem(key: ScopedAuthKey): void {
  const session = getSessionStorage();
  const local = getLocalStorage();

  session?.removeItem(key);
  local?.removeItem(key);
}

export function clearScopedStorageItems(keys: readonly ScopedAuthKey[]): void {
  for (const key of keys) {
    removeScopedStorageItem(key);
  }
}
