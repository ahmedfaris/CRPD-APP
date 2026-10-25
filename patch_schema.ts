import fs from 'fs';

const file = 'src/db/schema.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "name: text('name').notNull(),\n  description: text('description'),",
  "nameEn: text('name_en').notNull().default(''),\n  nameAr: text('name_ar').notNull().default(''),\n  orgType: text('org_type').notNull().default('department'),\n  description: text('description'),"
);

fs.writeFileSync(file, content);
