import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const sqlHost = process.env.SQL_HOST || process.env.PGHOST || 'localhost';
const sqlDbName = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres';
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.PGUSER || 'postgres';
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.PGPASSWORD || '';
const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : (process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432);
const sslConfig = process.env.DATABASE_SSL === 'true' 
  ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' } 
  : false;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations.
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl ? {
    url: databaseUrl,
    ssl: sslConfig,
  } : {
    host: sqlHost,
    port: sqlHost.startsWith('/') ? undefined : port,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: sslConfig,
  },
  verbose: true,
});
