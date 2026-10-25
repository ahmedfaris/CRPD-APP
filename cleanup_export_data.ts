// cleanup_export_data.ts
import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function cleanupExportData() {
  console.log('🧹 Starting cleanup of example tickets, assets, and users for export...');

  try {
    // 1. Delete all example tickets and related records
    await db.execute(sql`DELETE FROM ticket_comments;`);
    await db.execute(sql`DELETE FROM ticket_history;`);
    await db.execute(sql`DELETE FROM ticket_attachments;`);
    await db.execute(sql`DELETE FROM tickets;`);
    console.log('✅ Cleared all tickets, comments, history, and attachments.');

    // 2. Delete all example maintenance records, assets, and electronic devices
    await db.execute(sql`DELETE FROM maintenance;`);
    await db.execute(sql`DELETE FROM assets;`);
    await db.execute(sql`DELETE FROM electronic_devices;`);
    console.log('✅ Cleared all assets, electronic devices, and maintenance records.');

    // 3. Remove example users (keep only the root Administrator account)
    await db.execute(sql`DELETE FROM user_sessions;`);
    await db.execute(sql`DELETE FROM role_audit_logs;`);
    await db.execute(sql`DELETE FROM users WHERE email != 'admin@system.local';`);
    console.log('✅ Cleared example users, leaving only System Administrator.');

    // 4. Update support teams to reference only the admin user
    await db.execute(sql`
      UPDATE support_teams 
      SET member_user_ids = ARRAY['admin_uid_seed'],
          lead_user_id = 'admin_uid_seed';
    `);
    console.log('✅ Updated support teams to reference admin_uid_seed.');

    // 5. Reset serial sequences so new records start from 1
    const sequences = [
      'tickets_id_seq',
      'ticket_comments_id_seq',
      'ticket_history_id_seq',
      'ticket_attachments_id_seq',
      'electronic_devices_id_seq',
      'assets_id_seq',
      'maintenance_id_seq'
    ];

    for (const seq of sequences) {
      try {
        await db.execute(sql.raw(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1;`));
      } catch (seqErr: any) {
        console.warn(`Notice on sequence ${seq}:`, seqErr.message);
      }
    }
    console.log('✅ Reset all primary key auto-increment sequences to 1.');

    console.log('🎉 Database cleaned successfully for production export!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message || error);
    process.exit(1);
  }
}

cleanupExportData();
