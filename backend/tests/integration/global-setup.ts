import { execSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";

/**
 * Brings the test database up to the latest migrations, then empties every
 * table. Refuses to run unless the database name ends in "_test".
 */
export default async function setup() {
  const env = config({ path: ".env.test", override: true }).parsed ?? {};
  const url = env.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("Integration tests only run against a database whose name ends in _test");
  }
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, ...env } });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
    }
  } finally {
    await client.end();
  }
}
