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

    // 4. Seed Departments if empty
    const allDepts = await db.select().from(departments);
    if (allDepts.length === 0) {
      console.log('⚡ Seeding organizational departments...');
      await db.insert(departments).values([
        {
          name: 'Information Technology',
          description: JSON.stringify({ nameAr: 'تكنولوجيا المعلومات', orgType: 'department', description: 'Infrastructure, systems administration, software support and IT helpdesk.' }),
          managerId: 'admin_uid_seed'
        },
        {
          name: 'Operations',
          description: JSON.stringify({ nameAr: 'العمليات والتنفيذ', orgType: 'department', description: 'Operational execution, logistics, and field support.' }),
          managerId: 'admin_uid_seed'
        },
        {
          name: 'Electronic Archiving & Records',
          description: JSON.stringify({ nameAr: 'الأرشفة الإلكترونية والسجلات', orgType: 'department', description: 'Document management, secure digital archiving, and record classification.' }),
          managerId: 'admin_uid_seed'
        },
        {
          name: 'Customer Support & Helpdesk',
          description: JSON.stringify({ nameAr: 'دعم العملاء ومكتب المساعدة', orgType: 'department', description: 'Client assistance, ticket resolution and operational inquiry triage.' }),
          managerId: 'admin_uid_seed'
        },
        {
          name: 'Human Resources',
          description: JSON.stringify({ nameAr: 'الموارد البشرية', orgType: 'department', description: 'Personnel administration, recruitment, onboarding and staff development.' }),
          managerId: 'admin_uid_seed'
        }
      ]);
      console.log('✅ Organizational departments seeded.');
    } else {
      const hasOps = allDepts.some(d => d.name === 'Operations' || d.name === 'العمليات والتنفيذ');
      if (!hasOps) {
        await db.insert(departments).values({
          name: 'Operations',
          description: JSON.stringify({ nameAr: 'العمليات والتنفيذ', orgType: 'department', description: 'Operational execution, logistics, and field support.' }),
          managerId: 'admin_uid_seed'
        });
        console.log('✅ Added Operations to organizational departments.');
      }
    }

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
