import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';

const { Client } = pg;

async function testConnection() {
  console.log('\n========================================');
  console.log('🔍 PostgreSQL Connection Diagnostic Tool');
  console.log('========================================\n');

  // 1. Check loaded environment variables
  console.log('1. Checking Environment Variables:');
  console.log('   - DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
  console.log('   - SQL_HOST / PGHOST:', process.env.SQL_HOST || process.env.PGHOST || '(default: localhost)');
  console.log('   - SQL_PORT / PGPORT:', process.env.SQL_PORT || process.env.PGPORT || '(default: 5432)');
  console.log('   - SQL_USER / PGUSER:', process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || '(default: postgres)');
  console.log('   - SQL_DB_NAME / PGDATABASE:', process.env.SQL_DB_NAME || process.env.PGDATABASE || '(default: postgres)');
  console.log('   - SQL_PASSWORD / PGPASSWORD:', (process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD) ? '******' : '[EMPTY/NOT SET]');
  console.log('   - DATABASE_SSL:', process.env.DATABASE_SSL || 'false');

  const sslConfig = process.env.DATABASE_SSL === 'true' 
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' } 
    : undefined;

  // 2. Determine connection parameters
  let clientConfig: pg.ClientConfig;
  if (process.env.DATABASE_URL) {
    console.log('\n2. Attempting connection using DATABASE_URL...');
    clientConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    };
  } else {
    console.log('\n2. Attempting connection using discrete variables (SQL_HOST/PGHOST, SQL_USER, etc.)...');
    clientConfig = {
      host: process.env.SQL_HOST || process.env.PGHOST || 'localhost',
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : (process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432),
      user: process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || 'postgres',
      password: String(process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD || ''),
      database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres',
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    };
  }

  const client = new Client(clientConfig);

  try {
    console.log('   Connecting to PostgreSQL...');
    await client.connect();
    console.log('   ✅ Successfully connected to PostgreSQL server!');

    // 3. Query PostgreSQL version
    const verRes = await client.query('SELECT version();');
    console.log('   PostgreSQL version:', verRes.rows[0]?.version?.split('on')[0]?.trim());

    // 4. Query current database & user
    const infoRes = await client.query('SELECT current_database(), current_user;');
    console.log('   Connected Database:', infoRes.rows[0]?.current_database);
    console.log('   Connected User:', infoRes.rows[0]?.current_user);

    // 5. Check if tables exist
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('\n3. Checking database tables:');
    if (tables.length === 0) {
      console.log('   ⚠️  No tables found in database "' + infoRes.rows[0]?.current_database + '".');
      console.log('   👉 Please run: npm run db:push  (to create tables first)');
    } else {
      console.log('   ✅ Tables found (' + tables.length + '):', tables.join(', '));
      if (tables.includes('users')) {
        const countRes = await client.query('SELECT COUNT(*) as count FROM users;');
        console.log('   👥 Total users in "users" table:', countRes.rows[0]?.count);
      }
    }

    await client.end();
    console.log('\n🎉 Everything is working properly!\n');
  } catch (err: any) {
    console.error('\n❌ Connection Failed!\n');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);

    console.log('\n💡 Diagnostic Advice:');
    if (err.code === 'ECONNREFUSED') {
      console.log('   - The PostgreSQL service is NOT running on port 5432.');
      console.log('   - Fix: Open Windows Services (services.msc), find "postgresql-x64-...", and click "Start".');
    } else if (err.code === '28P01' || err.message?.includes('password authentication failed') || err.message?.includes('SASL')) {
      console.log('   - The password provided is incorrect for this user.');
      console.log('   - Fix: Check the password you chose during PostgreSQL installation on your PC.');
    } else if (err.code === '3D000' || err.message?.includes('database') && err.message?.includes('does not exist')) {
      console.log('   - The target database does not exist.');
      console.log('   - Fix: Open pgAdmin or psql and run: CREATE DATABASE ' + (process.env.SQL_DB_NAME || 'crpd_db') + ';');
    } else {
      console.log('   - Details:', err.message);
    }
    console.log('');
    process.exit(1);
  }
}

testConnection();
