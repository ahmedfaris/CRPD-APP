import { db } from './src/db/index.ts';
import { roles } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function run() {
  const allRoles = await db.select().from(roles);
  
  for (const role of allRoles) {
    let newPerms: string[] = [];
    for (const old of role.permissions) {
      if (!old.includes('.')) {
        newPerms.push(`${old}.View`);
        newPerms.push(`${old}.Create`);
        newPerms.push(`${old}.Edit`);
        newPerms.push(`${old}.Delete`);
      } else {
        newPerms.push(old);
      }
    }
    
    // Deduplicate
    newPerms = Array.from(new Set(newPerms));
    
    await db.update(roles).set({ permissions: newPerms }).where(eq(roles.id, role.id));
  }
  process.exit(0);
}
run();
