import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 usa el nuevo query compiler + driver adapter (sin engine binario).
// En runtime conectamos por el pooler de Supabase (pgbouncer, puerto 6543).
const connectionString = process.env.DATABASE_URL;

const createPrisma = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

// Singleton para evitar múltiples instancias en desarrollo (hot reload).
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
