import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  parseQuestions,
  DEFAULT_SURVEY_QUESTIONS,
  DEFAULT_SURVEY_VERSION,
} from "@/lib/survey-types";

// Re-exporta los tipos/constantes puras para que el código de servidor pueda
// seguir importando todo desde "@/lib/survey".
export * from "@/lib/survey-types";

/**
 * Encuesta de satisfacción de fin de ciclo. Las preguntas las edita la dirección
 * (registro único id=1, como los textos legales). Cada pregunta es de escala 1–5
 * ("muy insatisfecho" → "muy satisfecho") o abierta (texto libre). Cuando la
 * dirección abre la encuesta de un ciclo, las familias deben contestarla para
 * seguir usando Mi espacio.
 */

/**
 * Configuración vigente de la encuesta. Registro único id=1: si aún no existe, se
 * siembra con las preguntas por defecto. Cacheado por request.
 */
export const getSurveyConfig = cache(async () => {
  const existing = await prisma.surveyConfig.findUnique({ where: { id: 1 } });
  const row =
    existing ??
    (await prisma.surveyConfig.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        questions: DEFAULT_SURVEY_QUESTIONS,
        version: DEFAULT_SURVEY_VERSION,
      },
    }));
  return {
    questions: parseQuestions(row.questions),
    version: row.version,
    updatedAt: row.updatedAt,
  };
});

/** ¿El alumno ya contestó la encuesta de este ciclo? */
export async function hasSurveyResponse(studentId: string, cycleId: string) {
  const r = await prisma.surveyResponse.findUnique({
    where: { studentId_cycleId: { studentId, cycleId } },
    select: { id: true },
  });
  return !!r;
}

type Answer = { questionId: string; value: number | string | null };

/**
 * Resultados agregados de la encuesta de un ciclo, para graficar: por cada pregunta
 * de escala, cuántas respuestas cayeron en cada nivel (1–5) y el promedio; por cada
 * pregunta abierta, la lista de comentarios.
 */
export async function getSurveyResults(cycleId: string) {
  const config = await getSurveyConfig();
  const responses = await prisma.surveyResponse.findMany({
    where: { cycleId },
    select: { answers: true },
  });

  const byQuestion = new Map<string, Answer[]>();
  for (const r of responses) {
    const answers = Array.isArray(r.answers) ? (r.answers as unknown as Answer[]) : [];
    for (const a of answers) {
      if (!a || typeof a.questionId !== "string") continue;
      byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);
    }
  }

  const questions = config.questions.map((q) => {
    const answers = byQuestion.get(q.id) ?? [];
    if (q.type === "escala") {
      const dist = [0, 0, 0, 0, 0, 0]; // índice 1–5
      let sum = 0;
      let n = 0;
      for (const a of answers) {
        const v = typeof a.value === "number" ? a.value : Number(a.value);
        if (v >= 1 && v <= 5) {
          dist[v] += 1;
          sum += v;
          n += 1;
        }
      }
      return {
        id: q.id,
        text: q.text,
        type: "escala" as const,
        distribution: dist,
        average: n > 0 ? Math.round((sum / n) * 10) / 10 : null,
        answered: n,
      };
    }
    const comments = answers
      .map((a) => (typeof a.value === "string" ? a.value.trim() : ""))
      .filter((t) => t.length > 0);
    return {
      id: q.id,
      text: q.text,
      type: "abierta" as const,
      comments,
      answered: comments.length,
    };
  });

  return { total: responses.length, questions };
}
