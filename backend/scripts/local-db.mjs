// Runs a local PostgreSQL 17 on port 5433 without Docker (dev/test only).
// Usage: node scripts/local-db.mjs   (Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: ".local-pg",
  user: "siip",
  password: "siip",
  port: 5433,
  persistent: true,
  // Match Neon: UTF-8, locale-independent collation.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !(await import("node:fs")).existsSync(".local-pg/PG_VERSION");
if (fresh) await pg.initialise();
await pg.start();
for (const name of ["siip", "siip_test"]) {
  try {
    await pg.createDatabase(name);
  } catch {
    // already exists
  }
}
console.log("Local Postgres ready on postgresql://siip:siip@localhost:5433 (databases: siip, siip_test)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
