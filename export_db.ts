import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';
import * as fs from 'fs';

async function exportDatabase() {
  try {
    const allUsers = await db.select().from(users);
    const exportData = {
      users: allUsers,
      exportedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('database_export.json', JSON.stringify(exportData, null, 2));
    console.log("Database exported successfully to database_export.json");
    process.exit(0);
  } catch (err) {
    console.error("Export failed", err);
    process.exit(1);
  }
}

exportDatabase();
