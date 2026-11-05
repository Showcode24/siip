// Copies Prisma's generated enums into the shared package, so the frontend can
// use the exact statuses the database uses without depending on Prisma.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../src/generated/prisma/enums.ts", import.meta.url), "utf8");
const body = source.replace(/^[\s\S]*?(?=export const)/, "");
writeFileSync(
  new URL("../../shared/src/enums.ts", import.meta.url),
  `// GENERATED from backend/prisma/schema.prisma by backend/scripts/sync-shared-enums.mjs. Do not edit.\n\n${body}`,
);
