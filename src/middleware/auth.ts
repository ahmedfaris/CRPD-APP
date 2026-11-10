import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SessionManager, SESSION_COOKIE_NAME, clearSessionCookie } from '../server/services/sessionManager.ts';
import { logger } from '../server/utils/logger.ts';

import { JWT_SECRET } from '../server/utils/jwtSecret.ts';
import { db } from '../db/index.ts';
import { users, roles } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: jwt.JwtPayload | any;
  sessionId?: string;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  // 1. Check Authorization header (Bearer token) or HttpOnly secure session cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    token = req.cookies[SESSION_COOKIE_NAME];
  }

  // No token means no identity. Client-supplied headers such as x-user-email /
  // x-user-role are never trusted as a substitute for a signed session token.
  if (!token) {
    logger.warning('Unauthorized request to {Path} from {ClientIp}: Missing session token or authentication credentials', {
      Path: req.path,
      ClientIp: clientIp,
      Action: 'MissingSessionToken',
      Subsystem: 'SessionManagement'
    });

    return res.status(401).json({
      error: 'Unauthorized: Missing session token or authentication credentials.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decodedTokenHeader = jwt.decode(token, { complete: true });
    
    if (!decodedTokenHeader) {
      clearSessionCookie(res, req);

      logger.warning('Unauthorized request to {Path} from {ClientIp}: Malformed session token structure', {
        Path: req.path,
        ClientIp: clientIp,
        Action: 'MalformedSessionToken',
        Subsystem: 'SessionManagement'
      });

      return res.status(401).json({
        error: 'Unauthorized: Malformed session token.',
        code: 'MALFORMED_TOKEN'
      });
    }

    // Only this server's own HS256 session tokens are accepted.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    // Short-lived 2FA challenge tokens only prove the password step; they are not sessions.
    if (decoded?.purpose) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid session token.',
        code: 'INVALID_TOKEN'
      });
    }
    // Every session token issued by /login or /verify-2fa is bound to a server-side session.
    if (!decoded?.sessionId) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid session token.',
        code: 'INVALID_TOKEN'
      });
    }
    req.user = decoded;

    // If the token is bound to a server session ID, perform stateful session validation:
    // - Checks Idle Timeout (15 minutes inactivity)
    // - Checks Absolute Timeout (8 hours maximum lifetime)
    // - Checks Session Invalidation (Logout, Password change, Privilege change)
    // - Checks Concurrent Login (Single active computer enforcement)
    if (decoded.sessionId) {
      req.sessionId = decoded.sessionId;
      const sessionValidation = await SessionManager.validateAndTouchSession(decoded.sessionId);

      if (!sessionValidation.valid) {
        clearSessionCookie(res, req);

        logger.warning('Unauthorized request to {Path} from {ClientIp}: Session {SessionId} rejected ({Code}). Reason: {Reason}', {
          Path: req.path,
          ClientIp: clientIp,
          SessionId: decoded.sessionId,
          Code: sessionValidation.code,
          Reason: sessionValidation.error,
          Action: 'SessionAccessRejected',
          Subsystem: 'SessionManagement'
        });

        return res.status(401).json({
          error: sessionValidation.error,
          errorAr: sessionValidation.errorAr,
          code: sessionValidation.code,
          requiresRelogin: true
        });
      }
    }

    return next();
  } catch (error: any) {
    clearSessionCookie(res, req);

    logger.warning('Unauthorized request to {Path} from {ClientIp}: Invalid or expired session token ({ErrorDetails})', {
      Path: req.path,
      ClientIp: clientIp,
      ErrorDetails: error.message,
      Action: 'SessionTokenExpiredOrInvalid',
      Subsystem: 'SessionManagement'
    });

    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired session token.',
      code: 'TOKEN_EXPIRED'
    });
  }
};

/**
 * Looks up the caller's current role and permissions from the database (not from
 * the token, so role changes and removals take effect immediately).
 */
export async function getEffectivePermissions(uid: string | undefined): Promise<{ role: string; email: string; permissions: string[] } | null> {
  if (!uid) return null;
  const [row] = await db.select().from(users).where(eq(users.uid, String(uid)));
  if (!row) return null;

  const role = (row.role || '').trim();
  const allRoles = await db.select().from(roles);
  const roleRow = allRoles.find((r: any) => r.name?.trim().toLowerCase() === role.toLowerCase());
  const permissions: string[] = roleRow && Array.isArray(roleRow.permissions) ? [...roleRow.permissions] : [];

  const roleLower = role.toLowerCase();
  if (roleLower === 'admin' || roleLower === 'administrator' || row.email?.toLowerCase() === 'admin@system.local') {
    permissions.unshift('*');
  }
  return { role, email: row.email, permissions };
}

/**
 * Route guard: must run after requireAuth. Allows the request only when the
 * authenticated user's role grants the given permission (or '*').
 */
export const requirePermission = (permission: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const effective = await getEffectivePermissions(req.user?.uid);
      if (effective && (effective.permissions.includes('*') || effective.permissions.includes(permission))) {
        return next();
      }
      logger.warning('Forbidden: {User} lacks permission {Permission} for {Path}', {
        User: req.user?.email || 'unknown',
        Permission: permission,
        Path: req.originalUrl,
        Action: 'PermissionDenied'
      });
      return res.status(403).json({ error: `Forbidden: requires '${permission}' permission.`, code: 'FORBIDDEN' });
    } catch (error: any) {
      logger.error('Permission check failed: {Error}', { Error: error.message });
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
