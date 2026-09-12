import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.test" });
config({ path: ".env.test.local", override: true });

// TEST_DB_URL (gitignored, via .env.test.local) opts into a direct Postgres
// connection to the hosted dev project instead of local Docker Supabase —
// mirrors the same opt-in cascade admin-client.ts uses for the Supabase API
// credentials. Hosted requires SSL; local Docker's Postgres doesn't have it
// configured, so SSL is only turned on when TEST_DB_URL is actually set.
const connectionString = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function queryLocalDb(sql: string, params: unknown[] = []) {
  const client = new Client({
    connectionString,
    ssl: process.env.TEST_DB_URL ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}
