/**
 * Junta las fichas repetidas de servicio social: las que son la misma persona
 * escrita de varias maneras.
 *
 *   npm run db:servicio-juntar -- [--commit]
 *
 * Va en SIMULACIÓN por defecto y enseña el plan completo antes de tocar nada.
 *
 * ESTO NO SE DESHACE. Los reportes no se pierden —se pasan a la ficha que queda—
 * pero después ya no se puede saber en cuál de las fichas venía cada uno.
 *
 * Cómo decide, que es lo delicado:
 *
 *   - Agrupa en RACIMOS, no en pares. "Paul Francisco Ramirez Jimenez",
 *     "Paul Ramirez" y "Paul Ramirez Jimenez" son una sola persona en tres
 *     fichas, y juntarlas de dos en dos dejaría una suelta.
 *
 *   - El NOMBRE que queda es el más completo (más palabras), porque es el que va
 *     a salir en su constancia. Las iniciales sueltas del final no cuentan como
 *     palabra: "Danael gonzalez v" no es más completo que "Danael Gonzalez".
 *
 *   - La FICHA que queda es la que más reportes trae, aunque su nombre sea el
 *     corto: es la que tiene el correo, la meta de horas y el resto del
 *     expediente. Se le pone encima el nombre completo. Así no se pierde nada de
 *     los dos lados.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clavesDePrestador, seParecen } from "../lib/servicio";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

/** Palabras "de verdad" de un nombre: las iniciales sueltas no cuentan. */
function palabrasReales(name: string): number {
  return name.trim().split(/\s+/).filter((p) => p.replace(/\./g, "").length > 1).length;
}

async function main() {
  const dry = !process.argv.includes("--commit");

  const fichas = await prisma.volunteer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nameKey: true,
      school: true,
      schoolId: true,
      email: true,
      emailKey: true,
      requiredHours: true,
      startDate: true,
      endDate: true,
      areaId: true,
      leaderId: true,
      notes: true,
      _count: { select: { logs: true } },
    },
  });

  // Racimos por unión: si A va con B y B con C, los tres son uno.
  const padre = new Map<string, string>();
  fichas.forEach((f) => padre.set(f.id, f.id));
  const raiz = (id: string): string => {
    let r = id;
    while (padre.get(r) !== r) r = padre.get(r)!;
    return r;
  };
  for (let i = 0; i < fichas.length; i++) {
    for (let j = i + 1; j < fichas.length; j++) {
      const a = fichas[i];
      const b = fichas[j];
      const misma = (a.nameKey && a.nameKey === b.nameKey) || seParecen(a.nameKey, b.nameKey);
      if (misma) padre.set(raiz(a.id), raiz(b.id));
    }
  }

  const racimos = new Map<string, typeof fichas>();
  fichas.forEach((f) => racimos.set(raiz(f.id), [...(racimos.get(raiz(f.id)) ?? []), f]));
  const juntables = [...racimos.values()].filter((r) => r.length > 1);

  if (!juntables.length) {
    console.log("No hay fichas repetidas que juntar.");
    return;
  }

  console.log(`Racimos a juntar: ${juntables.length}\n`);
  let movidos = 0;
  let borradas = 0;

  for (const racimo of juntables) {
    // La ficha que se queda: la de más reportes (trae el expediente completo).
    const queda = [...racimo].sort((a, b) => b._count.logs - a._count.logs)[0];
    // El nombre que se queda: el más completo (es el de la constancia).
    const mejorNombre = [...racimo].sort(
      (a, b) => palabrasReales(b.name) - palabrasReales(a.name) || b._count.logs - a._count.logs,
    )[0].name;
    const salen = racimo.filter((f) => f.id !== queda.id);
    const total = racimo.reduce((n, f) => n + f._count.logs, 0);

    console.log(`«${mejorNombre}» — queda con ${total} reportes`);
    racimo.forEach((f) =>
      console.log(
        `    ${f.id === queda.id ? "QUEDA " : "se une"}  «${f.name}» (${f._count.logs} reportes)`,
      ),
    );

    if (dry) continue;

    // Lo que la ficha que queda no tenga, se toma de las que se unen: son datos
    // de la misma persona y tirarlos sería perderlos por el orden del sorteo.
    const primero = <T>(...vs: (T | null | undefined)[]) => vs.find((v) => v != null) ?? null;
    const fechas = racimo.map((f) => f.startDate).filter(Boolean) as Date[];
    const finales = racimo.map((f) => f.endDate).filter(Boolean) as Date[];

    const school = queda.schoolId ? queda.school : (salen.find((f) => f.schoolId)?.school ?? queda.school);
    const email = primero(queda.email, ...salen.map((f) => f.email));

    // Cuando las fichas traen correos DISTINTOS, uno de los dos es un dedazo
    // —así nació esta repetición— y no hay manera de saber cuál desde aquí.
    // Adivinar cambiaría el correo con el que esa persona entra. Se queda el de
    // la ficha que sobrevive y el otro se anota, para que una persona lo mire y
    // lo corrija en vez de que desaparezca sin que nadie se entere.
    const otrosCorreos = [...new Set(racimo.map((f) => f.email).filter(Boolean))].filter(
      (c) => c !== email,
    );
    const nota = [
      primero(queda.notes, ...salen.map((f) => f.notes)),
      otrosCorreos.length
        ? `También reportó con: ${otrosCorreos.join(", ")} — revisa cuál es el bueno.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (otrosCorreos.length) {
      console.log(`    ojo: reportó con dos correos · queda «${email}» · también «${otrosCorreos.join(", ")}»`);
    }

    await prisma.$transaction([
      ...salen.map((f) =>
        prisma.serviceLog.updateMany({ where: { volunteerId: f.id }, data: { volunteerId: queda.id } }),
      ),
      prisma.volunteer.update({
        where: { id: queda.id },
        data: {
          name: mejorNombre,
          school,
          schoolId: primero(queda.schoolId, ...salen.map((f) => f.schoolId)),
          email,
          ...clavesDePrestador(mejorNombre, school, email),
          requiredHours: primero(queda.requiredHours, ...salen.map((f) => f.requiredHours)),
          startDate: fechas.length ? new Date(Math.min(...fechas.map((d) => +d))) : null,
          endDate: finales.length ? new Date(Math.max(...finales.map((d) => +d))) : null,
          areaId: primero(queda.areaId, ...salen.map((f) => f.areaId)),
          leaderId: primero(queda.leaderId, ...salen.map((f) => f.leaderId)),
          notes: nota || null,
        },
      }),
      // Las cuentas de acceso de las fichas que se van: sin ficha no entran.
      prisma.user.deleteMany({ where: { volunteerId: { in: salen.map((f) => f.id) } } }),
      prisma.volunteer.deleteMany({ where: { id: { in: salen.map((f) => f.id) } } }),
    ]);

    movidos += salen.reduce((n, f) => n + f._count.logs, 0);
    borradas += salen.length;
  }

  console.log(
    dry
      ? `\n[SIMULACIÓN — nada se juntó; corre otra vez con --commit]`
      : `\nListo. Fichas eliminadas: ${borradas} · reportes que cambiaron de ficha: ${movidos}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
