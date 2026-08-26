import { Client } from "pg";

export async function queryLocalDb(sql: string, params: unknown[] = []) {
  const client = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}
