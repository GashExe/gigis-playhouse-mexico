import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 usa el nuevo query compiler + driver adapter (sin engine binario).
// El adapter de better-sqlite3 recibe la ruta del archivo de base de datos.
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const createPrisma = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });

// Singleton para evitar múltiples instancias en desarrollo (hot reload).
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
