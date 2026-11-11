// src/server/utils/userAdmin.ts
import { eq, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, roles } from '../../db/schema.ts';
import { AuthRequest, getEffectivePermissions } from '../../middleware/auth.ts';
import { validatePasswordPolicy } from '../../utils/security.ts';

/**
 * Shared rules for user administration:
 * - only admins may create, edit, delete or grant admin-level accounts/roles;
 * - nobody may change their own role or user type, or delete their own account;
 * - the last admin account can never be removed or demoted;
 * - roles must exist; passwords must meet the same policy the UI shows.
 */
const ADMIN_ROLE_NAMES = ['admin', 'administrator', 'system admin'];
// Role names used by built-in accounts that are not rows in the roles table.
const BUILT_IN_ROLES = ['admin', 'agent'];
const BUILT_IN_ADMIN_EMAIL = 'admin@system.local';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export async function getActiveRoles() {
  const all = await db.select().from(roles);
  return all.filter((r: any) => !r.isDeleted);
}

/** True when the role name is an admin role or a role that grants every permission ('*'). */
export async function isAdminLevelRole(roleName: unknown): Promise<boolean> {
  const name = norm(roleName);
  if (!name) return false;
  if (ADMIN_ROLE_NAMES.includes(name)) return true;
  const role = (await getActiveRoles()).find((r: any) => norm(r.name) === name);
  return !!role && Array.isArray(role.permissions) && role.permissions.includes('*');
}

export async function isAdminAccount(row: any): Promise<boolean> {
  if (!row) return false;
  if (norm(row.email) === BUILT_IN_ADMIN_EMAIL) return true;
  if (norm(row.userType) === 'system admin') return true;
  return isAdminLevelRole(row.role);
}

export async function roleExists(roleName: unknown): Promise<boolean> {
  const name = norm(roleName);
  if (!name) return false;
  if (BUILT_IN_ROLES.includes(name)) return true;
  return (await getActiveRoles()).some((r: any) => norm(r.name) === name);
}

/** The signed-in user's admin status, read from the database. */
export async function actorIsAdmin(req: AuthRequest): Promise<boolean> {
  const eff = await getEffectivePermissions(req.user?.uid);
  if (!eff) return false;
  return eff.permissions.includes('*') || ADMIN_ROLE_NAMES.includes(norm(eff.role)) || norm(eff.email) === BUILT_IN_ADMIN_EMAIL;
}

/**
 * Find a user by the identifier in the URL (numeric id, uid or email). Never falls back to
 * values from the request body (that previously made a bad id edit a different user).
 */
export async function findUserRow(identifier: string) {
  const id = String(identifier ?? '').trim();
  if (!id) return null;
  const conditions = [eq(users.uid, id), eq(users.email, id.toLowerCase())];
  if (/^\d+$/.test(id)) conditions.push(eq(users.id, Number(id)));
  const [row] = await db.select().from(users).where(or(...conditions)).limit(1);
  return row || null;
}

export async function countAdminAccounts(excludingUid?: string): Promise<number> {
  const all = await db.select().from(users);
  let count = 0;
  for (const u of all) {
    if (excludingUid && u.uid === excludingUid) continue;
    if (u.isLockedOut) continue;
    if (await isAdminAccount(u)) count++;
  }
  return count;
}

/** Is this email (or user name) already used by a different account? */
export async function isLoginTaken(value: unknown, exceptUid?: string): Promise<boolean> {
  const v = norm(value);
  if (!v) return false;
  const all = await db.select({ uid: users.uid, email: users.email, userName: users.userName }).from(users);
  return all.some((u: any) => u.uid !== exceptUid && (norm(u.email) === v || norm(u.userName) === v));
}

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  const result = validatePasswordPolicy(password);
  return result.isValid ? null : result.errors.join(' ');
}
