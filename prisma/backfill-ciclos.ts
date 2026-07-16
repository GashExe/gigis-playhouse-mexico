import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Oferta los programas que aún no estén en el ciclo activo. Se usó al introducir los
 * ciclos, para poner los 15 programas existentes en Ene–Jun 2026, que es el periodo en
 * el que corren hoy. La directora arma la oferta de los demás ciclos desde el panel.
 *
 * (Las inscripciones sin ciclo ya se reasignaron al ciclo activo; cycleId es
 * obligatorio desde entonces, así que ese paso ya no aplica.)
 *
 * Uso: npx tsx prisma/backfill-ciclos.ts [--commit]
 * DRY-RUN por defecto. Idempotente: re-correrlo no duplica ni reasigna lo ya puesto.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(commit ? "✍️  COMMIT\n" : "🧪 DRY-RUN (usa --commit para escribir)\n");

  const cycle = await prisma.cycle.findFirst({ where: { active: true } });
  if (!cycle) throw new Error("No hay ciclo activo. Corre db:seed-niveles primero.");
  console.log(`Ciclo activo: ${cycle.label}`);

  const programs = await prisma.program.findMany({
    select: { id: true, name: true, cycles: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
  const faltan = programs.filter((p) => !p.cycles.some((c) => c.id === cycle.id));
  console.log(`\nProgramas a ofertar en ${cycle.label}: ${faltan.length} de ${programs.length}`);
  for (const p of faltan) console.log(`   • ${p.name}`);
  if (commit) {
    for (const p of faltan) {
      await prisma.program.update({
        where: { id: p.id },
        data: { cycles: { connect: { id: cycle.id } } },
      });
    }
  }

  console.log(commit ? "\n✅ Listo." : "\n🧪 No se escribió nada.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
