import fs from 'fs';
const file = 'src/db/schema.ts';
let content = fs.readFileSync(file, 'utf8');

// replace orgUnits table completely with departments again
content = content.replace(/export const orgUnits = pgTable[\s\S]*?\}\);/, `
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: integer('parent_id').references((): AnyPgColumn => departments.id),
  managerId: text('manager_id').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
`);

fs.writeFileSync(file, content);
