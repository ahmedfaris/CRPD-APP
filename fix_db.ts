import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';
async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "organization_units" (
      "id" serial PRIMARY KEY NOT NULL,
      "name_en" text NOT NULL,
      "name_ar" text NOT NULL,
      "org_type" text NOT NULL,
      "description" text,
      "parent_id" integer,
      "manager_id" text
    );
  `);
  console.log('done');
}
run();
