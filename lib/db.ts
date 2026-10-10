// Prisma singleton (Next.js dev HMR-safe). Prisma 7 requires a driver adapter.
import { PrismaClient } from '@/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { __whooperPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__whooperPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.__whooperPrisma = prisma;
