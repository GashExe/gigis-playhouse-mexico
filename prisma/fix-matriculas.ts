import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Reasigna una matrícula PROPIA (numérica y única) a las cuentas que quedaron
 * compartiendo matrícula (usuario con guion, ej. "00730875-2"). La nueva
 * matrícula = base + ordinal (007308752), verificando que no choque con otra.
 *
 * Actualiza Student.matricula y User.username. La contraseña inicial no cambia
 * (se deriva del nombre, no de la matrícula).
 *
 * Además señala los pares que parecen ser el MISMO niño duplicado (mismo nombre
 * y misma fecha de nacimiento) para que la directora decida si conviene borrar
 * uno en vez de darle matrícula nueva.
 *
 * Uso: npx tsx prisma/fix-matriculas.ts [--dry-run]
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

function nameKey(first: string, last: string): string {
  return `${first} ${last}`
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Conjunto de todas las matrículas/usuarios ya usados, para no chocar.
  const all = await prisma.student.findMany({ select: { matricula: true } });
  const used = new Set(all.map((s) => s.matricula).filter(Boolean) as string[]);
  const allUsers = await prisma.user.findMany({ select: { username: true } });
  for (const u of allUsers) used.add(u.username);

  const shared = await prisma.user.findMany({
    where: { role: "ALUMNO", username: { contains: "-" } },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true, birthDate: true } },
    },
  });

  console.log(`Cuentas con matrícula compartida: ${shared.length}`);
  if (dryRun) console.log("🧪 DRY-RUN (no se escribe)\n");

  const changes: { old: string; nueva: string; nombre: string }[] = [];
  const posiblesDuplicados: string[] = [];

  for (const u of shared) {
    const [base, ord] = u.username.split("-");
    let ordinal = Number(ord) || 2;
    let candidate = `${base}${ordinal}`;
    while (used.has(candidate)) {
      ordinal++;
      candidate = `${base}${ordinal}`;
    }
    used.add(candidate);

    // ¿Mismo niño duplicado? Comparar con el hermano de matrícula base.
    const sibling = await prisma.student.findUnique({
      where: { matricula: base },
      select: { firstName: true, lastName: true, birthDate: true },
    });
    if (sibling && u.student) {
      const sameName = nameKey(sibling.firstName, sibling.lastName) === nameKey(u.student.firstName, u.student.lastName);
      const sameBirth =
        sibling.birthDate && u.student.birthDate &&
        sibling.birthDate.toISOString().slice(0, 10) === u.student.birthDate.toISOString().slice(0, 10);
      if (sameName && sameBirth) {
        posiblesDuplicados.push(`${u.name} (matrícula ${base}) — mismo nombre y fecha que el otro registro`);
      }
    }

    changes.push({ old: u.username, nueva: candidate, nombre: u.name });

    if (!dryRun) {
      if (u.studentId) {
        await prisma.student.update({
          where: { id: u.studentId },
          data: { matricula: candidate },
        });
      }
      await prisma.user.update({
        where: { id: u.id },
        data: { username: candidate },
      });
    }
  }

  console.log("\n✅ Reasignaciones:");
  for (const c of changes) {
    console.log(`   ${c.old}  →  ${c.nueva}   (${c.nombre})`);
  }
  if (posiblesDuplicados.length) {
    console.log(`\n⚠️  Posibles duplicados del MISMO niño (revisar si conviene borrar uno):`);
    for (const d of posiblesDuplicados) console.log(`   - ${d}`);
  }
  console.log(dryRun ? "\n(dry-run: no se escribió)" : "\nListo.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
