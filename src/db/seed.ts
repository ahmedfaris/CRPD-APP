import dotenv from 'dotenv';
dotenv.config();

import { db } from './index.ts';
import { users, roles, departments, supportTeams, systemSettings, electronicDevices, assets, maintenance } from './schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export async function seedDatabaseIfEmpty() {
  try {
    // 1. Check if admin exists
    const existingAdmins = await db.select().from(users).where(eq(users.email, 'admin@system.local'));

    if (existingAdmins.length === 0) {
      console.log('⚡ Seeding initial Administrator user...');
      const adminPasswordHash = await bcrypt.hash('Admin@2026!', 10);

      await db.insert(users).values({
        uid: 'admin_uid_seed',
        userName: 'admin',
        email: 'admin@system.local',
        emailConfirmed: true,
        fullName: 'System Administrator',
        department: 'Information Technology',
        jobTitle: 'Chief Administrator',
        role: 'Admin',
        userType: 'System Admin',
        failedAccessCount: 0,
        lockoutEnd: null,
        isLockedOut: false,
        lockoutCount: 0,
        mustChangePassword: false,
        twoFactorEnabled: false,
        passwordHash: adminPasswordHash,
        avatarColor: 'bg-blue-600',
      });
      console.log('✅ Admin user created: admin@system.local / Admin@2026!');
    }

    // 2. Seed Roles if empty
    const allRoles = await db.select().from(roles);
    if (allRoles.length === 0) {
      console.log('⚡ Seeding standard security roles...');
      await db.insert(roles).values([
        {
          name: 'Administrator',
          permissions: [
            'users.create', 'users.read', 'users.update', 'users.delete',
            'roles.manage', 'tickets.manage', 'archiving.admin', 'reports.view'
          ],
          createdBy: 'admin_uid_seed'
        },
        {
          name: 'Helpdesk Agent',
          permissions: [
            'tickets.read', 'tickets.reply', 'tickets.assign', 'tickets.resolve', 'users.read'
          ],
          createdBy: 'admin_uid_seed'
        },
        {
          name: 'Employee',
          permissions: [
            'tickets.create', 'tickets.read_own', 'archiving.read'
          ],
          createdBy: 'admin_uid_seed'
        }
      ]);
      console.log('✅ Standard roles seeded.');
    }

    // 4. Organizational structure: no example units are created. Remove the example units
    //    that earlier versions seeded automatically (matched exactly by name and stored data).
    await removeExampleOrgUnits();

    // 5. Seed Support Teams if empty
    try {
      const allTeams = await db.select().from(supportTeams);
      if (allTeams.length === 0) {
        console.log('⚡ Seeding support teams...');
        await db.insert(supportTeams).values([
          {
            teamKey: 'technical',
            name: 'Technical Support Team',
            nameAr: 'فريق الدعم الفني',
            type: 'technical',
            description: 'Handles hardware diagnostics, maintenance, and replacement.',
            descriptionAr: 'مسؤول عن فحص وصيانة واستبدال الأجهزة والمعدات.',
            memberUserIds: ['admin_uid_seed'],
            leadUserId: 'admin_uid_seed',
          },
          {
            teamKey: 'systems',
            name: 'Systems & Networks Team',
            nameAr: 'فريق الأنظمة والشبكات',
            type: 'systems',
            description: 'Handles software permissions, Active Directory, network and infrastructure.',
            descriptionAr: 'مسؤول عن صلاحيات البرامج، الخوادم والشبكات والبنية التحتية.',
            memberUserIds: ['admin_uid_seed'],
            leadUserId: 'admin_uid_seed',
          }
        ]);
        console.log('✅ Support teams seeded.');
      }
    } catch (e: any) {
      console.warn('Notice while checking support teams:', e?.message || e);
    }

    // 6. Seed System Settings if empty
    try {
      const allSettings = await db.select().from(systemSettings);
      if (allSettings.length === 0) {
        console.log('⚡ Seeding default system settings...');
        await db.insert(systemSettings).values({
          settingKey: 'default',
          maxPictureAttachments: 3,
          maxAttachmentSizeBytes: 5242880,
          maxAttachmentSizeMB: 5,
          allowedImageTypes: ['image/jpeg', 'image/png'],
          slaCriticalHours: 4,
          slaMediumHours: 24,
          slaLowHours: 48,
        });
        console.log('✅ Default system settings seeded.');
      }
    } catch (e: any) {
      console.warn('Notice while checking system settings:', e?.message || e);
    }

    console.log('✨ Database verification and seeding completed.');
  } catch (error: any) {
    console.error('\n❌ Database seeding notice:', error.message || error);
    if (error.message?.includes('SASL') || error.message?.includes('password') || error.cause?.message?.includes('SASL')) {
      console.error('\n💡 PostgreSQL Authentication Note:');
      console.error('PostgreSQL requires a valid password in your .env file.');
      console.error('Please verify your .env file has either:');
      console.error('  SQL_PASSWORD="your_postgres_password"');
      console.error('or');
      console.error('  DATABASE_URL="postgresql://postgres:your_password@localhost:5432/crpd_db"\n');
    }
  }
}

// Standalone runner
const isDirectRun = 
  process.argv[1]?.endsWith('seed.ts') || 
  process.argv[1]?.endsWith('seed.js') || 
  process.argv[1]?.includes('seed');

if (isDirectRun) {
  seedDatabaseIfEmpty()
    .then(() => {
      console.log('Seed task completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed task error:', err);
      process.exit(1);
    });
}

/**
 * Example organizational units that earlier versions created on startup. A unit is removed only
 * when both its English name and its stored data are exactly what the seeder wrote, and only
 * once none of its sub-units are real (user-created) units. Real units are never touched.
 */
const EXAMPLE_ORG_UNITS: Array<{ name: string; description: string }> = [
  { name: 'General Telecommunications & Informatics Authority', description: JSON.stringify({ nameAr: 'الهيئة العامة للاتصالات والمعلوماتية', orgType: 'org', description: 'الهيئة المركزية للاتصالات وتقنية المعلومات والتحول الرقمي للأصول والمؤسسات.' }) },
  { name: 'Directorate of Information Technology & Cybersecurity', description: JSON.stringify({ nameAr: 'دائرة تكنولوجيا المعلومات والأمن السيبراني', orgType: 'directorate', description: 'الإشراف على البنية التحتية للحوسبة والشبكات وأمن المعلومات وإدارة الأجهزة الإلكترونية.' }) },
  { name: 'Directorate of Operations & Administrative Support', description: JSON.stringify({ nameAr: 'دائرة العمليات والخدمات المساندة', orgType: 'directorate', description: 'إدارة العمليات الميدانية والخدمات اللوجستية والموارد البشرية ودعم العملاء.' }) },
  { name: 'Information Technology', description: JSON.stringify({ nameAr: 'تكنولوجيا المعلومات', orgType: 'department', description: 'Infrastructure, systems administration, software support and IT helpdesk.' }) },
  { name: 'Operations', description: JSON.stringify({ nameAr: 'العمليات والتنفيذ', orgType: 'department', description: 'Operational execution, logistics, and field support.' }) },
  { name: 'Electronic Archiving & Records', description: JSON.stringify({ nameAr: 'الأرشفة الإلكترونية والسجلات', orgType: 'department', description: 'Document management, secure digital archiving, and record classification.' }) },
  { name: 'Customer Support & Helpdesk', description: JSON.stringify({ nameAr: 'دعم العملاء ومكتب المساعدة', orgType: 'department', description: 'Client assistance, ticket resolution and operational inquiry triage.' }) },
  { name: 'Human Resources', description: JSON.stringify({ nameAr: 'الموارد البشرية', orgType: 'department', description: 'Personnel administration, recruitment, onboarding and staff development.' }) },
];

export async function removeExampleOrgUnits(): Promise<number> {
  let removed = 0;
  try {
    const isExample = (u: any) => EXAMPLE_ORG_UNITS.some(e => e.name === u.name && e.description === u.description);
    // Delete leaves first; repeat until nothing more can go.
    for (let pass = 0; pass < 10; pass++) {
      const all = await db.select().from(departments);
      const leaves = all.filter(u => isExample(u) && !all.some(c => c.parentId === u.id));
      if (leaves.length === 0) break;
      for (const u of leaves) {
        await db.delete(departments).where(eq(departments.id, u.id));
        removed++;
      }
    }
    if (removed > 0) console.log(`🧹 Removed ${removed} example organizational unit(s).`);
  } catch (err) {
    console.error('Failed to remove example organizational units:', err);
  }
  return removed;
}
