import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Serverless functions should hold very few connections each; Neon's pooler
// (the -pooler host in DATABASE_URL) multiplexes them.
function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
/** The client inside `db.$transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
/** Accepts either the root client or a transaction client. */
export type DbOrTx = Db | Tx;
