// src/server/utils/publicUser.ts

/**
 * Strip credential material from a user record before sending it to a client.
 * passwordHash and twoFactorSecret must never leave the server; the UI only
 * needs to know whether a 2FA secret has been enrolled.
 */
export function toPublicUser<T extends Record<string, any> | null | undefined>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const { passwordHash, twoFactorSecret, ...rest } = user as Record<string, any>;
  return { ...rest, hasTwoFactorSecret: Boolean(twoFactorSecret) } as unknown as T;
}
