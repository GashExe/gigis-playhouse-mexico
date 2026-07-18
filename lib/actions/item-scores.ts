"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireGraderForProgram } from "@/lib/dal";

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
    select: { id: true },
  });
  if (!item) return;

  await prisma.itemScore.upsert({
    where: { studentId_itemId_cycleId: { studentId, itemId, cycleId } },
    update: { score },
    create: { studentId, itemId, cycleId, score },
  });

  revalidatePath(`/estudiantes/${studentId}/calificar/${programId}`);
  revalidatePath(`/estudiantes/${studentId}`);
}
