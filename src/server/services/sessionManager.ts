import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { db } from '../../db/index.ts';
import { userSessions } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute limit
export const SESSION_COOKIE_NAME = 'session_token';
import { JWT_SECRET } from '../utils/jwtSecret.ts';

export type InvalidationReason =
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PRIVILEGE_CHANGE'
  | 'CONCURRENT_LOGIN'
  | 'IDLE_TIMEOUT'
  | 'ABSOLUTE_TIMEOUT'
  | 'ADMIN_REVOKED';

export function getSessionCookieOptions(req: Request) {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true, // Prevents JavaScript access (XSS mitigation)
    secure: isHttps, // Enforces HTTPS transmission
    sameSite: 'strict' as const, // Strict Cross-Site Request Forgery mitigation
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS
  };
}

export function setSessionCookie(res: Response, req: Request, token: string) {
  const options = getSessionCookieOptions(req);
  res.cookie(SESSION_COOKIE_NAME, token, options);

  let sessionId = 'unknown';
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded?.sessionId) sessionId = decoded.sessionId;
  } catch (_) {}

  logger.information('Secure session cookie set for session {SessionId}. Policy: HttpOnly={HttpOnly}, Secure={Secure}, SameSite={SameSite}, Path={Path}, MaxAge={MaxAgeMs}ms', {
    SessionId: sessionId,
    CookieName: SESSION_COOKIE_NAME,
    HttpOnly: options.httpOnly,
    Secure: options.secure,
    SameSite: options.sameSite,
    Path: options.path,
    MaxAgeMs: options.maxAge,
    Action: 'SessionCookieSet',
    Subsystem: 'SessionManagement'
  });
}

export function clearSessionCookie(res: Response, req: Request) {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/'
  });

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  logger.information('Secure session cookie cleared from client at IP {ClientIp}', {
    CookieName: SESSION_COOKIE_NAME,
    ClientIp: clientIp,
    Action: 'SessionCookieCleared',
    Subsystem: 'SessionManagement'
  });
}

export function getInvalidationDetails(reason: string | null | undefined): {
  code: string;
  messageEn: string;
  messageAr: string;
} {
  switch (reason) {
    case 'CONCURRENT_LOGIN':
      return {
        code: 'CONCURRENT_LOGIN',
        messageEn: 'Your session was terminated because your account was logged into from another computer or browser. Only one active device session is permitted.',
        messageAr: 'تم إنهاء جلستك لتسجيل الدخول إلى حسابك من جهاز حاسوب أو متصفح آخر. يسمح بجلسة نشطة واحدة فقط لكل مستخدم.'
      };
    case 'IDLE_TIMEOUT':
      return {
        code: 'IDLE_TIMEOUT',
        messageEn: 'Your session has expired due to 15 minutes of inactivity (Idle Timeout). Please log in again.',
        messageAr: 'انتهت جلستك بسبب عدم النشاط لمدة 15 دقيقة (مهلة عدم النشاط). يرجى تسجيل الدخول مجدداً.'
      };
    case 'ABSOLUTE_TIMEOUT':
      return {
        code: 'ABSOLUTE_TIMEOUT',
        messageEn: 'Your absolute session lifetime limit has been reached. Please re-authenticate.',
        messageAr: 'تم بلوغ الحد الأقصى للمدة الإجمالية للجلسة. يرجى إعادة تسجيل الدخول.'
      };
    case 'PASSWORD_CHANGE':
      return {
        code: 'PASSWORD_CHANGE',
        messageEn: 'Your session was terminated because your password was changed. Please log in with your new password.',
        messageAr: 'تم إنهاء جلستك لتغيير كلمة المرور. يرجى تسجيل الدخول بكلمة المرور الجديدة.'
      };
    case 'PRIVILEGE_CHANGE':
      return {
        code: 'PRIVILEGE_CHANGE',
        messageEn: 'Your session was terminated due to a change in your security role or privileges. Please log in again to apply updated permissions.',
        messageAr: 'تم إنهاء جلستك لتحديث الدور الأمني أو الصلاحيات الخاصة بك. يرجى إعادة تسجيل الدخول لتطبيق الصلاحيات الجديدة.'
      };
    case 'LOGOUT':
      return {
        code: 'LOGOUT',
        messageEn: 'Session ended upon logout.',
        messageAr: 'تم إنهاء الجلسة بتسجيل الخروج.'
      };
    default:
      return {
        code: 'SESSION_INVALIDATED',
        messageEn: 'Session is no longer active or has expired. Please log in again.',
        messageAr: 'الجلسة لم تعد نشطة أو منتهية الصلاحية. يرجى تسجيل الدخول مجدداً.'
      };
  }
}

export class SessionManager {
  /**
   * Creates a new session for the user and enforces the Single Computer (Concurrent Login) policy
   */
  static async createSession(
    user: { id?: string | number; uid: string; email: string; fullName?: string; role?: string; userType?: string; department?: string },
    req: Request
  ): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown Computer';

    // 1. Enforce CONCURRENT LOGINS policy:
    // Only one active computer/session per user is allowed.
    // Invalidate any existing active sessions for this user.
    const existingActiveSessions = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userUid, user.uid), eq(userSessions.isActive, true)));

    if (existingActiveSessions.length > 0) {
      const displacedSessionIds = existingActiveSessions.map(s => s.sessionId).join(', ');
      await db
        .update(userSessions)
        .set({
          isActive: false,
          invalidationReason: 'CONCURRENT_LOGIN'
        })
        .where(and(eq(userSessions.userUid, user.uid), eq(userSessions.isActive, true)));

      logger.warning(
        'Concurrent login policy enforced: Terminated {Count} active session(s) for user {TargetUser} due to new login from {ClientIp} ({UserAgent}). Displaced session ID(s): {DisplacedSessionIds}',
        {
          TargetUser: user.email,
          UserUid: user.uid,
          ClientIp: clientIp,
          UserAgent: userAgent,
          DisplacedSessionIds: displacedSessionIds,
          Count: existingActiveSessions.length,
          Policy: 'SingleActiveComputer',
          Action: 'ConcurrentLoginTerminatedPrevious',
          Subsystem: 'SessionManagement'
        }
      );
    }

    // 2. Generate cryptographically strong session ID and tokens
    const sessionId = 'sess_' + crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);

    // 3. Persist new session in PostgreSQL
    await db.insert(userSessions).values({
      sessionId,
      userUid: user.uid,
      userEmail: user.email.toLowerCase(),
      deviceInfo: userAgent,
      ipAddress: clientIp,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: expiresAt,
      isActive: true,
      invalidationReason: null
    });

    // 4. Generate JWT referencing the session ID
    const token = jwt.sign(
      {
        ...(user.id !== undefined && user.id !== null ? { id: String(user.id) } : {}),
        uid: user.uid,
        email: user.email,
        name: user.fullName || user.email,
        role: user.role || 'Employee',
        userType: user.userType || 'Operator',
        department: user.department || 'Information Technology',
        sessionId: sessionId
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.information(
      'Session {SessionId} created for user {TargetUser} ({Role}) from IP {ClientIp} on {UserAgent}. Session valid for 8 hours absolute, 15 minutes idle.',
      {
        SessionId: sessionId,
        TargetUser: user.email,
        UserUid: user.uid,
        Role: user.role || 'Employee',
        ClientIp: clientIp,
        UserAgent: userAgent,
        ExpiresAt: expiresAt.toISOString(),
        Action: 'SessionCreated',
        Subsystem: 'SessionManagement'
      }
    );

    return { sessionId, token, expiresAt };
  }

  /**
   * Validates the session, checks Idle Timeout & Absolute Timeout, and updates last activity
   */
  static async validateAndTouchSession(sessionId: string): Promise<{
    valid: boolean;
    session?: any;
    code?: string;
    error?: string;
    errorAr?: string;
  }> {
    if (!sessionId) {
      logger.warning('Session validation rejected: Missing session identifier from client.', {
        Action: 'SessionValidationMissingIdentifier',
        Subsystem: 'SessionManagement'
      });
      return { valid: false, code: 'MISSING_SESSION', error: 'Missing session identifier.' };
    }

    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId));

    if (!session) {
      logger.warning('Session validation rejected: Session {SessionId} was not recognized in the database.', {
        SessionId: sessionId,
        Action: 'SessionNotFound',
        Subsystem: 'SessionManagement'
      });
      return {
        valid: false,
        code: 'SESSION_NOT_FOUND',
        error: 'Session not recognized. Please log in again.'
      };
    }

    if (!session.isActive) {
      const details = getInvalidationDetails(session.invalidationReason);
      logger.warning(
        'Session access attempt rejected: Session {SessionId} for user {TargetUser} is inactive ({InvalidationReason}). Rejection code: {Code}',
        {
          SessionId: sessionId,
          TargetUser: session.userEmail,
          InvalidationReason: session.invalidationReason || 'UNKNOWN',
          Code: details.code,
          Action: 'InactiveSessionAccessAttempt',
          Subsystem: 'SessionManagement'
        }
      );
      return {
        valid: false,
        code: details.code,
        error: details.messageEn,
        errorAr: details.messageAr
      };
    }

    const now = new Date();

    // Check Absolute Timeout (e.g. 8 hours)
    if (session.expiresAt && now.getTime() > new Date(session.expiresAt).getTime()) {
      await db
        .update(userSessions)
        .set({ isActive: false, invalidationReason: 'ABSOLUTE_TIMEOUT' })
        .where(eq(userSessions.id, session.id));

      const details = getInvalidationDetails('ABSOLUTE_TIMEOUT');
      logger.warning(
        'Session {SessionId} for user {TargetUser} expired: Reached absolute lifetime limit (8-hour maximum). Session terminated.',
        {
          SessionId: sessionId,
          TargetUser: session.userEmail,
          MaxHours: 8,
          Action: 'AbsoluteSessionTimeout',
          Subsystem: 'SessionManagement'
        }
      );

      return {
        valid: false,
        code: details.code,
        error: details.messageEn,
        errorAr: details.messageAr
      };
    }

    // Check Idle Timeout (e.g. 15 minutes of inactivity)
    const lastActivityTime = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : now.getTime();
    const idleDuration = now.getTime() - lastActivityTime;

    if (idleDuration > IDLE_TIMEOUT_MS) {
      await db
        .update(userSessions)
        .set({ isActive: false, invalidationReason: 'IDLE_TIMEOUT' })
        .where(eq(userSessions.id, session.id));

      const details = getInvalidationDetails('IDLE_TIMEOUT');
      logger.warning(
        'Session {SessionId} for user {TargetUser} expired: Reached idle timeout ({DurationMin} minutes inactive > 15m limit). Session terminated.',
        {
          SessionId: sessionId,
          TargetUser: session.userEmail,
          DurationMin: Math.round(idleDuration / 60000),
          AllowedIdleMin: 15,
          LastActivityAt: session.lastActivityAt,
          Action: 'IdleSessionTimeout',
          Subsystem: 'SessionManagement'
        }
      );

      return {
        valid: false,
        code: details.code,
        error: details.messageEn,
        errorAr: details.messageAr
      };
    }

    // Touch session: throttled to at most once every 10 seconds to avoid DB write thrashing
    if (idleDuration > 10 * 1000) {
      await db
        .update(userSessions)
        .set({ lastActivityAt: now })
        .where(eq(userSessions.id, session.id));

      logger.information('Session activity touched for {SessionId} ({TargetUser}). Inactivity timer refreshed.', {
        SessionId: sessionId,
        TargetUser: session.userEmail,
        LastActivityAt: now.toISOString(),
        Action: 'SessionActivityTouched',
        Subsystem: 'SessionManagement'
      });
    }

    return { valid: true, session };
  }

  /**
   * Explicitly destroys a single session token upon user logout
   */
  static async destroySession(sessionId: string, reason: InvalidationReason = 'LOGOUT'): Promise<void> {
    if (!sessionId) return;
    
    const [existing] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId));

    await db
      .update(userSessions)
      .set({
        isActive: false,
        invalidationReason: reason
      })
      .where(eq(userSessions.sessionId, sessionId));

    logger.information('Session {SessionId} explicitly destroyed for user {TargetUser}. Invalidation reason: {Reason}.', {
      SessionId: sessionId,
      TargetUser: existing?.userEmail || 'Unknown',
      Reason: reason,
      Action: 'SessionDestroyed',
      Subsystem: 'SessionManagement'
    });
  }

  static async invalidateSession(sessionId: string, reason: InvalidationReason = 'LOGOUT'): Promise<void> {
    return this.destroySession(sessionId, reason);
  }

  /**
   * Explicitly destroys ALL active sessions for a user upon password change, privilege change, or account lockout
   */
  static async invalidateAllUserSessions(userUid: string, reason: InvalidationReason): Promise<number> {
    if (!userUid) return 0;

    const activeSessions = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userUid, userUid), eq(userSessions.isActive, true)));

    if (activeSessions.length > 0) {
      const sessionIds = activeSessions.map(s => s.sessionId).join(', ');
      const userEmail = activeSessions[0]?.userEmail || 'Unknown';
      await db
        .update(userSessions)
        .set({
          isActive: false,
          invalidationReason: reason
        })
        .where(and(eq(userSessions.userUid, userUid), eq(userSessions.isActive, true)));

      logger.warning(
        'Invalidated {Count} active session(s) for user {TargetUser} ({UserUid}) due to {Reason}. Affected session ID(s): {SessionIds}',
        {
          TargetUser: userEmail,
          UserUid: userUid,
          Count: activeSessions.length,
          Reason: reason,
          SessionIds: sessionIds,
          Action: 'AllUserSessionsInvalidated',
          Subsystem: 'SessionManagement'
        }
      );
    }

    return activeSessions.length;
  }

  /**
   * Invalidate all active sessions of users belonging to a specific role upon role permission change
   */
  static async invalidateSessionsByRole(roleName: string, reason: InvalidationReason = 'PRIVILEGE_CHANGE'): Promise<void> {
    try {
      logger.warning('Initiating session invalidation for all users with role {RoleName}. Reason: {Reason}', {
        RoleName: roleName,
        Reason: reason,
        Action: 'RoleSessionsInvalidated',
        Subsystem: 'SessionManagement'
      });
      const usersWithRole = await db.query.users.findMany({
        where: (u, { eq }) => eq(u.role, roleName)
      });
      for (const u of usersWithRole) {
        await this.invalidateAllUserSessions(u.uid, reason);
      }
    } catch (e: any) {
      logger.error('Failed to invalidate sessions by role {RoleName}: {ErrorMessage}', {
        RoleName: roleName,
        ErrorMessage: e.message,
        Action: 'RoleSessionsInvalidationFailed',
        Subsystem: 'SessionManagement'
      });
    }
  }

  /**
   * Get session status for client polling/heartbeat
   */
  static async getSessionStatus(sessionId: string): Promise<{
    isActive: boolean;
    idleRemainingMs: number;
    absoluteRemainingMs: number;
    code?: string;
    messageEn?: string;
    messageAr?: string;
  }> {
    const result = await this.validateAndTouchSession(sessionId);
    if (!result.valid) {
      return {
        isActive: false,
        idleRemainingMs: 0,
        absoluteRemainingMs: 0,
        code: result.code,
        messageEn: result.error,
        messageAr: result.errorAr
      };
    }

    const session = result.session;
    const now = Date.now();
    const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : now;
    const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : now;

    const idleRemainingMs = Math.max(0, IDLE_TIMEOUT_MS - (now - lastActivity));
    const absoluteRemainingMs = Math.max(0, expiresAt - now);

    logger.information(
      'Session status check verified for session {SessionId} ({TargetUser}): Active=true, IdleRemaining={IdleRemainingSec}s, AbsoluteRemaining={AbsoluteRemainingSec}s',
      {
        SessionId: sessionId,
        TargetUser: session.userEmail,
        IsActive: true,
        IdleRemainingSec: Math.round(idleRemainingMs / 1000),
        AbsoluteRemainingSec: Math.round(absoluteRemainingMs / 1000),
        Action: 'SessionStatusCheck',
        Subsystem: 'SessionManagement'
      }
    );

    return {
      isActive: true,
      idleRemainingMs,
      absoluteRemainingMs
    };
  }
}
