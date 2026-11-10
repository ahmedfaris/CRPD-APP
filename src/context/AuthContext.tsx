import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ApplicationUser, isUserTechnical } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { logger } from '../utils/logger';
import { verifyTOTPWithTolerance } from '../utils/totp';
import { apiFetch, safeParseJson, SessionInvalidationEventDetail } from '../utils/api';
import { SessionSecurityModal, SessionSecurityAlert } from '../components/SessionSecurityModal';

export const IDLE_TIMEOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const IDLE_WARNING_THRESHOLD_MS = 13 * 60 * 1000; // 13 minutes (2 min warning)

interface AuthContextType {
  currentUser: ApplicationUser | null;
  users: ApplicationUser[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isEmployee: boolean;
  isOperationalUser: boolean;
  isOperatorUser: boolean;
  isTechnicalUser: boolean;
  isSystemAdmin: boolean;
  canJoinTeams: boolean;
  canSolveTickets: boolean;
  
  // Login flow
  initiateLogin: (email: string, pass: string) => Promise<{
    success: boolean;
    error?: string;
    isLockedOut?: boolean;
    lockoutMinutes?: number;
    remainingMinutes?: number;
    lockoutCount?: number;
    periodEn?: string;
    periodAr?: string;
    messageEn?: string;
    messageAr?: string;
    failedAccessCount?: number;
    maxAttempts?: number;
    lockoutEnd?: string | null;
  }>;
  verify2FACode: (code: string) => Promise<{ success: boolean; error?: string }>;
  cancelPendingLogin: () => void;
  pendingUser: ApplicationUser | null;
  pending2FASecret: string | null;
  isFirstTime2FA: boolean;
  
  logout: (reason?: string) => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
  switchUser: (userId: string) => void;
  resetUser2FA: (userId: string) => void;
  adminCreateUser: (data: any) => Promise<{ success: boolean; error?: string }>;
  adminDeleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  adminUpdateUser: (userId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  rolesList: any[];
  userPermissions: string[];
  hasPermission: (permission: string) => boolean;
  canAccessApp: (app: 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices') => boolean;
  canAccessTeamManagement: boolean;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ApplicationUser | null>(null);
  const [users, setUsers] = useState<ApplicationUser[]>(INITIAL_USERS);

  // Security Alert Modal State
  const [securityModal, setSecurityModal] = useState<{
    isOpen: boolean;
    type: SessionSecurityAlert['type'];
    messageEn?: string;
    messageAr?: string;
    remainingSeconds?: number;
  }>({
    isOpen: false,
    type: 'IDLE_WARNING'
  });

  // Timers and Activity Tracking Ref
  const lastActivityRef = useRef<number>(Date.now());
  const idleWarningShownRef = useRef<boolean>(false);
  const currentUserRef = useRef<ApplicationUser | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Sync users list with backend
  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const dbUsers = data.data.map((u: any) => ({
            ...u,
            id: String(u.id ?? u.uid),
            uid: String(u.uid ?? u.id)
          }));
          setUsers(dbUsers);
        }
      }
    } catch (error) {
      console.error("Failed to load users from backend", error);
    }
  };

  const [rolesList, setRolesList] = useState<any[]>([]);

  const fetchRoles = async () => {
    try {
      const res = await apiFetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          setRolesList(data.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load roles in AuthContext', err);
    }
  };

  // Sync users and roles whenever an authenticated session is established
  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchRoles();
    }
  }, [currentUser?.id, currentUser?.uid]);

  // 1. Initial Session Check on App Load (Silently probes without triggering invalidation modals)
  useEffect(() => {
    const checkLocalSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await apiFetch('/api/auth/sync', {
            method: 'POST',
            skipSessionInvalidationEvent: true
          } as any);
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              setCurrentUser(data.data as ApplicationUser);
              lastActivityRef.current = Date.now();
              return;
            }
          } else {
            localStorage.removeItem('auth_token');
          }
        } catch (e) {
          console.error('Failed to validate session', e);
          localStorage.removeItem('auth_token');
        }
      }
    };
    
    checkLocalSession();
  }, []);

  // 2. Activity Tracking for Idle Timeout
  useEffect(() => {
    if (!currentUser) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      // If idle warning was active, auto-dismiss if user became active again
      if (idleWarningShownRef.current) {
        idleWarningShownRef.current = false;
        setSecurityModal(prev => prev.type === 'IDLE_WARNING' ? { ...prev, isOpen: false } : prev);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
    };
  }, [currentUser]);

  // 3. Idle Timeout Interval & Server Heartbeat (Detects Concurrent Logins & Inactivity)
  useEffect(() => {
    if (!currentUser) return;

    // Heartbeat check to server: verifies session status and enforces single computer policy
    const heartbeatInterval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/auth/session-status');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.code === 'CONCURRENT_LOGIN') {
            handleSessionInvalidation({
              code: 'CONCURRENT_LOGIN',
              error: data.error || 'Your session was terminated because your account was logged into from another computer.',
              errorAr: data.errorAr || 'تم إنهاء جلستك لتسجيل الدخول إلى حسابك من جهاز حاسوب أو متصفح آخر. يُسمح بجلسة نشطة واحدة فقط.'
            });
          } else if (data.code === 'IDLE_TIMEOUT') {
            handleSessionInvalidation({
              code: 'IDLE_TIMEOUT',
              error: data.error || 'Session timed out due to 15 minutes of inactivity.',
              errorAr: data.errorAr || 'انتهت جلستك بسبب عدم النشاط لمدة 15 دقيقة.'
            });
          } else if (data.code === 'PRIVILEGE_CHANGE' || data.code === 'PASSWORD_CHANGE' || data.code === 'ABSOLUTE_TIMEOUT') {
            handleSessionInvalidation({
              code: data.code,
              error: data.error,
              errorAr: data.errorAr
            });
          }
        }
      } catch (_) {
        // Transient network glitch, will retry next interval
      }
    }, 20000); // 20s heartbeat

    // Local Idle Timer Checker (every 1 second)
    const timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      // Check if 15 minutes idle timeout reached
      if (elapsed >= IDLE_TIMEOUT_DURATION_MS) {
        handleSessionInvalidation({
          code: 'IDLE_TIMEOUT',
          error: 'Your session has expired due to 15 minutes of inactivity (Idle Timeout). Please log in again.',
          errorAr: 'انتهت جلستك بسبب عدم النشاط لمدة 15 دقيقة (مهلة عدم النشاط). يرجى تسجيل الدخول مجدداً.'
        });
        return;
      }

      // Check if 13 minutes reached: show warning with countdown
      if (elapsed >= IDLE_WARNING_THRESHOLD_MS) {
        const remainingSec = Math.max(0, Math.floor((IDLE_TIMEOUT_DURATION_MS - elapsed) / 1000));
        idleWarningShownRef.current = true;
        setSecurityModal({
          isOpen: true,
          type: 'IDLE_WARNING',
          remainingSeconds: remainingSec,
          messageEn: 'You have been inactive. To safeguard your account, you will be logged out automatically in 2 minutes.',
          messageAr: 'لم يتم رصد أي نشاط منذ فترة. لحماية حسابك، سيتم تسجيل خروجك تلقائياً خلال دقيقتين.'
        });
      }
    }, 1000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(timerInterval);
    };
  }, [currentUser]);

  // 4. Global Event Listener for Session Invalidation
  useEffect(() => {
    const handleInvalidationEvent = (evt: Event) => {
      const customEvent = evt as CustomEvent<SessionInvalidationEventDetail>;
      if (customEvent.detail) {
        handleSessionInvalidation(customEvent.detail);
      }
    };

    window.addEventListener('auth:session_invalidated', handleInvalidationEvent);
    return () => {
      window.removeEventListener('auth:session_invalidated', handleInvalidationEvent);
    };
  }, []);

  const handleSessionInvalidation = (detail: {
    code: string;
    error?: string;
    errorAr?: string;
  }) => {
    // Check if there was actually an active logged-in user session
    const wasLoggedIn = Boolean(currentUserRef.current);

    // Clear local storage and current user
    localStorage.removeItem('auth_token');
    localStorage.removeItem('active_user_id');
    localStorage.removeItem('auth_user_cache');
    sessionStorage.removeItem('auth_token');
    setCurrentUser(null);
    setPendingUser(null);

    // If there was NO active logged-in user (e.g. user was already on login page or refreshed browser),
    // NEVER show a session timeout modal over the login page!
    if (!wasLoggedIn) {
      setSecurityModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // Only show modal for actual session termination events
    let modalType: SessionSecurityAlert['type'];
    if (detail.code === 'CONCURRENT_LOGIN') modalType = 'CONCURRENT_LOGIN';
    else if (detail.code === 'ABSOLUTE_TIMEOUT') modalType = 'ABSOLUTE_TIMEOUT';
    else if (detail.code === 'PRIVILEGE_CHANGE') modalType = 'PRIVILEGE_CHANGE';
    else if (detail.code === 'PASSWORD_CHANGE') modalType = 'PASSWORD_CHANGE';
    else if (detail.code === 'IDLE_TIMEOUT') modalType = 'IDLE_TIMEOUT';
    else {
      // Missing token, malformed token or generic 401: do not show idle timeout modal!
      setSecurityModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setSecurityModal({
      isOpen: true,
      type: modalType,
      messageEn: detail.error,
      messageAr: detail.errorAr
    });
  };

  const [pendingUser, setPendingUser] = useState<ApplicationUser | null>(null);
  const [pending2FASecret, setPending2FASecret] = useState<string | null>(null);
  // Signed, short-lived proof that the password step succeeded; required by /verify-2fa.
  const twoFactorChallengeRef = useRef<string | null>(null);
  const [isFirstTime2FA, setIsFirstTime2FA] = useState(false);

  const initiateLogin = async (email: string, pass: string) => {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
        skipSessionInvalidationEvent: true
      });

      const { ok, data } = await safeParseJson<any>(response);
      
      if (!ok) {
        return {
          success: false,
          error: data?.error || 'Invalid username or password.',
          isLockedOut: !!data?.isLockedOut,
          lockoutMinutes: data?.lockoutMinutes,
          remainingMinutes: data?.remainingMinutes,
          lockoutCount: data?.lockoutCount,
          periodEn: data?.periodEn,
          periodAr: data?.periodAr,
          messageEn: data?.messageEn,
          messageAr: data?.messageAr,
          failedAccessCount: data?.failedAccessCount,
          maxAttempts: data?.maxAttempts,
          lockoutEnd: data?.lockoutEnd
        };
      }

      // Handle 2FA logic
      if (data.requires2FA || (data.user && data.user.twoFactorEnabled)) {
        setPendingUser(data.user);
        setIsFirstTime2FA(!!data.isFirstTime2FA);
        setPending2FASecret(data.twoFactorSecret || null);
        twoFactorChallengeRef.current = data.challengeToken || null;
        return { success: true };
      }
      
      // Store JWT in local storage for fallback authorization header
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      lastActivityRef.current = Date.now();
      setCurrentUser(data.user);
      return { success: true };
    } catch (error: any) {
      console.error("Login failed", error);
      return { success: false, error: error?.message || "An unexpected network error occurred." };
    }
  };

  const verify2FACode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingUser) {
      return { success: false, error: 'No pending authentication session.' };
    }

    const cleanCode = code.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return { success: false, error: 'Please enter a valid 6-digit code from your authenticator app.' };
    }

    try {
      const response = await apiFetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          challengeToken: twoFactorChallengeRef.current
        }),
        skipSessionInvalidationEvent: true
      });

      const { ok, data } = await safeParseJson<any>(response);

      if (!ok || !data.success) {
        return {
          success: false,
          error: data?.error || 'Invalid authenticator code. Please check your authenticator app and try again.'
        };
      }

      // Store authenticated session
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      twoFactorChallengeRef.current = null;
      lastActivityRef.current = Date.now();
      setCurrentUser(data.user || pendingUser);
      setPendingUser(null);
      setPending2FASecret(null);
      setIsFirstTime2FA(false);

      if (data.user) {
        setUsers(prev => prev.map(u => u.email.toLowerCase() === data.user.email.toLowerCase() ? data.user : u));
      }

      return { success: true };
    } catch (err: any) {
      const secretToTest = pending2FASecret || pendingUser.twoFactorSecret;
      if (!secretToTest) {
        return { success: false, error: 'No 2FA secret found for this account.' };
      }

      const verification = verifyTOTPWithTolerance(cleanCode, secretToTest, 60, 30);
      if (!verification.valid) {
        return {
          success: false,
          error: 'Invalid authenticator code. Please check your authenticator app and try again.'
        };
      }

      const updatedUser = {
        ...pendingUser,
        twoFactorSecret: secretToTest,
        twoFactorEnabled: true
      };

      lastActivityRef.current = Date.now();
      setCurrentUser(updatedUser);
      setPendingUser(null);
      setPending2FASecret(null);
      setIsFirstTime2FA(false);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

      return { success: true };
    }
  };

  const cancelPendingLogin = () => {
    twoFactorChallengeRef.current = null;
    setPendingUser(null);
    setPending2FASecret(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user_cache');
  };

  /**
   * Explicitly destroy session on server and clear tokens
   */
  const logout = async (reason?: string) => {
    try {
      setSecurityModal(prev => ({ ...prev, isOpen: false }));

      // 1. Explicitly inform server to destroy session record and clear HttpOnly cookie
      await apiFetch('/api/auth/logout', { method: 'POST', skipSessionInvalidationEvent: true } as any).catch(() => {});

      // 2. Clear client storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('active_user_id');
      localStorage.removeItem('auth_user_cache');
      sessionStorage.removeItem('auth_token');

      // 3. Clear all React state
      setCurrentUser(null);
      setPendingUser(null);
      setPending2FASecret(null);
      setIsFirstTime2FA(false);

      logger.information('User logged out successfully ({Reason})', { Reason: reason || 'ManualLogout' });
    } catch (error) {
      console.error("Error during logout:", error);
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      setCurrentUser(null);
      setSecurityModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  /**
   * Change password: sends request to server, which invalidates all active sessions
   * and creates a fresh session for this device.
   */
  const changePassword = async (newPassword: string, currentPassword?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, currentPassword })
      });

      const { ok, data } = await safeParseJson<any>(res);
      if (!ok || !data?.success) {
        return { success: false, error: data?.error || 'Failed to update password.' };
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      if (data.user) {
        setCurrentUser(prev => prev ? { ...prev, ...data.user, mustChangePassword: false } : data.user);
      }

      lastActivityRef.current = Date.now();
      logger.information('Password successfully updated and session refreshed.');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'An unexpected error occurred.' };
    }
  };

  const switchUser = (userId: string) => {
    const target = users.find((u) => u.id === userId || u.uid === userId) || INITIAL_USERS.find((u) => u.id === userId || u.uid === userId);
    if (target) {
      setCurrentUser(target);
      lastActivityRef.current = Date.now();
      try {
        localStorage.setItem('active_user_id', String(target.id));
        localStorage.setItem('auth_user_cache', JSON.stringify(target));
      } catch (_) {}
      logger.information('Switched active user to {UserEmail} ({Role})', {
        UserEmail: target.email,
        Role: target.role,
      });
    }
  };

  const resetUser2FA = async (userId: string) => {
    try {
      await apiFetch('/api/auth/reset-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    } catch (e) {
      console.warn("Backend reset 2FA call error:", e);
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId || u.uid === userId ? { ...u, twoFactorSecret: undefined, hasTwoFactorSecret: false } : u))
    );
    if (currentUser?.id === userId || currentUser?.uid === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, twoFactorSecret: undefined } : null));
    }
    logger.information('Reset 2FA credentials for user {UserId}', { UserId: userId });
  };

  const adminCreateUser = async (data: any) => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await fetchUsers();
        await fetchRoles();
        return { success: true };
      }
      const err = await res.json();
      return { success: false, error: err.error || 'Failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed' };
    }
  };

  const adminDeleteUser = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchUsers();
        return { success: true };
      }
      return { success: false, error: 'Failed' };
    } catch (error) {
      return { success: false, error: 'Failed' };
    }
  };

  const adminUpdateUser = async (userId: string, updates: any) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const updatedUser = data.data;
        setUsers(prev => prev.map(u => {
          if (String(u.id) === String(userId) || u.uid === userId || (updatedUser && (String(u.id) === String(updatedUser.id) || u.email === updatedUser.email))) {
            return { ...u, ...updates, ...(updatedUser || {}) };
          }
          return u;
        }));
        if (currentUser && (String(currentUser.id) === String(userId) || currentUser.uid === userId || (updatedUser && currentUser.email === updatedUser.email))) {
          const newCurrent = { ...currentUser, ...updates, ...(updatedUser || {}) };
          setCurrentUser(newCurrent);
          try {
            localStorage.setItem('auth_user_cache', JSON.stringify(newCurrent));
          } catch (_) {}
        }
        await fetchUsers();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to update user' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update user' };
    }
  };

  const isAdmin = Boolean(
    currentUser?.email?.toLowerCase() === 'admin@system.local' ||
    currentUser?.role?.toLowerCase() === 'admin' ||
    currentUser?.role?.toLowerCase() === 'administrator' ||
    currentUser?.role?.toLowerCase() === 'system admin' ||
    currentUser?.userType?.toLowerCase() === 'system admin'
  );
  const isTechnicalUser = Boolean(isUserTechnical(currentUser) || isAdmin);
  const isAgent = isTechnicalUser;
  const isEmployee = Boolean(currentUser?.role === 'Employee' || isAgent);
  const isOperatorUser = Boolean(!isTechnicalUser && !isAdmin);
  const isOperationalUser = isOperatorUser;
  const isSystemAdmin = isAdmin;

  // Technical users can join tickets teams and solve tickets. Operators cannot join teams or solve tickets.
  const canJoinTeams = isTechnicalUser;
  const canSolveTickets = isTechnicalUser;

  // Compute active user permissions from their assigned role in rolesList or attached rolePermissions
  const userRoleObj = rolesList.find(r => r.name?.trim().toLowerCase() === currentUser?.role?.trim().toLowerCase());
  const userPermissions: string[] = 
    isAdmin 
      ? ['*']
      : userRoleObj && Array.isArray(userRoleObj.permissions)
        ? userRoleObj.permissions
        : (currentUser as any)?.rolePermissions && Array.isArray((currentUser as any).rolePermissions)
          ? (currentUser as any).rolePermissions
          : [];

  /**
   * Application-Level Access Gate: Checks if user has permission to access an application module
   */
  const canAccessApp = (app: 'tickets' | 'archiving' | 'employees' | 'policy' | 'org-structure' | 'devices'): boolean => {
    if (!currentUser) return false;
    // Admins have unrestricted access to all applications
    if (isAdmin) return true;

    // Wildcard permission grants full application access
    if (userPermissions.includes('*')) return true;

    switch (app) {
      case 'tickets':
        return isTechnicalUser || userPermissions.some(p => 
          p.startsWith('Ticket Management') || 
          p.startsWith('tickets.') ||
          p === 'tickets.manage' ||
          p === 'tickets.read' ||
          p === 'tickets.create' ||
          p === 'tickets.read_own'
        );

      case 'archiving':
        return userPermissions.some(p => 
          p.startsWith('Electronic Archiving') || 
          p.startsWith('archiving.') ||
          p === 'archiving.read' ||
          p === 'archiving.admin'
        );

      case 'employees':
        return userPermissions.some(p => 
          p.startsWith('Employee Management') || 
          p.startsWith('employees.')
        );

      case 'policy':
        return userPermissions.some(p => 
          p.startsWith('User & Role Management') || 
          p.startsWith('Identity & Access Policy') || 
          p.startsWith('roles.') ||
          p === 'roles.manage' ||
          p.startsWith('policy.')
        );

      case 'org-structure':
        return userPermissions.some(p => 
          p.startsWith('Organization Structure') || 
          p.startsWith('org.')
        );

      case 'devices':
        return isTechnicalUser || userPermissions.some(p => 
          p.startsWith('Asset Management') || 
          p.startsWith('Electronic Device Management') || 
          p.startsWith('devices.') ||
          p.startsWith('assets.')
        );

      default:
        return false;
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    // Admins have full access
    if (isAdmin) return true;

    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      return true;
    }

    const [domain, action = 'View'] = permission.split('.');
    if (domain && (userPermissions.includes(`${domain}.*`) || userPermissions.includes(domain))) {
      return true;
    }

    // Dynamic Team Management permission resolution
    if (domain === 'Team Management') {
      if (userPermissions.includes(`Team Management.${action}`)) return true;
      if (userPermissions.includes('Team Management.*') || userPermissions.includes('Team Management')) return true;
      if (action === 'View' && (
        userPermissions.includes('tickets.manage') || 
        userPermissions.includes('teams.manage') || 
        userPermissions.includes('tickets.read')
      )) {
        return true;
      }
      if ((action === 'Create' || action === 'Edit' || action === 'Delete') && (
        userPermissions.includes('tickets.manage') || 
        userPermissions.includes('teams.manage')
      )) {
        return true;
      }
    }

    // Dynamic Ticket Management action resolution
    if (domain === 'Ticket Management') {
      if (action === 'View' && (userPermissions.includes('tickets.read') || userPermissions.includes('tickets.read_own') || userPermissions.includes('tickets.manage'))) return true;
      if (action === 'Create' && (userPermissions.includes('tickets.create') || userPermissions.includes('tickets.manage'))) return true;
      if ((action === 'Edit' || action === 'Delete') && userPermissions.includes('tickets.manage')) return true;
    }

    // Dynamic Electronic Archiving action resolution
    if (domain === 'Electronic Archiving') {
      if (action === 'View' && (userPermissions.includes('archiving.read') || userPermissions.includes('archiving.admin'))) return true;
      if ((action === 'Create' || action === 'Edit' || action === 'Delete') && userPermissions.includes('archiving.admin')) return true;
    }

    // Dynamic Employee Management action resolution
    if (domain === 'Employee Management') {
      if (userPermissions.includes(`Employee Management.${action}`)) return true;
      if (userPermissions.includes('Employee Management.*') || userPermissions.includes('Employee Management')) return true;
      if (action === 'View' && (userPermissions.includes('employees.read') || userPermissions.includes('employees.manage'))) return true;
      if (action === 'Create' && (userPermissions.includes('employees.create') || userPermissions.includes('employees.manage'))) return true;
      if (action === 'Edit' && (userPermissions.includes('employees.update') || userPermissions.includes('employees.manage'))) return true;
      if (action === 'Delete' && (userPermissions.includes('employees.delete') || userPermissions.includes('employees.manage'))) return true;
    }

    // Dynamic User & Role Management action resolution
    if (domain === 'User & Role Management' || domain === 'Identity & Access Policy') {
      if (userPermissions.includes(`${domain}.${action}`)) return true;
      if (userPermissions.includes(`${domain}.*`) || userPermissions.includes(domain)) return true;
      if (action === 'View' && (userPermissions.includes('users.read') || userPermissions.includes('users.manage') || userPermissions.includes('roles.manage'))) return true;
      if (action === 'Create' && (userPermissions.includes('users.create') || userPermissions.includes('users.manage') || userPermissions.includes('roles.manage'))) return true;
      if (action === 'Edit' && (userPermissions.includes('users.update') || userPermissions.includes('users.manage') || userPermissions.includes('roles.manage'))) return true;
      if (action === 'Delete' && (userPermissions.includes('users.delete') || userPermissions.includes('users.manage') || userPermissions.includes('roles.manage'))) return true;
    }

    // Dynamic Organization Structure action resolution
    if (domain === 'Organization Structure') {
      if (userPermissions.includes(`Organization Structure.${action}`)) return true;
      if (userPermissions.includes('Organization Structure.*') || userPermissions.includes('Organization Structure')) return true;
      if (action === 'View' && (userPermissions.includes('org.read') || userPermissions.includes('org.manage'))) return true;
      if ((action === 'Create' || action === 'Edit' || action === 'Delete') && (userPermissions.includes('org.manage') || userPermissions.includes('org.update'))) return true;
    }

    // Dynamic Asset Management action resolution
    if (domain === 'Asset Management' || domain === 'Electronic Device Management') {
      if (userPermissions.includes(`${domain}.${action}`)) return true;
      if (userPermissions.includes(`${domain}.*`) || userPermissions.includes(domain)) return true;
      if (action === 'View' && (userPermissions.includes('devices.read') || userPermissions.includes('assets.read'))) return true;
      if ((action === 'Create' || action === 'Edit' || action === 'Delete') && (userPermissions.includes('devices.manage') || userPermissions.includes('assets.manage'))) return true;
    }

    return false;
  };

  const canAccessTeamManagement = hasPermission('Team Management.View');

  const handleStayLoggedIn = async () => {
    lastActivityRef.current = Date.now();
    idleWarningShownRef.current = false;
    setSecurityModal(prev => ({ ...prev, isOpen: false }));
    // Touch server session
    await apiFetch('/api/auth/session-status').catch(() => {});
  };

  const handleConfirmSecurityRelogin = () => {
    setSecurityModal(prev => ({ ...prev, isOpen: false }));
    logout('security_relogin_confirmed');
  };

  return (
    <AuthContext.Provider value={{
      currentUser, users, isAuthenticated: !!currentUser, isAdmin, isAgent, isEmployee,
      isOperationalUser, isOperatorUser, isTechnicalUser, isSystemAdmin,
      canJoinTeams, canSolveTickets,
      rolesList, userPermissions, hasPermission, canAccessApp, canAccessTeamManagement, refreshRoles: fetchRoles,
      initiateLogin, logout, changePassword, switchUser, resetUser2FA,
      adminCreateUser, adminDeleteUser, adminUpdateUser,
      verify2FACode, cancelPendingLogin, pendingUser, pending2FASecret, isFirstTime2FA
    }}>
      {children}

      {/* Global Enterprise Session Security & Inactivity Alert Modal */}
      <SessionSecurityModal
        isOpen={securityModal.isOpen && Boolean(currentUser)}
        type={securityModal.type}
        messageEn={securityModal.messageEn}
        messageAr={securityModal.messageAr}
        remainingSeconds={securityModal.remainingSeconds}
        onStayLoggedIn={handleStayLoggedIn}
        onConfirm={handleConfirmSecurityRelogin}
      />
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be within provider");
  return context;
};
