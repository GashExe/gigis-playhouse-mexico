"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

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
  await verifySession();
  const { studentId, programId, itemId, cycleId, score } = args;
  // Regla absoluta: la calificación va de 1 a 4, nunca mayor.
  if (!Number.isInteger(score) || score < 1 || score > 4) return;
  if (!studentId || !itemId || !cycleId) return;

  await prisma.itemScore.upsert({
    where: { studentId_itemId_cycleId: { studentId, itemId, cycleId } },
    update: { score },
    create: { studentId, itemId, cycleId, score },
  });

  revalidatePath(`/estudiantes/${studentId}/calificar/${programId}`);
  revalidatePath(`/estudiantes/${studentId}`);
}
