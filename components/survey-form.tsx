"use client";

import { useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { submitSurveyResponse } from "@/lib/actions/survey";
import { SCALE_LABELS, type SurveyQuestion } from "@/lib/survey-types";

/**
 * Formulario de la encuesta de satisfacción que llena la familia. Cada pregunta de
 * escala son 5 opciones (muy insatisfecho → muy satisfecho); las abiertas, texto
 * libre. Se exige responder las de escala antes de enviar.
 */
export function SurveyForm({ questions }: { questions: SurveyQuestion[] }) {
  const escalas = questions.filter((q) => q.type === "escala");
  const [values, setValues] = useState<Record<string, number>>({});
  const faltan = escalas.some((q) => !values[q.id]);

  return (
    <form action={submitSurveyResponse} className="space-y-6">
      {questions.map((q, i) => (
        <fieldset
          key={q.id}
          className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
        >
          <legend className="px-1 text-sm font-bold text-ink">
            {i + 1}. {q.text}
          </legend>

          {q.type === "escala" ? (
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = values[q.id] === n;
                return (
                  <label
                    key={n}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-control)] border p-2 text-center transition-colors ${
                      active
                        ? "border-primary bg-primary-weak"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      value={n}
                      checked={active}
                      onChange={() => setValues((v) => ({ ...v, [q.id]: n }))}
                      className="sr-only"
                    />
                    <span className="text-lg font-extrabold text-ink">{n}</span>
                    <span className="text-[0.65rem] font-medium leading-tight text-muted">
                      {SCALE_LABELS[n]}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea
              name={`q_${q.id}`}
              rows={3}
              placeholder="Escribe aquí (opcional)…"
              className="mt-3 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          )}
        </fieldset>
      ))}

      <div className="flex flex-col items-end gap-2">
        {faltan && (
          <p className="text-xs text-muted">
            Responde todas las preguntas de estrellas para poder enviar.
          </p>
        )}
        <Button type="submit" disabled={faltan}>
          <PaperPlaneRight weight="fill" className="size-4" />
          Enviar encuesta
        </Button>
      </div>
    </form>
  );
}
