"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireGraderForProgram } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

/**
 * Registra/actualiza la calificación de un TEMA (EvalItem) para un alumno en un ciclo.
 * Escala 1–4 (la calificación máxima es 4). Único por (alumno, tema, ciclo).
 */
export async function setItemScore(args: {
  studentId: string;
  programId: string;
  itemId: string;
  cycleId: string;
  score: number;
}) {
  const { studentId, programId, itemId, cycleId, score } = args;
  // Regla absoluta: la calificación va de 1 a 4, nunca mayor.
  if (!Number.isInteger(score) || score < 1 || score > 4) return;
  if (!studentId || !programId || !itemId || !cycleId) return;

  // La maestra solo califica en los programas a su cargo.
  await requireGraderForProgram(programId);

  // El tema debe pertenecer a ese programa (que el programId no sea de adorno).
  const item = await prisma.evalItem.findFirst({
    where: { id: itemId, block: { level: { programId } } },
    select: { id: true, text: true, block: { select: { level: { select: { program: { select: { name: true } } } } } } },
  });
  if (!item) return;

  const prev = await prisma.itemScore.findUnique({
    where: { studentId_itemId_cycleId: { studentId, itemId, cycleId } },
    select: { score: true },
  });

  await prisma.itemScore.upsert({
    where: { studentId_itemId_cycleId: { studentId, itemId, cycleId } },
    update: { score },
    create: { studentId, itemId, cycleId, score },
  });

  // Solo se registra si de verdad cambió la calificación (evita ruido al repintar).
  if (prev?.score !== score) {
    const tema = item.text.length > 60 ? `${item.text.slice(0, 57)}…` : item.text;
    await logAudit({
      action: "calificacion.tema",
      summary: prev?.score
        ? `Cambió la calificación de «${tema}» en ${item.block.level.program.name} de ${prev.score} a ${score}`
        : `Calificó «${tema}» con ${score} en ${item.block.level.program.name}`,
      entityType: "ItemScore",
      entityId: itemId,
      studentId,
    });
  }

  revalidatePath(`/estudiantes/${studentId}/calificar/${programId}`);
  revalidatePath(`/estudiantes/${studentId}`);
}
