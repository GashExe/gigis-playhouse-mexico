/**
 * Tipos y constantes puras de la encuesta de satisfacción. Sin dependencias de
 * servidor: se usan igual en páginas (server) y en el formulario (cliente). La
 * lógica que toca la base de datos vive en `lib/survey.ts` (server-only).
 */

export type SurveyQuestionType = "escala" | "abierta";
export type SurveyQuestion = { id: string; text: string; type: SurveyQuestionType };

/** Escala de satisfacción (1–5). El índice 0 no se usa. */
export const SCALE_LABELS = [
  "",
  "Muy insatisfecho",
  "Insatisfecho",
  "Neutral",
  "Satisfecho",
  "Muy satisfecho",
] as const;

export const DEFAULT_SURVEY_VERSION = "generico-2026-07";

export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "general", text: "¿Qué tan satisfecho estás con Gigi's este ciclo?", type: "escala" },
  { id: "atencion", text: "¿Cómo calificas la atención y el trato del equipo?", type: "escala" },
  { id: "avance", text: "¿Notas avances en el participante este ciclo?", type: "escala" },
  { id: "instalaciones", text: "¿Qué tan a gusto te sientes con las instalaciones?", type: "escala" },
  { id: "recomendar", text: "¿Recomendarías Gigi's a otra familia?", type: "escala" },
  { id: "comentarios", text: "¿Algo que quieras compartir, agradecer o mejorar?", type: "abierta" },
];

/** Lee/valida la lista de preguntas guardada como Json. */
export function parseQuestions(json: unknown): SurveyQuestion[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (q): q is SurveyQuestion =>
      !!q &&
      typeof q === "object" &&
      typeof (q as SurveyQuestion).id === "string" &&
      typeof (q as SurveyQuestion).text === "string" &&
      ((q as SurveyQuestion).type === "escala" || (q as SurveyQuestion).type === "abierta"),
  );
}
