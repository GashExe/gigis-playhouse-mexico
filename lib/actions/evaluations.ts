"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { EvaluationSchema } from "@/lib/validators";

export type EvalFormState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined;

export async function addEvaluation(
  studentId: string,
  _prev: EvalFormState,
  formData: FormData,
): Promise<EvalFormState> {
  const session = await verifySession();
  const parsed = EvaluationSchema.safeParse({
    studentId,
    programId: formData.get("programId") ?? "",
    title: formData.get("title"),
    date: formData.get("date") ?? "",
    score: formData.get("score") ?? "",
    scale: formData.get("scale") ?? "",
    level: formData.get("level") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const scoreNum = d.score ? Number(d.score) : null;

  await prisma.evaluation.create({
    data: {
      studentId,
      programId: d.programId || null,
      title: d.title,
      date: d.date ? new Date(d.date) : new Date(),
      score: scoreNum != null && !isNaN(scoreNum) ? scoreNum : null,
      scale: d.scale || null,
      level: d.level || null,
      notes: d.notes || null,
      evaluatorId: session.userId,
    },
  });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
  return { ok: true };
}

export async function deleteEvaluation(evaluationId: string, studentId: string) {
  await verifySession();
  await prisma.evaluation.delete({ where: { id: evaluationId } });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}
