// src/server/models/roleModel.ts
import { db } from '../../db/index.ts';
import { roles, users, roleAuditLogs } from '../../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.ts';

export interface CreateRoleInput {
  name: string;
  permissions: string[];
  createdBy: string;
}

export interface UpdateRoleInput {
  name: string;
  permissions: string[];
  updatedBy: string;
}

export class RoleModel {
  /**
   * Retrieve all roles with enriched user assignment count and creator details
   */
  static async getAllRoles() {
    const allRoles = await db.select().from(roles);
    const allUsers = await db.select({
      id: users.id,
      uid: users.uid,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      avatarColor: users.avatarColor
    }).from(users);

    const allLogs = await db.select().from(roleAuditLogs);

    return allRoles.map(role => {
      const assignedUsers = allUsers.filter(u => u.role === role.name);
      const creator = allUsers.find(u => u.uid === role.createdBy);
      const deleter = allUsers.find(u => u.uid === role.deletedBy);

      const roleLogs = allLogs
        .filter(l => l.roleId === role.id)
        .map(log => {
          const perf = allUsers.find(u => u.uid === log.performedBy);
          return {
            ...log,
            performedBy: perf ? { fullName: perf.fullName, email: perf.email } : null
          };
        })
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

      return {
        ...role,
        assignedUsers: assignedUsers.map(u => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          avatarColor: u.avatarColor
        })),
        createdBy: creator ? { fullName: creator.fullName, email: creator.email } : null,
        deletedBy: deleter ? { fullName: deleter.fullName, email: deleter.email } : null,
        auditLogs: roleLogs
      };
    });
  }

  /**
   * Get role by ID
   */
  static async getRoleById(id: number) {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || null;
  }

  /**
   * Get role by exact name
   */
  static async getRoleByName(name: string) {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role || null;
  }

  /**
   * Create a new role and audit log entry
   */
  static async createRole(input: CreateRoleInput) {
    const [newRole] = await db.insert(roles).values({
      name: input.name,
      permissions: input.permissions || [],
      createdBy: input.createdBy
    }).returning();

    await db.insert(roleAuditLogs).values({
      roleId: newRole.id,
      action: 'CREATE',
      performedBy: input.createdBy,
      details: `Role '${input.name}' created with ${input.permissions.length} permissions.`
    });

    return newRole;
  }

  /**
   * Update an existing role
   */
  static async updateRole(id: number, input: UpdateRoleInput) {
    const [updatedRole] = await db.update(roles).set({
      name: input.name,
      permissions: input.permissions || [],
      updatedAt: new Date()
    }).where(eq(roles.id, id)).returning();

    await db.insert(roleAuditLogs).values({
      roleId: id,
      action: 'EDIT',
      performedBy: input.updatedBy,
      details: `Role updated to '${input.name}' with ${input.permissions.length} permissions.`
    });

    return updatedRole;
  }

  /**
   * Soft-delete a role
   */
  static async deleteRole(id: number, deletedBy: string) {
    const [updatedRole] = await db.update(roles).set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: deletedBy
    }).where(eq(roles.id, id)).returning();

    await db.insert(roleAuditLogs).values({
      roleId: id,
      action: 'DELETE',
      performedBy: deletedBy,
      details: `Role '${updatedRole.name}' soft-deleted.`
    });

    return updatedRole;
  }

  /**
   * Check if users are currently assigned to a role
   */
  static async getAssignedUsersCount(roleName: string): Promise<number> {
    const assigned = await db.select().from(users).where(eq(users.role, roleName));
    return assigned.length;
  }
}
