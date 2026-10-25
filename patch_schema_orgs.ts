import fs from 'fs';

const file = 'src/db/schema.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove departments
content = content.replace(/export const departments = pgTable[\s\S]*?\}\);/, '');

// Add org_units
const orgUnitsTable = `
export const orgUnits = pgTable('org_units', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  orgType: text('org_type').notNull(),
  description: text('description'),
  parentId: integer('parent_id').references((): AnyPgColumn => orgUnits.id),
  managerId: text('manager_id').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
`;

content += orgUnitsTable;
fs.writeFileSync(file, content);
