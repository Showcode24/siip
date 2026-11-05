import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Migrations use the direct (non-pooled) Neon URL; the app uses the pooled DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
