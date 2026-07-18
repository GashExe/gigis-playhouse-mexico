"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireGraderForProgram } from "@/lib/dal";

const PLACEMENTS = ["REGULAR", "PROBATORIO", "POSIBLE_GRADUADO"] as const;
type Placement = (typeof PLACEMENTS)[number];

/**
 * Registra/actualiza la UBICACIÓN de nivel de un alumno en un programa, para un
 * ciclo. Es la "calificación por programa" con historial por ciclo. El nivel debe
 * pertenecer al programa. Único por (alumno, programa, ciclo).
 */
export async function setLevelRecord(studentId: string, formData: FormData) {
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;
  // La maestra solo puede ubicar/calificar en los programas a su cargo.
  await requireGraderForProgram(programId);
  const cycleId = String(formData.get("cycleId") ?? "");
  const programLevelId = String(formData.get("programLevelId") ?? "");
  const rawPlacement = String(formData.get("placement") ?? "REGULAR");
  const placement: Placement = (PLACEMENTS as readonly string[]).includes(rawPlacement)
    ? (rawPlacement as Placement)
    : "REGULAR";
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!programId || !cycleId || !programLevelId) return;

  // El nivel elegido debe ser de ese programa (evita mezclar niveles de otro).
  const level = await prisma.programLevel.findFirst({
    where: { id: programLevelId, programId },
    select: { id: true },
  });
  if (!level) return;

  await prisma.levelRecord.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    update: { programLevelId, placement, note, gradedAt: new Date() },
    create: { studentId, programId, cycleId, programLevelId, placement, note },
  });
  revalidatePath(`/estudiantes/${studentId}`);
}

/**
 * Sube al alumno al siguiente nivel del programa cuando DESBLOQUEÓ TODOS los
 * bloques de su nivel actual (cada bloque al umbral del programa). Si ya está
 * en el último nivel, lo marca como posible graduado. La regla se re-verifica
 * aquí: el botón del cliente no es la autoridad.
 */
export async function promoteToNextLevel(
  studentId: string,
  programId: string,
  cycleId: string,
) {
  await requireGraderForProgram(programId);
  if (!studentId || !cycleId) return;

  const record = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: {
      id: true,
      note: true,
      level: { select: { id: true, name: true, order: true } },
      program: { select: { passThreshold: true } },
    },
  });
  if (!record) return;

  // ¿Todos los bloques del nivel actual están desbloqueados?
  const blocks = await prisma.evalBlock.findMany({
    where: { levelId: record.level.id },
    select: {
      items: { select: { id: true } },
    },
  });
  if (blocks.length === 0) return;
  const itemIds = blocks.flatMap((b) => b.items.map((i) => i.id));
  const scores = await prisma.itemScore.findMany({
    where: { studentId, cycleId, itemId: { in: itemIds } },
    select: { itemId: true, score: true },
  });
  const scoreByItem = new Map(scores.map((s) => [s.itemId, s.score]));
  const threshold = record.program.passThreshold;
  const allUnlocked = blocks.every((b) => {
    if (b.items.length === 0) return true;
    const sum = b.items.reduce(
      (acc, i) => acc + (scoreByItem.get(i.id) ?? 0) / 4,
      0,
    );
    return Math.round((sum / b.items.length) * 100) >= threshold;
  });
  if (!allUnlocked) return;

  const nextLevel = await prisma.programLevel.findFirst({
    where: { programId, order: { gt: record.level.order } },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  const stamp = new Date().toLocaleDateString("es-MX");
  if (nextLevel) {
    await prisma.levelRecord.update({
      where: { id: record.id },
      data: {
        programLevelId: nextLevel.id,
        placement: "REGULAR",
        gradedAt: new Date(),
        note: [
          record.note,
          `Subió de «${record.level.name}» a «${nextLevel.name}» al desbloquear todos los bloques (${stamp}).`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
  } else {
    // Último nivel completo: candidato a concluir el programa.
    await prisma.levelRecord.update({
      where: { id: record.id },
      data: {
        placement: "POSIBLE_GRADUADO",
        gradedAt: new Date(),
        note: [
          record.note,
          `Desbloqueó todos los bloques del último nivel «${record.level.name}» (${stamp}).`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath(`/calendario/${programId}`);
}

/** Quita la ubicación de nivel de un alumno en ese programa/ciclo. */
export async function removeLevelRecord(recordId: string, studentId: string) {
  const record = await prisma.levelRecord.findUnique({
    where: { id: recordId },
    select: { programId: true },
  });
  if (!record) return;
  await requireGraderForProgram(record.programId);
  await prisma.levelRecord.delete({ where: { id: recordId } });
  revalidatePath(`/estudiantes/${studentId}`);
}
