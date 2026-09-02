"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, X, Warning } from "@phosphor-icons/react";
import {
  saveProgramGroup,
  deleteProgramGroup,
  type GroupFormState,
} from "@/lib/actions/programs";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { WEEKDAYS, WEEK_ORDER, slotsLabel } from "@/lib/schedule";

export type GroupRow = {
  id: string;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  studentCapacity: number | null;
  programLevelId: string | null;
  level: { id: string; name: string } | null;
  slots: { weekday: number; startTime: string; endTime: string }[];
  _count: { enrollments: number };
};

type Level = { id: string; name: string; order: number };

function edadLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}–${max} años`;
  if (min != null) return `${min} años en adelante`;
  if (max != null) return `hasta ${max} años`;
  return "sin límite de edad";
}

/**
 * Los grupos de una actividad: la hora, la edad y los lugares de cada uno.
 *
 * Vive aparte del formulario del programa porque son dos cosas distintas. El
 * programa dice QUÉ es la actividad; el grupo dice a qué hora, para qué edad y
 * cuántos caben — y es lo único que se llena. Habilidades sociales es un solo
 * programa con seis grupos, y hasta ahora no había dónde decirlo sin correr un
 * script.
 */
export function ProgramGroups({
  programId,
  programCapacity,
  levels,
  groups,
  canManage,
}: {
  programId: string;
  /** Cupo del programa: el que hereda un grupo que no trae el suyo. */
  programCapacity: number;
  levels: Level[];
  groups: GroupRow[];
  canManage: boolean;
}) {
  // null = cerrado · "nuevo" = alta · un id = editando ese grupo
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function borrar(id: string) {
    setError(null);
    const r = await deleteProgramGroup(id);
    if (r?.error) setError(r.error);
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink">
          Grupos
          {groups.length > 0 && (
            <span className="ml-1.5 font-normal text-muted">{groups.length}</span>
          )}
        </h4>
        {canManage && editing == null && (
          <Button variant="ghost" size="sm" onClick={() => setEditing("nuevo")}>
            <Plus weight="bold" className="size-3.5" />
            Agregar grupo
          </Button>
        )}
      </div>

      {groups.length === 0 && editing == null && (
        <p className="mt-1.5 text-xs text-muted">
          Sin grupos: valen el horario, la edad y el cupo del programa. Agrega grupos
          cuando la actividad se dé a distintas horas según la edad.
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-[var(--radius-control)] bg-danger-weak px-3 py-2 text-xs font-semibold text-danger-strong">
          <Warning weight="fill" className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {groups.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {groups.map((g) =>
            editing === g.id ? (
              <li key={g.id}>
                <GroupForm
                  programId={programId}
                  group={g}
                  levels={levels}
                  programCapacity={programCapacity}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={g.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs"
              >
                <span className="font-bold text-ink">
                  {[g.level?.name, g.name === g.level?.name ? null : g.name]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="tnum font-semibold text-primary-strong">
                  {slotsLabel(g.slots) || "sin horario"}
                </span>
                <span className="text-muted">{edadLabel(g.ageMin, g.ageMax)}</span>
                <span className="tnum ml-auto font-semibold text-ink">
                  {g._count.enrollments}
                  <span className="font-normal text-muted">
                    {` / ${g.studentCapacity ?? programCapacity} cupos`}
                  </span>
                </span>
                {canManage && (
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing(g.id);
                      }}
                      aria-label={`Editar grupo ${g.name}`}
                      className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface hover:text-ink"
                    >
                      <PencilSimple className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(g.id)}
                      aria-label={`Borrar grupo ${g.name}`}
                      className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                    >
                      <Trash className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {editing === "nuevo" && (
        <div className="mt-2">
          <GroupForm
            programId={programId}
            group={null}
            levels={levels}
            programCapacity={programCapacity}
            onDone={() => setEditing(null)}
          />
        </div>
      )}
    </div>
  );
}

function GroupForm({
  programId,
  group,
  levels,
  programCapacity,
  onDone,
}: {
  programId: string;
  group: GroupRow | null;
  levels: Level[];
  programCapacity: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<GroupFormState, FormData>(
    saveProgramGroup.bind(null, programId, group?.id ?? null),
    undefined,
  );
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const slot = group?.slots[0];
  const err = (campo: string) => state?.errors?.[campo]?.[0];

  return (
    <form
      action={action}
      className="rounded-[var(--radius-control)] border border-border bg-surface p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {levels.length > 0 && (
          <Field label="Nivel" htmlFor={`nivel-${group?.id ?? "nuevo"}`}>
            <Select
              id={`nivel-${group?.id ?? "nuevo"}`}
              name="programLevelId"
              defaultValue={group?.programLevelId ?? ""}
            >
              <option value="">Todo el programa</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Nombre del grupo"
          htmlFor={`nombre-${group?.id ?? "nuevo"}`}
          error={err("name")}
        >
          <Input
            id={`nombre-${group?.id ?? "nuevo"}`}
            name="name"
            required
            defaultValue={group?.name ?? ""}
            placeholder="Grupo 1"
          />
        </Field>
        <Field label="Día" htmlFor={`dia-${group?.id ?? "nuevo"}`} error={err("weekday")}>
          <Select
            id={`dia-${group?.id ?? "nuevo"}`}
            name="weekday"
            defaultValue={String(slot?.weekday ?? 1)}
          >
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Empieza"
            htmlFor={`ini-${group?.id ?? "nuevo"}`}
            error={err("startTime")}
          >
            <Input
              id={`ini-${group?.id ?? "nuevo"}`}
              name="startTime"
              type="time"
              required
              defaultValue={slot?.startTime ?? "16:00"}
            />
          </Field>
          <Field
            label="Termina"
            htmlFor={`fin-${group?.id ?? "nuevo"}`}
            error={err("endTime")}
          >
            <Input
              id={`fin-${group?.id ?? "nuevo"}`}
              name="endTime"
              type="time"
              required
              defaultValue={slot?.endTime ?? "16:45"}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Edad mín." htmlFor={`emin-${group?.id ?? "nuevo"}`}>
            <Input
              id={`emin-${group?.id ?? "nuevo"}`}
              name="ageMin"
              type="number"
              min={0}
              max={120}
              defaultValue={group?.ageMin ?? ""}
            />
          </Field>
          <Field label="Edad máx." htmlFor={`emax-${group?.id ?? "nuevo"}`}>
            <Input
              id={`emax-${group?.id ?? "nuevo"}`}
              name="ageMax"
              type="number"
              min={0}
              max={120}
              defaultValue={group?.ageMax ?? ""}
            />
          </Field>
        </div>
        <Field
          label="Lugares"
          htmlFor={`cupo-${group?.id ?? "nuevo"}`}
          hint={`Vacío = los ${programCapacity} del programa`}
        >
          <Input
            id={`cupo-${group?.id ?? "nuevo"}`}
            name="studentCapacity"
            type="number"
            min={1}
            max={99}
            defaultValue={group?.studentCapacity ?? ""}
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : group ? "Guardar grupo" : "Crear grupo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}
