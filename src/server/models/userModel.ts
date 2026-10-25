// src/server/models/userModel.ts
import { db } from '../../db/index.ts';
import { users, roles } from '../../db/schema.ts';
import { eq, or, desc } from 'drizzle-orm';
import { ApplicationUser, UserType } from '../../types.ts';
import { db as mockDb } from '../db/mockDb.ts';

// The MODEL layer (M in MVC) handles direct database interactions and domain logic for Users.

export interface CreateUserInput {
  uid?: string;
  userName?: string;
  email: string;
  emailConfirmed?: boolean;
  fullName: string;
  department?: string;
  jobTitle?: string;
  role?: string;
  userType?: UserType | string;
  phone?: string;
  passwordHash?: string;
  avatarColor?: string;
  twoFactorEnabled?: boolean;
  mustChangePassword?: boolean;
}

export class UserModel {
  /**
   * Helper to format a DB row into ApplicationUser domain object
   */
  private static formatUser(row: any, rolePermissions?: string[]): ApplicationUser {
    let effectivePerms = rolePermissions || row.rolePermissions || [];
    const r = (row.role || '').toLowerCase();
    if (r === 'admin' || r === 'administrator' || (row.email && row.email.toLowerCase() === 'admin@system.local')) {
      if (!effectivePerms.includes('*')) {
        effectivePerms = ['*', ...effectivePerms];
      }
    }

    return {
      id: String(row.id ?? row.uid),
      uid: String(row.uid ?? row.id),
      userName: row.userName || row.email,
      email: row.email,
      emailConfirmed: Boolean(row.emailConfirmed),
      fullName: row.fullName || 'User',
      department: row.department || 'Unassigned',
      jobTitle: row.jobTitle || 'Employee',
      role: row.role || 'Employee',
      userType: (row.userType as UserType) || 'Operator',
      failedAccessCount: row.failedAccessCount ?? 0,
      lockoutEnd: row.lockoutEnd || null,
      isLockedOut: Boolean(row.isLockedOut),
      lockoutCount: row.lockoutCount ?? 0,
      mustChangePassword: Boolean(row.mustChangePassword),
      twoFactorEnabled: Boolean(row.twoFactorEnabled),
      twoFactorSecret: row.twoFactorSecret || undefined,
      passwordHash: row.passwordHash || undefined,
      passwordMinLength: row.passwordMinLength ?? 8,
      passwordRequireSpecial: Boolean(row.passwordRequireSpecial),
      passwordRequireNumber: Boolean(row.passwordRequireNumber),
      passwordRequireUppercase: Boolean(row.passwordRequireUppercase),
      passwordRequireLowercase: Boolean(row.passwordRequireLowercase),
      passwordLastChangedAt: row.passwordLastChangedAt ? new Date(row.passwordLastChangedAt).toISOString() : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : new Date().toISOString(),
      avatarColor: row.avatarColor || 'bg-blue-600',
      phone: row.phone || '',
      rolePermissions: effectivePerms
    };
  }

  /**
   * Fetch all users from PostgreSQL TicketManagementDB
   */
  static async getAllUsers(): Promise<ApplicationUser[]> {
    try {
      const [rows, allRoles] = await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)),
        db.select().from(roles)
      ]);
      return rows.map((r: any) => {
        const roleMatch = allRoles.find((role: any) => role.name?.trim().toLowerCase() === (r.role || '').trim().toLowerCase());
        const perms = roleMatch && Array.isArray(roleMatch.permissions) ? roleMatch.permissions : [];
        return UserModel.formatUser(r, perms);
      });
    } catch (err) {
      console.warn('UserModel.getAllUsers DB error, falling back to mockDb:', err);
      return mockDb.getUsers();
    }
  }

  /**
   * Find a user by id, uid, email, or account username
   */
  static async getUserById(idOrUid: string): Promise<ApplicationUser | null> {
    try {
      const isNum = !isNaN(Number(idOrUid));
      const condition = isNum
        ? or(eq(users.id, Number(idOrUid)), eq(users.uid, idOrUid), eq(users.email, idOrUid))
        : or(eq(users.uid, idOrUid), eq(users.email, idOrUid), eq(users.userName, idOrUid));

      const rows = await db.select().from(users).where(condition).limit(1);
      if (rows && rows[0]) {
        const allRoles = await db.select().from(roles);
        const roleMatch = allRoles.find((role: any) => role.name?.trim().toLowerCase() === (rows[0].role || '').trim().toLowerCase());
        const perms = roleMatch && Array.isArray(roleMatch.permissions) ? roleMatch.permissions : [];
        return UserModel.formatUser(rows[0], perms);
      }
      return null;
    } catch (err) {
      console.warn('UserModel.getUserById error, falling back to mockDb:', err);
      const found = mockDb.getUserById(idOrUid);
      return found || null;
    }
  }

  /**
   * Find a user by email address
   */
  static async getUserByEmail(email: string): Promise<ApplicationUser | null> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const rows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (rows && rows[0]) {
        const allRoles = await db.select().from(roles);
        const roleMatch = allRoles.find((role: any) => role.name?.trim().toLowerCase() === (rows[0].role || '').trim().toLowerCase());
        const perms = roleMatch && Array.isArray(roleMatch.permissions) ? roleMatch.permissions : [];
        return UserModel.formatUser(rows[0], perms);
      }
      return null;
    } catch (err) {
      console.warn('UserModel.getUserByEmail error, falling back to mockDb:', err);
      const found = mockDb.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
      return found || null;
    }
  }

  /**
   * Insert a new user into the database with explicit userType
   */
  static async createUser(data: CreateUserInput): Promise<ApplicationUser> {
    const cleanEmail = data.email.trim().toLowerCase();
    const effectiveUserType = data.userType || (
      data.role === 'Admin' || data.role === 'Administrator' ? 'System Admin' :
      data.role === 'Agent' || data.role === 'Helpdesk Agent' ? 'Technical' : 'Operator'
    );

    const valuesToInsert = {
      uid: data.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userName: data.userName || cleanEmail.split('@')[0],
      email: cleanEmail,
      emailConfirmed: data.emailConfirmed ?? true,
      fullName: data.fullName,
      department: data.department || 'IT Service Desk',
      phone: data.phone || '',
      jobTitle: data.jobTitle || data.role || 'Employee',
      role: data.role || 'Employee',
      userType: effectiveUserType,
      failedAccessCount: 0,
      isLockedOut: false,
      mustChangePassword: data.mustChangePassword ?? true,
      twoFactorEnabled: data.twoFactorEnabled ?? true,
      passwordHash: data.passwordHash || null,
      avatarColor: data.avatarColor || 'bg-blue-600',
      createdAt: new Date(),
      lastActiveAt: new Date()
    };

    try {
      const [inserted] = await db.insert(users).values(valuesToInsert).returning();
      const allRoles = await db.select().from(roles);
      const roleMatch = allRoles.find((role: any) => role.name?.trim().toLowerCase() === (inserted.role || '').trim().toLowerCase());
      const perms = roleMatch && Array.isArray(roleMatch.permissions) ? roleMatch.permissions : [];
      const formatted = UserModel.formatUser(inserted, perms);
      mockDb.createUser(formatted);
      return formatted;
    } catch (err) {
      console.warn('UserModel.createUser DB insert failed, falling back to mockDb:', err);
      const fallbackUser: ApplicationUser = {
        id: valuesToInsert.uid,
        uid: valuesToInsert.uid,
        userName: valuesToInsert.userName,
        email: valuesToInsert.email,
        emailConfirmed: true,
        fullName: valuesToInsert.fullName,
        department: valuesToInsert.department,
        jobTitle: valuesToInsert.jobTitle,
        role: valuesToInsert.role,
        userType: valuesToInsert.userType as UserType,
        failedAccessCount: 0,
        lockoutEnd: null,
        isLockedOut: false,
        mustChangePassword: true,
        twoFactorEnabled: valuesToInsert.twoFactorEnabled,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        avatarColor: valuesToInsert.avatarColor,
        phone: valuesToInsert.phone,
        rolePermissions: []
      };
      mockDb.createUser(fallbackUser);
      return fallbackUser;
    }
  }

  /**
   * Update an existing user in the database
   */
  static async updateUser(idOrUid: string, updates: Record<string, any>): Promise<ApplicationUser | null> {
    try {
      const isNum = !isNaN(Number(idOrUid));
      const condition = isNum
        ? or(eq(users.id, Number(idOrUid)), eq(users.uid, idOrUid), eq(users.email, idOrUid))
        : or(eq(users.uid, idOrUid), eq(users.email, idOrUid), eq(users.userName, idOrUid));

      // Filter only valid columns
      const allowedColumns = new Set([
        'userName', 'email', 'emailConfirmed', 'fullName', 'department', 'jobTitle',
        'role', 'userType', 'failedAccessCount', 'lockoutEnd', 'isLockedOut',
        'lockoutCount', 'mustChangePassword', 'twoFactorEnabled', 'twoFactorSecret',
        'passwordHash', 'passwordMinLength', 'passwordRequireSpecial', 'passwordRequireNumber',
        'passwordRequireUppercase', 'passwordRequireLowercase', 'passwordLastChangedAt',
        'avatarColor', 'phone', 'lastActiveAt'
      ]);

      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(updates)) {
        if (allowedColumns.has(key)) {
          sanitized[key] = val;
        }
      }

      // Check existing row
      let existingRows = await db.select().from(users).where(condition).limit(1);
      if (!existingRows[0] && updates.email) {
        existingRows = await db.select().from(users).where(eq(users.email, updates.email)).limit(1);
      }

      if (existingRows[0]) {
        const targetId = existingRows[0].id;
        const [updatedRow] = await db.update(users).set(sanitized).where(eq(users.id, targetId)).returning();
        const allRoles = await db.select().from(roles);
        const roleMatch = allRoles.find((role: any) => role.name?.trim().toLowerCase() === (updatedRow.role || '').trim().toLowerCase());
        const perms = roleMatch && Array.isArray(roleMatch.permissions) ? roleMatch.permissions : [];
        const formatted = UserModel.formatUser(updatedRow, perms);
        mockDb.updateUser(String(targetId), formatted);
        return formatted;
      } else {
        // If not found, create it
        const created = await UserModel.createUser({
          uid: idOrUid,
          email: updates.email || `${idOrUid}@system.local`,
          fullName: updates.fullName || 'User',
          department: updates.department,
          role: updates.role,
          userType: updates.userType,
          ...sanitized
        });
        return created;
      }
    } catch (err) {
      console.warn('UserModel.updateUser DB error, updating mockDb:', err);
      const updatedMock = mockDb.updateUser(idOrUid, updates as any);
      return updatedMock || null;
    }
  }

  /**
   * Delete a user from the database
   */
  static async deleteUser(idOrUid: string): Promise<boolean> {
    try {
      const isNum = !isNaN(Number(idOrUid));
      const condition = isNum
        ? or(eq(users.id, Number(idOrUid)), eq(users.uid, idOrUid))
        : or(eq(users.uid, idOrUid), eq(users.email, idOrUid));

      await db.delete(users).where(condition);
      mockDb.deleteUser(idOrUid);
      return true;
    } catch (err) {
      console.warn('UserModel.deleteUser DB error:', err);
      return mockDb.deleteUser(idOrUid);
    }
  }
}

