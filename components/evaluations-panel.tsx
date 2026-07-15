"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Star, Trash, X } from "@phosphor-icons/react";
import {
  addEvaluation,
  deleteEvaluation,
  type EvalFormState,
} from "@/lib/actions/evaluations";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { fecha } from "@/lib/format";

type EvaluationItem = {
  id: string;
  title: string;
  date: Date;
  score: number | null;
  scale: string | null;
  level: string | null;
  notes: string | null;
  program: { name: string; color: string | null } | null;
  evaluator: { name: string } | null;
};

type ProgramOption = { id: string; name: string };

export function EvaluationsPanel({
  studentId,
  evaluations,
  programs,
}: {
  studentId: string;
  evaluations: EvaluationItem[];
  programs: ProgramOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<EvalFormState, FormData>(
    addEvaluation.bind(null, studentId),
    undefined,
  );
  const err = state?.errors ?? {};

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de evaluaciones</CardTitle>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus weight="bold" className="size-4" />
            Registrar
          </Button>
        )}
      </CardHeader>

      {open && (
        <form
          action={formAction}
          className="space-y-4 border-b border-border bg-surface-2/60 px-5 py-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Nueva evaluación</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" htmlFor="title" required error={err.title?.[0]} className="sm:col-span-2">
              <Input id="title" name="title" placeholder="Ej. Avance del trimestre" required autoFocus />
            </Field>
            <Field label="Programa" htmlFor="programId">
              <Select id="programId" name="programId" defaultValue="">
                <option value="">General (sin programa)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha" htmlFor="date">
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Calificación" htmlFor="score" hint="De 0 a 4 (el 4 es el máximo).">
              <Input id="score" name="score" type="number" step="0.1" min="0" max="4" placeholder="4" />
            </Field>
            <Field label="Nivel alcanzado" htmlFor="level">
              <Select id="level" name="level" defaultValue="">
                <option value="">Sin nivel</option>
                <option value="Inicial">Inicial</option>
                <option value="En proceso">En proceso</option>
                <option value="Logrado">Logrado</option>
              </Select>
            </Field>
            <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" rows={3} placeholder="¿Cómo le fue? ¿Qué observaste?" />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar evaluación
            </Button>
          </div>
        </form>
      )}

      {evaluations.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Star weight="fill" className="size-6" />}
            title="Sin evaluaciones todavía"
            description="Registra la primera evaluación para empezar a seguir su progreso."
            action={
              !open ? (
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus weight="bold" className="size-4" />
                  Registrar evaluación
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ol className="relative px-5 py-4">
          {evaluations.map((e, i) => (
            <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
              {/* Línea de tiempo */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-1 size-3 shrink-0 rounded-full ring-4 ring-surface"
                  style={{ backgroundColor: e.program?.color ?? "var(--primary)" }}
                />
                {i < evaluations.length - 1 && (
                  <span className="w-px flex-1 bg-border" />
                )}
              </div>

              <div className="group -mt-1 flex-1 rounded-[var(--radius-control)] border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-surface-2/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{e.title}</p>
                    <p className="text-xs text-muted">
                      {fecha(e.date)}
                      {e.program ? ` · ${e.program.name}` : ""}
                      {e.evaluator ? ` · ${e.evaluator.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.score != null && (
                      <span className="tnum rounded-[var(--radius-input)] bg-primary-weak px-2 py-0.5 text-sm font-extrabold text-primary-strong">
                        {e.score}
                        {e.scale ? <span className="text-[0.7rem] font-semibold opacity-70">/{e.scale.replace("1-", "")}</span> : ""}
                      </span>
                    )}
                    <DeleteEvaluationButton evaluationId={e.id} studentId={studentId} />
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {e.level && (
                    <span className="rounded-[var(--radius-pill)] bg-accent-weak px-2 py-0.5 text-xs font-semibold text-accent-strong">
                      {e.level}
                    </span>
                  )}
                </div>
                {e.notes && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function DeleteEvaluationButton({
  evaluationId,
  studentId,
}: {
  evaluationId: string;
  studentId: string;
}) {
  return (
    <form action={deleteEvaluation.bind(null, evaluationId, studentId)}>
      <button
        type="submit"
        aria-label="Eliminar evaluación"
        className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle opacity-0 transition-all hover:bg-danger-weak hover:text-danger-strong focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash className="size-4" />
      </button>
    </form>
  );
}
