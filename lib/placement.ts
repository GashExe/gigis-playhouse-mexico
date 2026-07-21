import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Ubicación automática de nivel al inscribirse a un programa.
 *
 * La regla que pidió la dirección: entrar al expediente a ubicar a mano a cada
 * quien es mucho trabajo, así que al inscribirse se resuelve solo —
 *   • Si la familia YA tiene historial en ese programa (un LevelRecord de
 *     cualquier ciclo anterior), se le RECUPERA el último nivel que alcanzó.
 *   • Si NO tiene historial, se le coloca en el nivel más bajo del programa.
 *
 * No pisa nada: si ya existe una ubicación para ese alumno/programa/ciclo (porque
 * el maestro ya lo ubicó a mano), se respeta. Programas sin niveles se saltan.
 *
 * Devuelve el LevelRecord creado (o null si no hubo nada que hacer) para que el
 * llamador pueda incluirlo en su transacción/bitácora.
 */
export async function ensurePlacementOnEnroll(
  studentId: string,
  programId: string,
  cycleId: string,
) {
  // Ya ubicado en este ciclo: se respeta lo que haya (p. ej. ubicación manual).
  const existing = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: { id: true },
  });
  if (existing) return null;

  // El programa debe tener niveles para poder ubicar.
  const lowest = await prisma.programLevel.findFirst({
    where: { programId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  if (!lowest) return null;

  // ¿Hay historial en OTRO ciclo? Se recupera el nivel del registro más reciente.
  const prior = await prisma.levelRecord.findMany({
    where: { studentId, programId, cycleId: { not: cycleId } },
    select: {
      level: { select: { id: true, name: true, order: true } },
      cycle: { select: { year: true, season: true } },
    },
  });

  // Orden cronológico del ciclo (mismo criterio que la línea de tiempo).
  const rank = (year: number, season: string) =>
    year * 10 + (season === "ENE_JUN" ? 1 : season === "JUL_AGO" ? 2 : 3);

  let placedLevelId = lowest.id;
  let placedLevelName = lowest.name;
  let recovered = false;
  if (prior.length > 0) {
    const latest = prior.reduce((best, r) =>
      rank(r.cycle.year, r.cycle.season) > rank(best.cycle.year, best.cycle.season)
        ? r
        : best,
    );
    placedLevelId = latest.level.id;
    placedLevelName = latest.level.name;
    recovered = true;
  }

  await prisma.levelRecord.create({
    data: {
      studentId,
      programId,
      cycleId,
      programLevelId: placedLevelId,
      note: recovered
        ? "Nivel recuperado de su historial al inscribirse."
        : "Ubicado en el nivel inicial al inscribirse (sin historial previo).",
    },
  });

  await logAudit({
    action: "nivel.ubicar",
    summary: recovered
      ? `Recuperó nivel «${placedLevelName}» al inscribirse (por historial)`
      : `Ubicó en nivel inicial «${placedLevelName}» al inscribirse`,
    entityType: "LevelRecord",
    entityId: programId,
    studentId,
  });

  return { levelId: placedLevelId, levelName: placedLevelName, recovered };
}
