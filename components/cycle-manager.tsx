"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, PencilSimple, Warning } from "@phosphor-icons/react";
import { createCycle, updateCycle, type CycleFormState } from "@/lib/actions/cycles";
import {
  SEASONS,
  SEASON_LABEL,
  cycleLabel,
  dateInputValue,
  defaultCycleDates,
} from "@/lib/cycles";
import { fechaDia } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { CycleSeason } from "@/lib/generated/prisma/client";

type CycleItem = {
  id: string;
  label: string;
  season: CycleSeason;
  year: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  maxEnrollments: number | null;
  programCount: number;
};

/**
 * Los ciclos de la casa: darlos de alta y ponerles sus fechas y su tope de
 * actividades. Antes solo se creaban corriendo un script, así que abrir un ciclo
 * dependía de quien tuviera la terminal.
 */
export function CycleManager({
  cycles,
  readOnly = false,
}: {
  cycles: CycleItem[];
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">Ciclos</h3>
        {!readOnly && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <CalendarPlus weight="bold" className="size-4" />
            Nuevo ciclo
          </Button>
        )}
      </div>

      {adding && (
        <NewCycleForm
          cycles={cycles}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}

      <ul className="space-y-2">
        {cycles.map((c) => (
          <li
            key={c.id}
            className="rounded-[var(--radius-control)] border border-border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {c.label}
                  {c.active && (
                    <span className="rounded-full bg-info-weak px-2 py-0.5 text-[0.7rem] font-bold text-info">
                      Ciclo activo
                    </span>
                  )}
                </span>
                <p className="mt-0.5 text-xs text-muted">
                  {c.startDate && c.endDate
                    ? `${fechaDia(c.startDate)} al ${fechaDia(c.endDate)}`
                    : "Sin fechas"}
                  {` · ${c.programCount} programa${c.programCount === 1 ? "" : "s"} en la oferta`}
                  {c.maxEnrollments != null
                    ? ` · tope de ${c.maxEnrollments} actividades por participante`
                    : " · sin tope de actividades"}
                </p>
              </div>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(editing === c.id ? null : c.id)}
                >
                  <PencilSimple className="size-4" />
                  {editing === c.id ? "Cerrar" : "Editar"}
                </Button>
              )}
            </div>
            {editing === c.id && (
              <EditCycleForm cycle={c} onDone={() => setEditing(null)} />
            )}
          </li>
        ))}
      </ul>
      {cycles.length === 0 && (
        <p className="text-sm text-muted">
          Todavía no hay ciclos. Crea el primero para poder inscribir.
        </p>
      )}
    </Card>
  );
}

function NewCycleForm({
  cycles,
  onDone,
  onCancel,
}: {
  cycles: CycleItem[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<CycleFormState, FormData>(
    async (prev, fd) => {
      const result = await createCycle(prev, fd);
      if (result?.ok) onDone();
      return result;
    },
    undefined,
  );
  const err = state?.errors ?? {};

  // La temporada y el año mandan sobre la etiqueta y las fechas propuestas, así que
  // se llevan en estado: la directora ve cómo se va a llamar el ciclo antes de guardar.
  const thisYear = new Date().getFullYear();
  const [season, setSeason] = useState<CycleSeason>("ENE_JUN");
  const [year, setYear] = useState(String(thisYear));
  const parsedYear = Number(year) || thisYear;
  const fechas = defaultCycleDates(season, parsedYear);

  // Por defecto se copia la oferta del ciclo más reciente: es lo que casi siempre
  // se quiere, y un ciclo sin oferta no sirve para inscribir.
  const reciente = cycles[0]?.id ?? "";

  return (
    <form
      action={formAction}
      className="mb-4 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-2/60 p-4"
    >
      <p className="text-sm font-bold text-ink">
        Nuevo ciclo:{" "}
        <span className="text-primary-strong">{cycleLabel(season, parsedYear)}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Temporada" htmlFor="season" error={err.season?.[0]}>
          <Select
            id="season"
            name="season"
            value={season}
            onChange={(e) => setSeason(e.target.value as CycleSeason)}
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Año" htmlFor="year" error={err.year?.[0]}>
          <Input
            id="year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
        <Field
          label="Empieza"
          htmlFor="startDate"
          error={err.startDate?.[0]}
          hint="Sirve para saber qué clases son de este ciclo."
        >
          {/* key: al cambiar temporada o año se vuelve a proponer la fecha */}
          <Input
            key={`start-${season}-${parsedYear}`}
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={fechas.start}
          />
        </Field>
        <Field label="Termina" htmlFor="endDate" error={err.endDate?.[0]}>
          <Input
            key={`end-${season}-${parsedYear}`}
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={fechas.end}
          />
        </Field>
        <Field
          label="Tope de actividades por participante"
          htmlFor="maxEnrollments"
          hint="Déjalo vacío si en este ciclo no hay tope."
          error={err.maxEnrollments?.[0]}
        >
          <Input
            id="maxEnrollments"
            name="maxEnrollments"
            type="number"
            min={1}
            placeholder="Sin tope"
          />
        </Field>
        <Field
          label="Copiar la oferta de"
          htmlFor="copyOfferFrom"
          hint="Trae los programas activos de ese ciclo. Después quitas los que no corran."
        >
          <Select id="copyOfferFrom" name="copyOfferFrom" defaultValue={reciente}>
            <option value="">No copiar nada</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="activate"
          value="1"
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        Activarlo ahora (es donde se inscribe y se califica de aquí en adelante)
      </label>

      {state?.error && (
        <p className="flex items-start gap-1.5 rounded-[var(--radius-control)] border border-danger bg-danger-weak/40 p-3 text-sm font-semibold text-danger-strong">
          <Warning weight="fill" className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="md" loading={pending}>
          <Check weight="bold" className="size-4" />
          Crear ciclo
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function EditCycleForm({ cycle, onDone }: { cycle: CycleItem; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CycleFormState, FormData>(
    async (prev, fd) => {
      const result = await updateCycle(cycle.id, prev, fd);
      if (result?.ok) onDone();
      return result;
    },
    undefined,
  );
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-border pt-3">
      {/* La temporada y el año no se editan: definen la identidad del ciclo y de
          ellos sale su nombre. Van como campos ocultos para que el validador —el
          mismo del alta— tenga todo lo que espera. */}
      <input type="hidden" name="season" value={cycle.season} />
      <input type="hidden" name="year" value={cycle.year} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Empieza" htmlFor={`start-${cycle.id}`} error={err.startDate?.[0]}>
          <Input
            id={`start-${cycle.id}`}
            name="startDate"
            type="date"
            defaultValue={dateInputValue(cycle.startDate)}
          />
        </Field>
        <Field label="Termina" htmlFor={`end-${cycle.id}`} error={err.endDate?.[0]}>
          <Input
            id={`end-${cycle.id}`}
            name="endDate"
            type="date"
            defaultValue={dateInputValue(cycle.endDate)}
          />
        </Field>
        <Field
          label="Tope de actividades"
          htmlFor={`max-${cycle.id}`}
          hint="Vacío = sin tope."
          error={err.maxEnrollments?.[0]}
        >
          <Input
            id={`max-${cycle.id}`}
            name="maxEnrollments"
            type="number"
            min={1}
            placeholder="Sin tope"
            defaultValue={cycle.maxEnrollments ?? ""}
          />
        </Field>
      </div>

      {state?.error && (
        <p className="text-sm font-semibold text-danger-strong">{state.error}</p>
      )}

      <Button type="submit" size="sm" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
