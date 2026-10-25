import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as schema from './schema.ts';

// Automatically load environment variables from .env if not already set
dotenv.config();

const { Pool } = pg;

declare global {
  var _postgresPool: any | undefined;
  var _pgliteInstance: PGlite | undefined;
  var _drizzleDb: any | undefined;
}

// Determine whether remote or local PostgreSQL is actively configured and available
export function isRemotePostgresAvailable(): boolean {
  if (process.env.USE_PGLITE === 'true') {
    return false;
  }
  if (process.env.DATABASE_URL) {
    return true;
  }
  const host = process.env.SQL_HOST || process.env.PGHOST;
  if (!host) {
    return false;
  }
  if (host.startsWith('/')) {
    // For Cloud SQL or local unix sockets, verify that the socket file actually exists
    return fs.existsSync(host);
  }
  // Any network TCP host like 'localhost', '127.0.0.1', 'postgres', or IP/domain
  return true;
}

const remoteAvailable = isRemotePostgresAvailable();

const standardPostgresDirs = [
  'base',
  'global',
  'pg_commit_ts',
  'pg_dynshmem',
  'pg_logical',
  'pg_logical/mappings',
  'pg_logical/snapshots',
  'pg_multixact',
  'pg_multixact/members',
  'pg_multixact/offsets',
  'pg_notify',
  'pg_replslot',
  'pg_serial',
  'pg_snapshots',
  'pg_stat',
  'pg_stat_tmp',
  'pg_subtrans',
  'pg_tblspc',
  'pg_twophase',
  'pg_wal',
  'pg_wal/archive_status',
  'pg_wal/summaries',
  'pg_xact'
];

export function ensurePostgresDirs(dataDir: string): void {
  for (const dirName of standardPostgresDirs) {
    const fullPath = path.join(dataDir, dirName);
    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
      } catch (_) {}
    }
  }
}

export function resetPgliteInstance(): PGlite {
  const dataDir = path.resolve(process.cwd(), 'data/local_postgres');
  try {
    if (global._pgliteInstance) {
      try {
        global._pgliteInstance.close().catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}

  try {
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dataDir, { recursive: true });
    ensurePostgresDirs(dataDir);
    global._pgliteInstance = new PGlite(dataDir);
  } catch (e) {
    console.warn('Fallback to in-memory PGlite due to reset error:', e);
    global._pgliteInstance = new PGlite();
  }

  global._drizzleDb = drizzlePglite(global._pgliteInstance, { schema });
  return global._pgliteInstance;
}

export function getPgliteInstance(): PGlite {
  if (!global._pgliteInstance) {
    const dataDir = path.resolve(process.cwd(), 'data/local_postgres');
    const pidFile = path.join(dataDir, 'postmaster.pid');
    const confFile = path.join(dataDir, 'postgresql.conf');
    const versionFile = path.join(dataDir, 'PG_VERSION');

    // Clean up leftover PID lock file from previous abnormal terminations
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch (_) {}
    }

    // If directory has PG_VERSION but is missing postgresql.conf, it's corrupted; reset it
    if (fs.existsSync(dataDir) && fs.existsSync(versionFile) && !fs.existsSync(confFile)) {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch (_) {}
    }

    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (_) {}
    }

    ensurePostgresDirs(dataDir);

    try {
      global._pgliteInstance = new PGlite(dataDir);
    } catch (err) {
      console.warn('PGlite on-disk startup issue, resetting data directory for clean recovery:', err);
      return resetPgliteInstance();
    }
  }
  return global._pgliteInstance;
}

export const createPool = (): any => {
  if (!global._postgresPool) {
    if (isRemotePostgresAvailable()) {
      const sslConfig = process.env.DATABASE_SSL === 'true' 
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' } 
        : undefined;

      if (process.env.DATABASE_URL) {
        global._postgresPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: sslConfig,
          max: parseInt(process.env.DB_POOL_MAX || '10', 10),
          connectionTimeoutMillis: 15000,
        });
      } else {
        const host = process.env.SQL_HOST || process.env.PGHOST || 'localhost';
        const isUnixSocket = host.startsWith('/');
        const passwordVal = process.env.SQL_PASSWORD ?? process.env.SQL_ADMIN_PASSWORD ?? process.env.PGPASSWORD ?? '';
        const portVal = process.env.SQL_PORT || process.env.PGPORT || '5432';
        const userVal = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || 'postgres';
        const dbNameVal = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres';

        global._postgresPool = new Pool({
          host: host,
          port: isUnixSocket ? undefined : parseInt(portVal, 10),
          user: userVal,
          password: String(passwordVal),
          database: dbNameVal,
          ssl: sslConfig,
          max: parseInt(process.env.DB_POOL_MAX || '10', 10),
          connectionTimeoutMillis: 15000,
        });
      }

      global._postgresPool.on('error', (err: any) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } else {
      const runQuery = async (text: string, params?: any[]) => {
        let activePglite = getPgliteInstance();
        if (!activePglite.ready) {
          try {
            await activePglite.waitReady;
          } catch (e) {
            console.warn('PGlite waitReady failed during query, resetting instance:', e);
            activePglite = resetPgliteInstance();
            await activePglite.waitReady;
          }
        }

        if (!params || params.length === 0) {
          try {
            return await activePglite.query(text, params);
          } catch (err: any) {
            if (err.message?.includes('multiple commands')) {
              await activePglite.exec(text);
              return { rows: [], fields: [] };
            }
            if (err.message?.includes('failed to initialize properly') || err.message?.includes('could not open file "base/')) {
              console.warn('Corrupted PGlite cluster detected during query, performing auto-recovery:', err.message);
              activePglite = resetPgliteInstance();
              await activePglite.waitReady;
              return await activePglite.query(text, params);
            }
            throw err;
          }
        }

        try {
          return await activePglite.query(text, params);
        } catch (err: any) {
          if (err.message?.includes('failed to initialize properly') || err.message?.includes('could not open file "base/')) {
            console.warn('Corrupted PGlite cluster detected during query, performing auto-recovery:', err.message);
            activePglite = resetPgliteInstance();
            await activePglite.waitReady;
            return await activePglite.query(text, params);
          }
          throw err;
        }
      };

      global._postgresPool = {
        query: runQuery,
        connect: async () => ({
          query: runQuery,
          release: () => {},
        }),
        on: () => {},
        end: async () => {},
      };
    }
  }
  return global._postgresPool;
};

// Create or retrieve the pool / client instance
const pool = createPool();

// Initialize Drizzle with proxy for seamless self-healing instance updates
export const db: any = new Proxy({}, {
  get(target, prop, receiver) {
    if (!global._drizzleDb) {
      const activePool = createPool();
      if (isRemotePostgresAvailable()) {
        global._drizzleDb = drizzlePg(activePool, { schema });
      } else {
        const pglite = getPgliteInstance();
        global._drizzleDb = drizzlePglite(pglite, { schema });
      }
    }
    const val = Reflect.get(global._drizzleDb, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(global._drizzleDb);
    }
    return val;
  }
});

