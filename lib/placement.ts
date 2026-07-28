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
 * la terapeuta ya lo ubicó a mano), se respeta. Programas sin niveles se saltan.
 *
 * Devuelve el LevelRecord creado (o null si no hubo nada que hacer) para que el
 * llamador pueda incluirlo en su transacción/bitácora.
 */
export async function ensurePlacementOnEnroll(
  studentId: string,
  programId: string,
  cycleId: string,
) {
  const placement = await resolvePlacement(studentId, programId, cycleId);
  // Ya ubicado en este ciclo: se respeta lo que haya (p. ej. ubicación manual).
  // Sin niveles en el programa no hay nada que ubicar.
  if (!placement || placement.existing) return null;
  const { levelId: placedLevelId, levelName: placedLevelName, recovered } = placement;

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

/** Orden cronológico de un ciclo (mismo criterio que la línea de tiempo). */
export function cycleRank(cycle: { year: number; season: string }): number {
  const s = cycle.season;
  return cycle.year * 10 + (s === "ENE_JUN" ? 1 : s === "JUL_AGO" ? 2 : 3);
}

/**
 * En qué nivel queda (o quedaría) el alumno en un programa dentro de un ciclo,
 * SIN escribir nada. Es la regla de arriba en una sola función, para que quien
 * necesite anticiparla —el horario de su nivel, por ejemplo— no la adivine ni la
 * repita. Devuelve null si el programa no tiene niveles.
 */
export async function resolvePlacement(
  studentId: string,
  programId: string,
  cycleId: string,
): Promise<{
  levelId: string;
  levelName: string;
  /** Ya estaba ubicado en este ciclo: es lo que hay, no una predicción. */
  existing: boolean;
  /** Se recuperó de su historial en otro ciclo (si no, es el nivel más bajo). */
  recovered: boolean;
} | null> {
  const current = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: { level: { select: { id: true, name: true } } },
  });
  if (current) {
    return {
      levelId: current.level.id,
      levelName: current.level.name,
      existing: true,
      recovered: false,
    };
  }

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
      level: { select: { id: true, name: true } },
      cycle: { select: { year: true, season: true } },
    },
  });
  if (prior.length === 0) {
    return { levelId: lowest.id, levelName: lowest.name, existing: false, recovered: false };
  }
  const latest = prior.reduce((best, r) =>
    cycleRank(r.cycle) > cycleRank(best.cycle) ? r : best,
  );
  return {
    levelId: latest.level.id,
    levelName: latest.level.name,
    existing: false,
    recovered: true,
  };
}
