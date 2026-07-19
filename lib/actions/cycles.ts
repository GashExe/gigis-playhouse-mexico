"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

export type ContinuityState =
  | { ok?: boolean; error?: string; copied?: { students: number; enrollments: number } }
  | undefined;

/**
 * Cambio de ciclo asistido: copia a los participantes elegidos del ciclo origen al
 * destino. Por cada alumno, para cada programa que tuvo en el origen **y que esté en
 * la oferta del destino**, crea/reactiva la inscripción y copia su ubicación de nivel
 * (el nivel donde quedó). Idempotente: correrlo dos veces no duplica nada.
 *
 * Solo copia a programas que estén en la oferta del ciclo destino: respeta la oferta
 * que arma la dirección (no la modifica por su cuenta).
 */
export async function carryOverStudents(
  fromCycleId: string,
  toCycleId: string,
  studentIds: string[],
): Promise<ContinuityState> {
  await requireRole("DIRECTORA");
  if (!fromCycleId || !toCycleId || fromCycleId === toCycleId) {
    return { error: "Elige un ciclo de origen y uno de destino distintos." };
  }
  if (studentIds.length === 0) {
    return { error: "No seleccionaste a ningún participante." };
  }

  const [fromCycle, toCycle] = await Promise.all([
    prisma.cycle.findUnique({ where: { id: fromCycleId }, select: { id: true } }),
    prisma.cycle.findUnique({ where: { id: toCycleId }, select: { id: true, label: true } }),
  ]);
  if (!fromCycle || !toCycle) return { error: "El ciclo elegido ya no existe." };

  // Programas ofertados en el destino: a esos —y solo a esos— se copia.
  const targetPrograms = await prisma.program.findMany({
    where: { cycles: { some: { id: toCycleId } } },
    select: { id: true },
  });
  const targetOffer = new Set(targetPrograms.map((p) => p.id));
  if (targetOffer.size === 0) {
    return {
      error: "El ciclo destino no tiene programas en su oferta todavía. Ármala primero.",
    };
  }

  // Inscripciones y ubicaciones del ciclo origen de los alumnos elegidos.
  const ids = new Set(studentIds);
  const [enrolls, records] = await Promise.all([
    prisma.enrollment.findMany({
      where: { cycleId: fromCycleId, studentId: { in: studentIds } },
      select: { studentId: true, programId: true },
    }),
    prisma.levelRecord.findMany({
      where: { cycleId: fromCycleId, studentId: { in: studentIds } },
      select: { studentId: true, programId: true, programLevelId: true, placement: true, note: true },
    }),
  ]);

  // Programas por alumno en el origen (unión de inscripción + ubicación de nivel),
  // acotados a la oferta del destino.
  const programsByStudent = new Map<string, Set<string>>();
  const add = (studentId: string, programId: string) => {
    if (!ids.has(studentId) || !targetOffer.has(programId)) return;
    let set = programsByStudent.get(studentId);
    if (!set) programsByStudent.set(studentId, (set = new Set()));
    set.add(programId);
  };
  for (const e of enrolls) add(e.studentId, e.programId);
  for (const r of records) add(r.studentId, r.programId);

  // Índice de la ubicación de nivel de origen, para copiar "dónde quedó".
  const recordByKey = new Map(
    records.map((r) => [`${r.studentId}:${r.programId}`, r]),
  );

  let copiedStudents = 0;
  let copiedEnrollments = 0;

  for (const [studentId, programIds] of programsByStudent) {
    if (programIds.size === 0) continue;
    copiedStudents++;
    for (const programId of programIds) {
      // Inscripción en el destino (reactiva si ya existía pausada/finalizada).
      await prisma.enrollment.upsert({
        where: { studentId_programId_cycleId: { studentId, programId, cycleId: toCycleId } },
        update: { status: "ACTIVA", endDate: null },
        create: { studentId, programId, cycleId: toCycleId, status: "ACTIVA" },
      });
      copiedEnrollments++;

      // Copia la ubicación de nivel donde quedó, si la tenía.
      const src = recordByKey.get(`${studentId}:${programId}`);
      if (src) {
        await prisma.levelRecord.upsert({
          where: { studentId_programId_cycleId: { studentId, programId, cycleId: toCycleId } },
          update: { programLevelId: src.programLevelId, placement: src.placement },
          create: {
            studentId,
            programId,
            cycleId: toCycleId,
            programLevelId: src.programLevelId,
            placement: src.placement,
            note: src.note,
          },
        });
      }
    }
  }

  await logAudit({
    action: "ciclo.continuidad",
    summary: `Trajo ${copiedStudents} participante(s) al ciclo ${toCycle.label} (${copiedEnrollments} inscripción/es)`,
    entityType: "Cycle",
    entityId: toCycleId,
  });

  revalidatePath("/programas");
  revalidatePath("/programas/continuidad");
  revalidatePath("/panel");
  return { ok: true, copied: { students: copiedStudents, enrollments: copiedEnrollments } };
}
