// src/server/controllers/userController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { SessionManager } from '../services/sessionManager.ts';
import { UserModel } from '../models/userModel.ts';
import { TicketModel } from '../models/ticketModel.ts';
import { isUserTechnical } from '../../types.ts';
import { toPublicUser } from '../utils/publicUser.ts';
import {
  actorIsAdmin, isAdminAccount, isAdminLevelRole, roleExists, findUserRow,
  countAdminAccounts, isLoginTaken, passwordPolicyError
} from '../utils/userAdmin.ts';

const forbidden = (res: Response, error: string) => res.status(403).json({ success: false, error, code: 'FORBIDDEN' });

const colors = [
  'bg-blue-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600',
  'bg-indigo-600', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-violet-600'
];

export class UserController {
  
  // GET /api/users
  static async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const allUsers = await UserModel.getAllUsers();
      res.status(200).json({ success: true, data: allUsers.map((u) => toPublicUser(u)) });
    } catch (error: any) {
      console.error('UserController.getAllUsers error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  }

  // POST /api/users
  static async createUser(req: AuthRequest, res: Response) {
    try {
      const userData = req.body;
      
      // If email is not passed but userName is provided in email format, use it
      if (!userData.email && userData.userName) {
        userData.email = userData.userName.trim();
      }

      if (!userData.email || !userData.fullName || !userData.initialPassword) {
        return res.status(400).json({ success: false, error: 'Email, full name, and password are required.' });
      }

      // Validate account name format: English only and email format
      if (userData.userName) {
        const englishEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!englishEmailRegex.test(userData.userName.trim())) {
          return res.status(400).json({ 
            success: false, 
            error: 'اسم الحساب يجب أن يكون باللغة الإنكليزية فقط وبصيغة بريد إلكتروني صالح (e.g. user@domain.com).' 
          });
        }
      }

      // Check if user already exists (email or user name, case-insensitive)
      const existingUser = await UserModel.getUserByEmail(userData.email);
      if (existingUser || await isLoginTaken(userData.email) || (userData.userName && await isLoginTaken(userData.userName))) {
        return res.status(400).json({ success: false, error: 'User with this email already exists.' });
      }

      const policyError = passwordPolicyError(userData.initialPassword);
      if (policyError) {
        return res.status(400).json({ success: false, error: policyError });
      }

      const requestedRole = userData.role || 'Employee';
      if (!(await roleExists(requestedRole))) {
        return res.status(400).json({ success: false, error: `Role '${requestedRole}' does not exist.` });
      }

      // Only admins may create admin-level accounts.
      const wantsAdmin = (await isAdminLevelRole(requestedRole)) || String(userData.userType || '').toLowerCase() === 'system admin';
      if (wantsAdmin && !(await actorIsAdmin(req))) {
        return forbidden(res, 'Only administrators can create administrator accounts.');
      }

      // Determine user type: explicitly passed from form, or inferred from role
      let userType = userData.userType;
      if (!userType) {
        const r = (userData.role || '').toLowerCase();
        if (r === 'admin' || r === 'administrator') {
          userType = 'System Admin';
        } else if (r === 'agent' || r === 'helpdesk agent') {
          userType = 'Technical';
        } else {
          userType = 'Operator';
        }
      }

      // 1. Generate an unguessable user ID (accounts live only in this app's database)
      const crypto = await import('crypto');
      const uid = 'usr_' + Date.now().toString() + '_' + crypto.randomBytes(6).toString('hex');

      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(userData.initialPassword, 10);

      // 2. Create user in database via UserModel
      const newUser = await UserModel.createUser({
        uid: uid,
        userName: userData.userName || userData.email.split('@')[0],
        email: userData.email.trim().toLowerCase(),
        emailConfirmed: true,
        fullName: userData.fullName,
        department: userData.department || 'Unassigned',
        phone: userData.phone || '',
        jobTitle: userData.jobTitle || 'Employee',
        role: userData.role || 'Employee',
        userType: userType, // Store explicit User Type!
        twoFactorEnabled: userData.twoFactorEnabled ?? true,
        passwordHash: passwordHash,
        avatarColor: randomColor
      });

      // If technical user, automatically register to the technical support team
      if (isUserTechnical(newUser)) {
        try {
          if (newUser.id) await TicketModel.assignUserToTeam('tech-team', String(newUser.id));
          if (newUser.uid) await TicketModel.assignUserToTeam('tech-team', String(newUser.uid));
        } catch (_) {}
      }

      logger.information('User created: {TargetUser} ({UserType}) by {AdminUser}', {
        TargetUser: newUser.email,
        UserType: newUser.userType,
        AdminUser: req.user?.name || req.user?.email || 'System',
        Action: 'CreateUser'
      });
      res.status(201).json({ success: true, data: toPublicUser(newUser) });
    } catch (error: any) {
      console.error('UserController.createUser error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create user' });
    }
  }

  // DELETE /api/users/:uid
  static async deleteUser(req: AuthRequest, res: Response) {
    try {
      const target = await findUserRow(String(req.params.id));
      if (!target) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      if (target.uid === req.user?.uid) {
        return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
      }
      if (await isAdminAccount(target)) {
        if (!(await actorIsAdmin(req))) {
          return forbidden(res, 'Only administrators can delete administrator accounts.');
        }
        if ((await countAdminAccounts(target.uid)) === 0) {
          return res.status(400).json({ success: false, error: 'The last administrator account cannot be deleted.' });
        }
      }

      await UserModel.deleteUser(target.uid);

      // Sign the deleted user out everywhere (by their real uid, whatever id the URL used)
      await SessionManager.invalidateAllUserSessions(target.uid, 'ADMIN_REVOKED');
      logger.information('User deleted: {TargetUser} ({TargetUID}) by {AdminUser}', {
        TargetUser: target.email,
        TargetUID: target.uid,
        AdminUser: req.user?.name || req.user?.email || 'System',
        Action: 'DeleteUser'
      });
      res.status(200).json({ success: true });
    } catch (error: any) {
      const code = error?.code || error?.cause?.code;
      if (code === '23503') {
        return res.status(409).json({
          success: false,
          error: 'This user is still referenced (for example as a department manager or role creator). Reassign those first, or lock the account instead.'
        });
      }
      console.error('UserController.deleteUser error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  }

  // PATCH /api/users/:uid
  static async updateUser(req: AuthRequest, res: Response) {
    try {
      const target = await findUserRow(String(req.params.id));
      if (!target) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      const uid = target.uid;
      const updates = { ...req.body };

      // Credentials and identity are never written directly from the request.
      delete updates.passwordHash;
      delete updates.passwordLastChangedAt;
      delete updates.lastActiveAt;
      if (updates.twoFactorSecret !== undefined && updates.twoFactorSecret !== null) {
        delete updates.twoFactorSecret; // only clearing (reset) is allowed
      }

      const isAdmin = await actorIsAdmin(req);
      const isSelf = target.uid === req.user?.uid;
      const changesRole = updates.role !== undefined && String(updates.role) !== String(target.role || '');
      const changesType = updates.userType !== undefined && String(updates.userType) !== String(target.userType || '');

      if (!isAdmin && (await isAdminAccount(target)) && !isSelf) {
        return forbidden(res, 'Only administrators can modify administrator accounts.');
      }
      if (isSelf && (changesRole || changesType)) {
        return forbidden(res, 'You cannot change your own role or user type.');
      }
      if (changesRole && !(await roleExists(updates.role))) {
        return res.status(400).json({ success: false, error: `Role '${updates.role}' does not exist.` });
      }
      const grantsAdmin = (changesRole && await isAdminLevelRole(updates.role)) ||
        (changesType && String(updates.userType).toLowerCase() === 'system admin');
      if (grantsAdmin && !isAdmin) {
        return forbidden(res, 'Only administrators can grant administrator access.');
      }
      // Never demote or lock the last remaining administrator.
      const demotes = (changesRole || changesType) && (await isAdminAccount(target)) &&
        !(await isAdminAccount({ ...target, role: updates.role ?? target.role, userType: updates.userType ?? target.userType }));
      if ((demotes || updates.isLockedOut === true) && (await isAdminAccount(target)) && (await countAdminAccounts(target.uid)) === 0) {
        return res.status(400).json({ success: false, error: 'The last administrator account cannot be demoted or locked.' });
      }
      if (updates.email !== undefined) {
        if (!updates.email || await isLoginTaken(updates.email, target.uid)) {
          return res.status(400).json({ success: false, error: 'This email is already used by another account.' });
        }
      }
      if (updates.userName !== undefined && updates.userName && await isLoginTaken(updates.userName, target.uid)) {
        return res.status(400).json({ success: false, error: 'This account name is already used by another account.' });
      }
      if (updates.password !== undefined) {
        const policyError = passwordPolicyError(updates.password);
        if (policyError) {
          return res.status(400).json({ success: false, error: policyError });
        }
      }

      if (updates.isLockedOut === false) {
        updates.lockoutEnd = null;
        updates.failedAccessCount = 0;
        updates.lockoutCount = 0;
      }

      if (updates.reset2FASecret) {
        updates.twoFactorSecret = null;
        delete updates.reset2FASecret;
      }

      if (updates.password) {
        const bcrypt = await import('bcrypt');
        updates.passwordHash = await bcrypt.hash(updates.password, 10);
        updates.passwordLastChangedAt = new Date();
        delete updates.password;
      }

      if (updates.email) {
        updates.email = updates.email.trim().toLowerCase();
      }

      // Strip keys that shouldn't be directly overwritten
      delete updates.id;
      delete updates.uid;
      delete updates.createdAt;
      delete updates.confirmPassword;

      const adminEmail = req.user?.email || 'System';

      // Delegate update to UserModel
      const updated = await UserModel.updateUser(uid, updates);

      if (updated) {
        // Evaluate what was updated to generate meaningful Serilog events
        if (updates.passwordMinLength !== undefined || updates.passwordRequireSpecial !== undefined) {
          logger.information('Password policy updated for user {TargetUser} by {AdminUser}', {
            TargetUser: updated.email,
            AdminUser: adminEmail,
            Action: 'UpdatePasswordPolicy',
            MinLength: updated.passwordMinLength,
            RequireSpecial: updated.passwordRequireSpecial
          });
        }
        
        if (updates.twoFactorEnabled !== undefined) {
          logger.information('2FA status changed to {TwoFactorStatus} for user {TargetUser} by {AdminUser}', {
            TargetUser: updated.email,
            AdminUser: adminEmail,
            Action: 'Toggle2FA',
            TwoFactorStatus: updates.twoFactorEnabled ? 'Enabled' : 'Disabled'
          });
        }

        if (updates.twoFactorSecret === null) {
          logger.information('2FA secret reset for user {TargetUser} by {AdminUser}', {
            TargetUser: updated.email,
            AdminUser: adminEmail,
            Action: 'Reset2FASecret'
          });
        }

        if (updates.isLockedOut === false && updates.failedAccessCount === 0) {
          logger.warning('Account unlocked for user {TargetUser} by {AdminUser}', {
            TargetUser: updated.email,
            AdminUser: adminEmail,
            Action: 'UnlockAccount'
          });
        }

        // POLICY: Session Invalidation on Privilege Change
        if (updates.role !== undefined || updates.userType !== undefined) {
          await SessionManager.invalidateAllUserSessions(updated.uid, 'PRIVILEGE_CHANGE');
          logger.warning('Security privilege changed for user {TargetUser} ({NewRole}, {NewUserType}): all active sessions invalidated', {
            TargetUser: updated.email,
            NewRole: updates.role || updated.role,
            NewUserType: updates.userType || updated.userType,
            AdminUser: adminEmail,
            Action: 'PrivilegeChangeSessionInvalidation',
            Subsystem: 'SessionManagement'
          });
        }

        // POLICY: a locked account loses its active sessions immediately
        if (updates.isLockedOut === true) {
          await SessionManager.invalidateAllUserSessions(uid, 'ADMIN_REVOKED');
        }

        // POLICY: Session Invalidation on Password Change
        if (updates.passwordHash !== undefined) {
          await SessionManager.invalidateAllUserSessions(uid, 'PASSWORD_CHANGE');
          logger.warning('Password changed for user {TargetUser}: all active sessions invalidated', {
            TargetUser: updated.email,
            AdminUser: adminEmail,
            Action: 'PasswordChangeSessionInvalidation',
            Subsystem: 'SessionManagement'
          });
        }

        logger.information('User profile edited: {TargetUser} by {AdminUser}', {
          TargetUser: updated.email,
          AdminUser: adminEmail,
          Action: 'EditUser'
        });
        res.status(200).json({ success: true, data: toPublicUser(updated) });
      } else {
        res.status(404).json({ success: false, error: 'User not found.' });
      }
    } catch (error: any) {
      logger.error('Failed to update user {TargetUser}: {ErrorMessage}', {
        TargetUser: req.params.id,
        ErrorMessage: error.message,
        Action: 'UpdateUserFailed'
      });
      res.status(500).json({ success: false, error: 'Failed to update user' });
    }
  }
}
