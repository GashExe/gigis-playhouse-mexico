import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { usernameFromName } from "../lib/credentials";

/**
 * Regenera el USUARIO de acceso de las cuentas ALUMNO existentes a partir del
 * nombre + apellido (ej. "testprueba"), reemplazando los usuarios viejos (muchos
 * eran la matrícula). NO cambia la contraseña ni la matrícula del expediente.
 *
 * Uso:
 *   npx tsx prisma/regen-usuarios-alumnos.ts [--commit]
 *
 * DRY-RUN por defecto: imprime "usuario viejo → usuario nuevo" y guarda un reporte
 * en exports/. Solo escribe con --commit. La unicidad respeta a las cuentas de
 * directora/maestra y evita choques entre alumnos agregando 2, 3, …
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  const commit = process.argv.slice(2).includes("--commit");
  console.log(commit ? "✍️  Modo COMMIT (se escribirá en la BD)\n" : "🧪 Modo DRY-RUN (no se escribe; usa --commit)\n");

  // Usuarios que NO son alumnos: sus nombres de usuario quedan reservados.
  const otros = await prisma.user.findMany({
    where: { role: { not: "ALUMNO" } },
    select: { username: true },
  });
  const taken = new Set(otros.map((u) => u.username.toLowerCase()));

  // Cuentas ALUMNO con su participante (para el nombre).
  const alumnos = await prisma.user.findMany({
    where: { role: "ALUMNO" },
    select: {
      id: true,
      username: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Reserva de una vez los usuarios que NO cambian (cuentas sin participante),
  // sin importar el orden del ciclo, para que ningún alumno los pise.
  for (const a of alumnos) {
    if (!a.student) taken.add(a.username.toLowerCase());
  }

  const report: string[] = [`REGENERAR USUARIOS ALUMNO — ${new Date().toISOString()}`, ""];
  let changed = 0;
  let unchanged = 0;
  const sinStudent: string[] = [];

  for (const a of alumnos) {
    if (!a.student) {
      sinStudent.push(a.username); // su usuario ya quedó reservado arriba
      report.push(`  ⚠️ ${a.username} — cuenta sin participante ligado (se omite)`);
      continue;
    }
    const base = usernameFromName(a.student.firstName, a.student.lastName);
    // Busca un usuario libre contra los reservados (otros + ya asignados aquí).
    let username = base || "alumno";
    let n = 1;
    while (taken.has(username.toLowerCase())) {
      n++;
      username = `${base}${n}`;
    }
    taken.add(username.toLowerCase());

    if (username === a.username) {
      unchanged++;
      continue;
    }
    changed++;
    report.push(`  ${a.username}  →  ${username}   (${a.student.firstName} ${a.student.lastName})`);
    if (commit) {
      await prisma.user.update({ where: { id: a.id }, data: { username } });
    }
  }

  const outDir = path.resolve("exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "regen-usuarios-alumnos.txt");
  fs.writeFileSync(outFile, report.join("\n"), "utf8");

  console.log(`Alumnos: ${alumnos.length}  ·  Cambian: ${changed}  ·  Sin cambio: ${unchanged}  ·  Sin participante: ${sinStudent.length}`);
  console.log(`📝 Reporte: ${outFile}`);
  console.log(commit ? "\n✍️  Guardado en la BD." : "\n🧪 DRY-RUN: no se escribió nada. Revisa el reporte y vuelve a correr con --commit.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
