import { Router } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getOrCreateUser } from '../../db/users.ts';
import { db } from '../../db/index.ts';
import { users, roles } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.ts';
import { generateBase32Secret, verifyTOTPWithTolerance } from '../../utils/totp.ts';
import {
  SessionManager,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME
} from '../services/sessionManager.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

// Define the maximum failed attempts and progressive lockout durations:
// 1st lock: 5 minutes | 2nd lock: 10 minutes | 3rd lock: 15 minutes
const MAX_FAILED_ATTEMPTS = 6;

function getLockoutDuration(tier: number): { minutes: number; ms: number; tierLabel: string } {
  if (tier <= 1) {
    return { minutes: 5, ms: 5 * 60 * 1000, tierLabel: 'First lockout: 5 minutes' };
  } else if (tier === 2) {
    return { minutes: 10, ms: 10 * 60 * 1000, tierLabel: 'Second lockout: 10 minutes' };
  } else {
    return { minutes: 15, ms: 15 * 60 * 1000, tierLabel: 'Third lockout: 15 minutes' };
  }
}

function formatLockoutDuration(minutes: number): { periodEn: string; periodAr: string; messageEn: string; messageAr: string } {
  const periodEn = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  let periodAr = `${minutes} دقيقة`;
  if (minutes === 1) {
    periodAr = 'دقيقة واحدة';
  } else if (minutes === 2) {
    periodAr = 'دقيقتين';
  } else if (minutes >= 3 && minutes <= 10) {
    periodAr = `${minutes} دقائق`;
  }
  return {
    periodEn,
    periodAr,
    messageEn: `You are locked out for ${periodEn}`,
    messageAr: `تم قفل حسابك لمدة ${periodAr}`
  };
}

// IP Rate Limiter to protect against high-frequency brute-force bot attacks
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const ipLoginAttempts = new Map<string, RateLimitRecord>();
const IP_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const IP_MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP

function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = ipLoginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    ipLoginAttempts.set(ip, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (record.count >= IP_MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  record.count += 1;
  return { allowed: true };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkIpRateLimit(clientIp);
    if (!rateLimit.allowed) {
      logger.warning('Rate limit exceeded for IP {ClientIp} on login endpoint', {
        ClientIp: clientIp,
        Action: 'RateLimitExceeded'
      });
      return res.status(429).json({
        error: `Too many login requests from your IP. Please wait ${rateLimit.retryAfterSeconds} second(s) before trying again.`
      });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const identifier = (email || '').trim().toLowerCase();

    // Fetch user by email OR username (case-insensitive)
    const allUsers = await db.select().from(users);
    const user = allUsers.find((u: any) => 
      (u.email && u.email.toLowerCase() === identifier) ||
      (u.userName && u.userName.toLowerCase() === identifier)
    );
    
    if (!user) {
      // Simulate bcrypt delay to prevent timing attacks
      await bcrypt.compare(password, '$2b$10$abcdefghijklmnopqrstuv');
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check if account is currently locked out
    if (user.isLockedOut) {
      // Check if lockout period has expired (auto-unlock)
      if (user.lockoutEnd && new Date(user.lockoutEnd) <= new Date()) {
        await db.update(users).set({
          isLockedOut: false,
          lockoutEnd: null,
          failedAccessCount: 0
        }).where(eq(users.id, user.id));
        user.isLockedOut = false;
        user.lockoutEnd = null;
        user.failedAccessCount = 0;

        logger.information('Lockout duration expired. Auto-unlocked account for {TargetUser}', {
          TargetUser: user.email,
          Action: 'AccountAutoUnlocked'
        });
      } else {
        const currentTier = user.lockoutCount || 1;
        const tierInfo = getLockoutDuration(currentTier);
        const remainingMinutes = user.lockoutEnd
          ? Math.max(1, Math.ceil((new Date(user.lockoutEnd).getTime() - Date.now()) / 60000))
          : tierInfo.minutes;

        const durationFormatted = formatLockoutDuration(remainingMinutes);
        const fullPeriodFormatted = formatLockoutDuration(tierInfo.minutes);

        logger.warning('Login rejected: Account is locked out for {TargetUser} ({TierLabel})', {
          TargetUser: user.email,
          Action: 'LoginRejectedAccountLocked',
          FailedAttempts: user.failedAccessCount,
          LockoutEnd: user.lockoutEnd,
          LockoutTier: currentTier,
          RemainingMinutes: remainingMinutes,
          PeriodEn: durationFormatted.periodEn,
          PeriodAr: durationFormatted.periodAr
        });

        return res.status(403).json({
          error: `${durationFormatted.messageEn} / ${durationFormatted.messageAr}`,
          isLockedOut: true,
          failedAccessCount: user.failedAccessCount || MAX_FAILED_ATTEMPTS,
          maxAttempts: MAX_FAILED_ATTEMPTS,
          lockoutCount: currentTier,
          lockoutMinutes: tierInfo.minutes,
          remainingMinutes,
          periodEn: durationFormatted.periodEn,
          periodAr: durationFormatted.periodAr,
          messageEn: durationFormatted.messageEn,
          messageAr: durationFormatted.messageAr,
          fullPeriodEn: fullPeriodFormatted.periodEn,
          fullPeriodAr: fullPeriodFormatted.periodAr,
          fullMessageEn: fullPeriodFormatted.messageEn,
          fullMessageAr: fullPeriodFormatted.messageAr,
          lockoutEnd: user.lockoutEnd
        });
      }
    }

    // Check password strictly against bcrypt hash
    let passwordMatch = false;
    const cleanPassword = (password || '').trim();

    if (user.passwordHash) {
      passwordMatch = await bcrypt.compare(password, user.passwordHash) || await bcrypt.compare(cleanPassword, user.passwordHash);
    } else {
      // User has no passwordHash yet (freshly created unhashed user), only verify against default initial credential
      if (cleanPassword === 'Admin@2026!') {
        passwordMatch = true;
        const hash = await bcrypt.hash(cleanPassword, 10);
        await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
      }
    }

    if (!passwordMatch) {
      // Increment failed access count
      const newCount = (user.failedAccessCount || 0) + 1;
      let updateData: any = { failedAccessCount: newCount };
      
      if (newCount >= MAX_FAILED_ATTEMPTS) {
        const nextLockoutCount = (user.lockoutCount || 0) + 1;
        const tierInfo = getLockoutDuration(nextLockoutCount);
        const lockoutEndTime = new Date(Date.now() + tierInfo.ms);

        updateData.isLockedOut = true;
        updateData.lockoutEnd = lockoutEndTime.toISOString();
        updateData.lockoutCount = nextLockoutCount;

        const durationFormatted = formatLockoutDuration(tierInfo.minutes);
        
        // Terminate all active sessions immediately upon account lockout
        await SessionManager.invalidateAllUserSessions(user.uid, 'ADMIN_REVOKED');

        logger.warning('Account locked out ({TierLabel}): User {TargetUser} failed password {FailedAttempts}/{MaxAttempts} times. Duration: {PeriodEn}. All active sessions terminated.', {
          TargetUser: user.email,
          Action: 'AccountLockout',
          FailedAttempts: newCount,
          MaxAttempts: MAX_FAILED_ATTEMPTS,
          LockoutTier: nextLockoutCount,
          LockoutMinutes: tierInfo.minutes,
          PeriodEn: durationFormatted.periodEn,
          PeriodAr: durationFormatted.periodAr,
          LockoutEnd: lockoutEndTime.toISOString(),
          Subsystem: 'SessionManagement'
        });

        await db.update(users).set(updateData).where(eq(users.id, user.id));

        return res.status(403).json({
          error: `${durationFormatted.messageEn} / ${durationFormatted.messageAr}`,
          isLockedOut: true,
          failedAccessCount: newCount,
          maxAttempts: MAX_FAILED_ATTEMPTS,
          lockoutCount: nextLockoutCount,
          lockoutMinutes: tierInfo.minutes,
          remainingMinutes: tierInfo.minutes,
          periodEn: durationFormatted.periodEn,
          periodAr: durationFormatted.periodAr,
          messageEn: durationFormatted.messageEn,
          messageAr: durationFormatted.messageAr,
          lockoutEnd: updateData.lockoutEnd
        });
      } else {
        const attemptsRemaining = MAX_FAILED_ATTEMPTS - newCount;

        logger.information('Failed login attempt ({FailedAttempts}/{MaxAttempts}) for {TargetUser}', {
          TargetUser: user.email,
          Action: 'LoginFailed',
          FailedAttempts: newCount,
          MaxAttempts: MAX_FAILED_ATTEMPTS,
          AttemptsRemaining: attemptsRemaining
        });

        await db.update(users).set(updateData).where(eq(users.id, user.id));

        return res.status(401).json({
          error: `Invalid username or password. Warning: Attempt ${newCount} of ${MAX_FAILED_ATTEMPTS} (${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before account is locked).`,
          failedAccessCount: newCount,
          maxAttempts: MAX_FAILED_ATTEMPTS,
          attemptsRemaining
        });
      }
    }

    // Password is valid - reset failed attempts & clear lockout (and lockoutCount upon successful auth)
    await db.update(users)
      .set({ failedAccessCount: 0, isLockedOut: false, lockoutEnd: null, lockoutCount: 0, lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    user.failedAccessCount = 0;
    user.isLockedOut = false;
    user.lockoutEnd = null;
    user.lockoutCount = 0;

    // Check if 2FA is required for this user
    if (user.twoFactorEnabled) {
      const isFirstTime2FA = !user.twoFactorSecret;
      const secretToUse = user.twoFactorSecret || generateBase32Secret(16);

      logger.information('2FA authentication challenged for {TargetUser}. First time setup: {IsFirstTime}', {
        TargetUser: user.email,
        IsFirstTime: isFirstTime2FA,
        Action: '2FAChallenged'
      });

      let rolePermissions: string[] = [];
      if (user.role) {
        const allRoles = await db.select().from(roles);
        const roleRow = allRoles.find(r => r.name?.trim().toLowerCase() === user.role.trim().toLowerCase());
        if (roleRow && Array.isArray(roleRow.permissions)) {
          rolePermissions = roleRow.permissions;
        }
      }
      if (user.role === 'Admin' || user.role === 'Administrator' || user.email?.toLowerCase() === 'admin@system.local') {
        if (!rolePermissions.includes('*')) {
          rolePermissions = ['*', ...rolePermissions];
        }
      }

      return res.json({
        success: true,
        requires2FA: true,
        isFirstTime2FA,
        twoFactorSecret: secretToUse,
        user: {
          id: String(user.id),
          uid: user.uid,
          email: user.email,
          fullName: user.fullName,
          department: user.department || 'Unassigned',
          jobTitle: user.jobTitle || 'Staff',
          role: user.role,
          userType: user.userType,
          twoFactorEnabled: true,
          twoFactorSecret: user.twoFactorSecret || undefined,
          avatarColor: user.avatarColor || 'bg-blue-600 text-white',
          mustChangePassword: user.mustChangePassword || false,
          rolePermissions
        }
      });
    }

    // Direct Login (No 2FA required)
    logger.information('Successful direct login for {TargetUser}', {
      TargetUser: user.email,
      Action: 'LoginSuccess'
    });

    // Create managed session (enforces single computer concurrent login policy & timeouts)
    const sessionInfo = await SessionManager.createSession(
      { 
        uid: user.uid, 
        email: user.email, 
        fullName: user.fullName, 
        role: user.role,
        userType: user.userType || undefined,
        department: user.department || undefined
      },
      req
    );

    // Set Secure HttpOnly SameSite=Strict cookie
    setSessionCookie(res, req, sessionInfo.token);

    let rolePermissions: string[] = [];
    if (user.role) {
      const allRoles = await db.select().from(roles);
      const roleRow = allRoles.find(r => r.name?.trim().toLowerCase() === user.role.trim().toLowerCase());
      if (roleRow && Array.isArray(roleRow.permissions)) {
        rolePermissions = roleRow.permissions;
      }
    }
    if (user.role === 'Admin' || user.role === 'Administrator' || user.email?.toLowerCase() === 'admin@system.local') {
      if (!rolePermissions.includes('*')) {
        rolePermissions = ['*', ...rolePermissions];
      }
    }

    return res.json({
      success: true,
      requires2FA: false,
      token: sessionInfo.token,
      sessionId: sessionInfo.sessionId,
      expiresAt: sessionInfo.expiresAt,
      user: {
        ...user,
        rolePermissions
      }
    });
  } catch (error: any) {
    logger.error('Login error: {ErrorMessage}', { ErrorMessage: error.message, Action: 'LoginSystemError' });
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/verify-2fa
// Strictly verifies the RFC 6238 TOTP code entered from an Authenticator app
router.post('/verify-2fa', async (req, res) => {
  try {
    const { email, code, secret } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit authenticator code are required.' });
    }

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, error: 'The code must be exactly 6 digits from your authenticator app.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // Determine the secret: either already enrolled in DB, or passed during first-time enrollment
    const activeSecret = user.twoFactorSecret || secret;
    if (!activeSecret) {
      return res.status(400).json({ success: false, error: 'No 2FA configuration found for this account.' });
    }

    // Strictly verify code using RFC 6238 TOTP with ±1 minute clock tolerance (standard tolerance)
    const verification = verifyTOTPWithTolerance(cleanCode, activeSecret, 60, 30);

    if (!verification.valid) {
      logger.warning('Failed 2FA code verification for user {TargetUser}', {
        TargetUser: user.email,
        Action: '2FAVerificationFailed'
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid authenticator code. Please check your authenticator app (Google Authenticator, Microsoft Authenticator) and try again.'
      });
    }

    // If this was first-time enrollment, persist the secret in PostgreSQL so future logins require it
    let updatedUser = user;
    if (!user.twoFactorSecret && activeSecret) {
      const [saved] = await db.update(users)
        .set({ twoFactorSecret: activeSecret, twoFactorEnabled: true })
        .where(eq(users.id, user.id))
        .returning();
      if (saved) updatedUser = saved;

      logger.information('2FA successfully enrolled and secret saved for user {TargetUser}', {
        TargetUser: user.email,
        Action: '2FAEnrolled'
      });
    }

    // Reset failed access count & lockout on successful 2FA
    await db.update(users)
      .set({ failedAccessCount: 0, isLockedOut: false, lockoutEnd: null, lockoutCount: 0, lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    // Issue session and token upon successful 2FA verification (enforcing single computer policy)
    const sessionInfo = await SessionManager.createSession(
      { 
        uid: updatedUser.uid, 
        email: updatedUser.email, 
        fullName: updatedUser.fullName, 
        role: updatedUser.role,
        userType: updatedUser.userType || undefined,
        department: updatedUser.department || undefined
      },
      req
    );

    // Set Secure HttpOnly SameSite=Strict cookie
    setSessionCookie(res, req, sessionInfo.token);

    logger.information('Successful 2FA verification and authentication for {TargetUser}', {
      TargetUser: updatedUser.email,
      Action: '2FALoginSuccess'
    });

    let rolePermissions: string[] = [];
    if (updatedUser.role) {
      const allRoles = await db.select().from(roles);
      const roleRow = allRoles.find(r => r.name?.trim().toLowerCase() === updatedUser.role.trim().toLowerCase());
      if (roleRow && Array.isArray(roleRow.permissions)) {
        rolePermissions = roleRow.permissions;
      }
    }
    if (updatedUser.role === 'Admin' || updatedUser.role === 'Administrator' || updatedUser.email?.toLowerCase() === 'admin@system.local') {
      if (!rolePermissions.includes('*')) {
        rolePermissions = ['*', ...rolePermissions];
      }
    }

    return res.json({
      success: true,
      token: sessionInfo.token,
      sessionId: sessionInfo.sessionId,
      expiresAt: sessionInfo.expiresAt,
      user: {
        id: String(updatedUser.id),
        uid: updatedUser.uid,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        department: updatedUser.department || 'Unassigned',
        jobTitle: updatedUser.jobTitle || 'Staff',
        role: updatedUser.role,
        userType: updatedUser.userType,
        twoFactorEnabled: updatedUser.twoFactorEnabled || false,
        twoFactorSecret: updatedUser.twoFactorSecret || undefined,
        avatarColor: updatedUser.avatarColor || 'bg-blue-600 text-white',
        mustChangePassword: updatedUser.mustChangePassword || false,
        rolePermissions
      }
    });
  } catch (error: any) {
    logger.error('2FA verification error: {ErrorMessage}', {
      ErrorMessage: error.message,
      Action: '2FAVerificationSystemError'
    });
    res.status(500).json({ success: false, error: 'Internal error during 2FA verification.' });
  }
});

// POST /api/auth/reset-2fa
router.post('/reset-2fa', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User identifier is required.' });
    }

    const [updated] = await db.update(users)
      .set({ twoFactorSecret: null })
      .where(eq(users.uid, userId))
      .returning();

    if (updated) {
      logger.information('2FA secret reset for {TargetUser} by {AdminUser}', {
        TargetUser: updated.email,
        AdminUser: req.user?.email || 'System',
        Action: 'Reset2FASecret'
      });
      return res.json({ success: true, user: updated });
    }

    res.status(404).json({ success: false, error: 'User not found.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/toggle-2fa
router.post('/toggle-2fa', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, enabled } = req.body;
    if (!userId || enabled === undefined) {
      return res.status(400).json({ success: false, error: 'User identifier and enabled flag are required.' });
    }

    const [updated] = await db.update(users)
      .set({ 
        twoFactorEnabled: enabled, 
        ...(enabled === false ? { twoFactorSecret: null } : {}) 
      })
      .where(eq(users.uid, userId))
      .returning();

    if (updated) {
      logger.information('2FA status set to {Status} for {TargetUser} by {AdminUser}', {
        TargetUser: updated.email,
        Status: enabled ? 'Enabled' : 'Disabled',
        AdminUser: req.user?.email || 'System',
        Action: 'Toggle2FA'
      });
      return res.json({ success: true, user: updated });
    }

    res.status(404).json({ success: false, error: 'User not found.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/sync
router.post('/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No user token found' });
    }
    
    const syncedUser = await getOrCreateUser(
      req.user.uid,
      req.user.email || '',
      req.user.name || 'Anonymous User'
    );

    let rolePermissions: string[] = [];
    if (syncedUser?.role) {
      const allRoles = await db.select().from(roles);
      const roleRow = allRoles.find(r => r.name?.trim().toLowerCase() === syncedUser.role.trim().toLowerCase());
      if (roleRow && Array.isArray(roleRow.permissions)) {
        rolePermissions = roleRow.permissions;
      }
    }
    if (syncedUser?.role === 'Admin' || syncedUser?.role === 'Administrator' || syncedUser?.email?.toLowerCase() === 'admin@system.local') {
      if (!rolePermissions.includes('*')) {
        rolePermissions = ['*', ...rolePermissions];
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        ...syncedUser,
        rolePermissions
      } 
    });
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});


// POST /api/auth/reset-password-admin
router.post('/reset-password-admin', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) {
      return res.status(400).json({ error: 'UID and newPassword are required.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db.update(users).set({ passwordHash: hash, mustChangePassword: true }).where(eq(users.uid, uid)).returning();
    
    if (updatedUser) {
      logger.warning('Administrative password reset performed for user {TargetUser} by {AdminUser}', {
        TargetUser: updatedUser.email,
        AdminUser: req.user?.email || 'System',
        Action: 'AdminResetPassword'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to reset password administratively for user {TargetUID}: {ErrorMessage}', {
      TargetUID: req.body.uid,
      AdminUser: req.user?.email || 'System',
      ErrorMessage: (error as Error).message,
      Action: 'AdminResetPasswordFailed'
    });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * Explicit User Logout
 * Policy: Session Invalidation
 * The server explicitly destroys the session token upon user logout and clears the HttpOnly cookie.
 */
router.post('/logout', async (req: AuthRequest, res) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
      token = req.cookies[SESSION_COOKIE_NAME];
    }

    let sessionId = req.sessionId;
    let userEmail = req.user?.email || 'Unknown';

    if (!sessionId && token) {
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded?.sessionId) {
          sessionId = decoded.sessionId;
        }
        if (decoded?.email) {
          userEmail = decoded.email;
        }
      } catch (_) {}
    }

    if (sessionId) {
      await SessionManager.invalidateSession(sessionId, 'LOGOUT');
    }

    // Always clear the HttpOnly secure session cookie
    clearSessionCookie(res, req);

    logger.information('User {UserEmail} performed explicit logout. Session {SessionId} destroyed.', {
      UserEmail: userEmail,
      SessionId: sessionId || 'None',
      Action: 'ExplicitLogout',
      Subsystem: 'SessionManagement'
    });

    res.json({
      success: true,
      message: 'Logged out successfully. Session invalidated and cookie cleared.'
    });
  } catch (error: any) {
    console.error('Logout handler error:', error);
    clearSessionCookie(res, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Session Status Heartbeat
 * Policy: Session Timeouts (Idle & Absolute) and Concurrent Login Detection
 */
router.get('/session-status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.sessionId;
    if (!sessionId) {
      return res.json({
        success: true,
        isActive: true,
        user: req.user
      });
    }

    const status = await SessionManager.getSessionStatus(sessionId);
    if (!status.isActive) {
      clearSessionCookie(res, req);
      logger.warning('Session status check failed for session {SessionId}: Inactive ({Code})', {
        SessionId: sessionId,
        Code: status.code,
        Action: 'SessionStatusInactive',
        Subsystem: 'SessionManagement'
      });
      return res.status(401).json({
        success: false,
        isActive: false,
        code: status.code,
        error: status.messageEn,
        errorAr: status.messageAr,
        requiresRelogin: true
      });
    }

    res.json({
      success: true,
      isActive: true,
      sessionId,
      idleRemainingMs: status.idleRemainingMs,
      absoluteRemainingMs: status.absoluteRemainingMs
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify session status' });
  }
});

/**
 * User Change Password
 * Policy: Session Invalidation
 * The server explicitly destroys session tokens upon password change.
 * Invalidates previous sessions, creates a new session for the current client, and sets a fresh cookie.
 */
router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { newPassword, currentPassword } = req.body;
    const userUid = req.user?.uid;
    const userEmail = req.user?.email;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters in length.'
      });
    }

    const [user] = await db.select().from(users).where(eq(users.uid, userUid)).limit(1);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User record not found.' });
    }

    // Verify current password if provided
    if (currentPassword && user.passwordHash) {
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.status(400).json({ success: false, error: 'Current password does not match.' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db.update(users).set({
      passwordHash: newHash,
      mustChangePassword: false,
      passwordLastChangedAt: new Date()
    }).where(eq(users.uid, userUid)).returning();

    // Invalidate all existing sessions for this user due to password change
    await SessionManager.invalidateAllUserSessions(userUid, 'PASSWORD_CHANGE');

    // Create a new session for this computer
    const sessionInfo = await SessionManager.createSession(
      {
        uid: userUid,
        email: userEmail,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        userType: updatedUser.userType || undefined,
        department: updatedUser.department || undefined
      },
      req
    );

    // Set secure cookie
    setSessionCookie(res, req, sessionInfo.token);

    logger.information('Password changed by user {TargetUser}. All prior sessions invalidated, new session {NewSessionId} issued.', {
      TargetUser: userEmail,
      NewSessionId: sessionInfo.sessionId,
      Action: 'PasswordChange',
      Subsystem: 'SessionManagement'
    });

    res.json({
      success: true,
      token: sessionInfo.token,
      sessionId: sessionInfo.sessionId,
      user: {
        id: updatedUser.id,
        uid: updatedUser.uid,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        userType: updatedUser.userType,
        mustChangePassword: false
      }
    });
  } catch (error: any) {
    logger.error('Failed to change password for user: {Error}', { Error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
});

export default router;

