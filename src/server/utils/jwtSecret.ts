// src/server/utils/jwtSecret.ts
import crypto from 'crypto';

/**
 * Single source of truth for the JWT signing secret.
 *
 * - Production: JWT_SECRET must be set and at least 32 characters, otherwise the
 *   server refuses to start (a guessable secret lets anyone forge admin tokens).
 * - Development: if JWT_SECRET is missing, a random per-process secret is used, so
 *   tokens simply stop working after a restart instead of being forgeable.
 */
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 32) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Set a long random value in the environment before starting the server.'
    );
  }

  console.warn(
    '[security] JWT_SECRET is not set (or too short). Using a random secret for this process; sessions will reset on restart.'
  );
  return crypto.randomBytes(48).toString('hex');
}

export const JWT_SECRET = resolveJwtSecret();
