"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { getActiveCycle } from "@/lib/queries";
import { getSurveyConfig } from "@/lib/survey";
import { parseQuestions, type SurveyQuestion } from "@/lib/survey-types";

export type SurveyConfigState =
  | { ok?: boolean; error?: string; sinCambios?: boolean }
  | undefined;

function nuevaVersion(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** La dirección edita las preguntas de la encuesta (llegan como JSON en "questions"). */
export async function updateSurveyConfig(
  _prev: SurveyConfigState,
  formData: FormData,
): Promise<SurveyConfigState> {
  await requireRole("DIRECTORA");

  let questions: SurveyQuestion[] = [];
  try {
    questions = parseQuestions(JSON.parse(String(formData.get("questions") ?? "[]")));
  } catch {
    return { error: "No se pudieron leer las preguntas." };
  }
  if (questions.length === 0) {
    return { error: "La encuesta necesita al menos una pregunta." };
  }

  const current = await getSurveyConfig();
  const changed = JSON.stringify(questions) !== JSON.stringify(current.questions);
  if (!changed) return { ok: true, sinCambios: true };

  await prisma.surveyConfig.update({
    where: { id: 1 },
    data: { questions, version: nuevaVersion() },
  });
  await logAudit({
    action: "config.encuesta.editar",
    summary: "Actualizó las preguntas de la encuesta de satisfacción.",
    entityType: "SurveyConfig",
    entityId: "1",
  });
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Abre o cierra la encuesta de un ciclo (al abrirla, bloquea Mi espacio hasta llenarla). */
export async function setCycleSurveyOpen(cycleId: string, open: boolean) {
  await requireRole("DIRECTORA");
  await prisma.cycle.update({ where: { id: cycleId }, data: { surveyOpen: open } });
  revalidatePath("/configuracion");
  revalidatePath("/mi-espacio");
}

/**
 * La familia envía su encuesta del ciclo activo. Guarda una respuesta por
 * (alumno, ciclo); si ya existía la reemplaza. Al terminar, se libera Mi espacio.
 */
export async function submitSurveyResponse(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;

  const cycle = await getActiveCycle();
  if (!cycle || !cycle.surveyOpen) return;

  const config = await getSurveyConfig();
  // Recoge la respuesta de cada pregunta del formulario.
  const answers = config.questions.map((q) => {
    const raw = String(formData.get(`q_${q.id}`) ?? "").trim();
    return {
      questionId: q.id,
      value: q.type === "escala" ? Number(raw) || null : raw || null,
    };
  });

  await prisma.surveyResponse.upsert({
    where: { studentId_cycleId: { studentId, cycleId: cycle.id } },
    update: { answers, submittedAt: new Date() },
    create: { studentId, cycleId: cycle.id, answers },
  });

  revalidatePath("/mi-espacio");
  redirect("/mi-espacio");
}
