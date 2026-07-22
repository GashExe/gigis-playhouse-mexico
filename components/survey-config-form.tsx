"use client";

import { useState, useTransition } from "react";
import { Plus, X, FloppyDisk } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { updateSurveyConfig } from "@/lib/actions/survey";
import type { SurveyQuestion, SurveyQuestionType } from "@/lib/survey-types";

let counter = 0;
const newId = () => `p_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/**
 * Editor de las preguntas de la encuesta (solo la dirección). Las preguntas viven en
 * estado local y se envían como JSON en un campo oculto; el servidor las reemplaza.
 */
export function SurveyConfigForm({ initial }: { initial: SurveyQuestion[] }) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formAction = (fd: FormData) =>
    startTransition(async () => {
      const res = await updateSurveyConfig(undefined, fd);
      if (res?.error) {
        setError(res.error);
        setSavedMsg(null);
        return;
      }
      setError(null);
      setSavedMsg(res?.sinCambios ? "Sin cambios" : "Guardado ✓");
    });

  const update = (i: number, patch: Partial<SurveyQuestion>) =>
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li
            key={q.id}
            className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface p-2.5"
          >
            <span className="text-xs font-bold text-subtle">{i + 1}.</span>
            <input
              value={q.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Escribe la pregunta…"
              className="h-9 min-w-0 flex-1 rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm text-ink"
              required
            />
            <select
              value={q.type}
              onChange={(e) => update(i, { type: e.target.value as SurveyQuestionType })}
              className="h-9 rounded-[var(--radius-input)] border border-border bg-surface px-2 text-sm"
            >
              <option value="escala">Escala 1–5</option>
              <option value="abierta">Texto libre</option>
            </select>
            <button
              type="button"
              onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Quitar pregunta"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          setQuestions((prev) => [...prev, { id: newId(), text: "", type: "escala" }])
        }
      >
        <Plus weight="bold" className="size-4" />
        Agregar pregunta
      </Button>

      {error && <p className="text-sm font-semibold text-danger-strong">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {savedMsg && (
          <span className="text-xs font-semibold text-success-strong">{savedMsg}</span>
        )}
        <Button type="submit" loading={pending} disabled={questions.length === 0}>
          <FloppyDisk weight="fill" className="size-4" />
          Guardar preguntas
        </Button>
      </div>
    </form>
  );
}
