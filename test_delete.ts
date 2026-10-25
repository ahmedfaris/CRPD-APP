import { db } from './src/db/index.ts';
import { roles, users } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const r = await db.select().from(roles);
    console.log("Roles before:", r.map(x => ({ id: x.id, name: x.name, isDeleted: x.isDeleted })));
    
    // Create a mock role
    const [newR] = await db.insert(roles).values({ name: 'TestDeleteRole', permissions: [] }).returning();
    console.log("Inserted:", newR.id);
    
    // Try to delete it
    const [del] = await db.update(roles).set({
      isDeleted: true,
      deletedAt: new Date()
    }).where(eq(roles.id, newR.id)).returning();
    
    console.log("Deleted:", del);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
