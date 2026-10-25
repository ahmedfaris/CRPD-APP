import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    const password = 'SuperAdmin@2026!';
    const passwordHash = await bcrypt.hash(password, 10);
    const email = 'admin@system.local';

    const existing = await db.select().from(users).where(eq(users.email, email));
    
    if (existing.length > 0) {
      console.log('Admin user exists. Updating password hash to ensure login works...');
      await db.update(users).set({ passwordHash }).where(eq(users.email, email));
      console.log('Admin user password hash updated successfully.');
    } else {
      console.log('Creating admin user...');
      await db.insert(users).values({
        uid: 'admin_uid_seed',
        email: email,
        fullName: 'System Admin',
        role: 'Admin',
        userType: 'System Admin',
        passwordHash: passwordHash
      });
      console.log('Admin user created successfully.');
    }
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    process.exit(0);
  }
}

seed();
