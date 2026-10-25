import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, fullName: string, avatarColor?: string) {
  try {
    const isAdmin = email.toLowerCase() === 'admin@system.local';
    const role = isAdmin ? 'Admin' : 'Employee';
    const userType = isAdmin ? 'System Admin' : 'Operational User';
    
    // First try to find by email (in case they were pre-provisioned via the dashboard)
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      // Update their UID to match the real Firebase Auth one
      const [updated] = await db.update(users).set({ uid, fullName }).where(eq(users.email, email)).returning();
      return updated;
    }

    // Otherwise insert new
    const result = await db.insert(users)
      .values({
        uid,
        email,
        fullName,
        userName: email,
        role,
        userType,
        avatarColor: avatarColor || 'bg-slate-500'
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database query failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("Database query failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
