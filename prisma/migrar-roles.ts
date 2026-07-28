import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Corre el SQL previo al `prisma db push` de los roles nuevos y la calificación
 * inicial/final. Existe porque este cambio quita un valor del enum Role (MAESTRA)
 * que las cuentas siguen usando: hay que convertirlas ANTES de empujar el esquema.
 *
 * Uso: npm run db:migrar-roles   (y después `npx prisma db push`)
 *
 * Idempotente: todas las sentencias son IF NOT EXISTS o un UPDATE que ya no
 * encuentra filas. Correrlo dos veces no rompe nada.
 */

const ARCHIVO = path.join(
  __dirname,
  "migraciones",
  "2026-07-27-roles-y-calificacion-inicial-final.sql",
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    // DIRECT_URL: el pooler no acepta bien la DDL.
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

/** Sentencias del archivo, sin comentarios ni líneas vacías. */
function sentencias(sql: string): string[] {
  return sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sql = fs.readFileSync(ARCHIVO, "utf8");
  const pasos = sentencias(sql);
  console.log(`🛠  ${pasos.length} sentencias desde ${path.basename(ARCHIVO)}\n`);

  for (const paso of pasos) {
    const resumen = paso.replace(/\s+/g, " ").slice(0, 78);
    // Sueltas, NO en transacción: ALTER TYPE ... ADD VALUE no puede ir dentro de una
    // junto con el UPDATE que estrena el valor.
    await prisma.$executeRawUnsafe(paso);
    console.log(`   ✓ ${resumen}`);
  }

  console.log("\n✅ Listo. Ahora corre:  npx prisma db push");
  console.log("   Ojo: ese paso BORRA las tablas de plantillas (bloques, temas y sus");
  console.log("   calificaciones). Saca respaldo antes si quieres conservarlas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
