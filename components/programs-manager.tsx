"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Books,
  PencilSimple,
  X,
  Eye,
  EyeSlash,
  UsersThree,
  Clock,
  ChalkboardTeacher,
  ListChecks,
} from "@phosphor-icons/react";
import { TemplateSource, type CopySource, type PresetSource } from "@/components/template-source";
import {
  createProgram,
  updateProgram,
  toggleProgram,
  type ProgramFormState,
} from "@/lib/actions/programs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WEEKDAYS, WEEK_ORDER, slotsLabel, type Slot } from "@/lib/schedule";

type Teacher = { id: string; name: string };

type ScheduleSlot = Slot & { id?: string };

type Level = { id: string; name: string; order: number };

type Program = {
  id: string;
  name: string;
  description: string | null;
  area: string | null;
  color: string | null;
  active: boolean;
  schedule: string | null;
  scheduleSlots: ScheduleSlot[];
  levels: Level[];
  type: string | null;
  ageMin: number | null;
  ageMax: number | null;
  studentCapacity: number;
  collaboratorCapacity: number | null;
  teacherId: string | null;
  teacher: { id: string; name: string } | null;
  _count: { enrollments: number; evaluations: number };
};

/** Texto legible del rango de edad. */
function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${min}–${max} años`;
  if (min != null) return `Desde ${min} años`;
  if (max != null) return `Hasta ${max} años`;
  return null;
}

const SWATCHES = [
  "#E4572E", "#2E86AB", "#8AA624", "#C05299", "#F2A541",
  "#3E7C59", "#6C63FF", "#0EAD9C", "#D7263D", "#B5651D",
];

export function ProgramsManager({
  programs,
  teachers,
  copySources = [],
  presets = [],
  cycleLabel,
  canEditTemplate = false,
  canManage = true,
}: {
  programs: Program[];
  teachers: Teacher[];
  copySources?: CopySource[];
  presets?: PresetSource[];
  /** Quién puede abrir el editor de plantillas (directora o coordinador). */
  canEditTemplate?: boolean;
  /** Quién crea/edita/activa programas (dirección y coordinación); la maestra solo mira. */
  canManage?: boolean;
  /** Ciclo que se está viendo. Si la lista sale vacía es por su oferta, no porque
   *  no existan programas: sin este matiz el vacío invita a crear un duplicado. */
  cycleLabel?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {canManage && !creating && !editingId && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus weight="bold" className="size-4" />
            Nuevo programa
          </Button>
        </div>
      )}

      {creating && (
        <ProgramForm
          action={createProgram}
          onClose={() => setCreating(false)}
          title="Nuevo programa"
          teachers={teachers}
          copySources={copySources}
          presets={presets}
        />
      )}

      {programs.length === 0 && !creating ? (
        <EmptyState
          icon={<Books weight="fill" className="size-6" />}
          title={
            !canManage
              ? "Sin programas a tu cargo"
              : cycleLabel
                ? `Ningún programa corre en ${cycleLabel}`
                : "Aún no hay programas"
          }
          description={
            !canManage
              ? "Cuando dirección te asigne un programa en este ciclo, aparecerá aquí."
              : cycleLabel
                ? "Los programas ya existen: elige cuáles corren en este ciclo desde la oferta de arriba. Crea uno nuevo solo si de verdad no existe."
                : "Crea el primer programa para poder inscribir participantes."
          }
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus weight="bold" className="size-4" />
                Nuevo programa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="sm:col-span-2">
                <ProgramForm
                  action={updateProgram.bind(null, p.id)}
                  onClose={() => setEditingId(null)}
                  title={`Editar “${p.name}”`}
                  defaults={p}
                  teachers={teachers}
                />
              </div>
            ) : (
              <ProgramCard
                key={p.id}
                program={p}
                onEdit={() => setEditingId(p.id)}
                canEditTemplate={canEditTemplate}
                canManage={canManage}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ProgramCard({
  program: p,
  onEdit,
  canEditTemplate,
  canManage,
}: {
  program: Program;
  onEdit: () => void;
  canEditTemplate: boolean;
  canManage: boolean;
}) {
  const color = p.color ?? "var(--primary)";
  return (
    <Card className={`flex flex-col p-5 ${!p.active ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-[var(--radius-control)]"
          style={{ backgroundColor: color + "22", color }}
        >
          <Books weight="fill" className="size-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {!p.active && <Badge tone="neutral">Inactivo</Badge>}
          {p.area && p.active && <Badge tone="neutral">{p.area}</Badge>}
        </div>
      </div>

      <h3 className="mt-3 font-bold text-ink">{p.name}</h3>
      {p.type && (
        <p className="mt-0.5 text-xs font-semibold text-primary-strong">{p.type}</p>
      )}
      {p.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
          {p.description}
        </p>
      )}

      {/* Datos de la actividad. El horario estructurado manda sobre el texto libre. */}
      <dl className="mt-3 space-y-1.5 text-sm text-muted">
        {(() => {
          const hasLevelSlots = p.scheduleSlots.some((s) => s.programLevelId);
          if (p.scheduleSlots.length > 0 && hasLevelSlots) {
            // Horario separado por nivel: una línea por nivel (más "Todo el programa").
            const shared = p.scheduleSlots.filter((s) => !s.programLevelId);
            const rows = [
              ...p.levels
                .map((l) => ({
                  label: l.name,
                  slots: p.scheduleSlots.filter((s) => s.programLevelId === l.id),
                }))
                .filter((r) => r.slots.length > 0),
              ...(shared.length > 0
                ? [{ label: "Todo el programa", slots: shared }]
                : []),
            ];
            return (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-subtle" />
                <span className="space-y-0.5">
                  {rows.map((r) => (
                    <span key={r.label} className="block">
                      <span className="font-medium text-ink">{r.label}:</span>{" "}
                      {slotsLabel(r.slots)}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          if (p.scheduleSlots.length > 0 || p.schedule) {
            return (
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-subtle" />
                <span>
                  {p.scheduleSlots.length > 0 ? slotsLabel(p.scheduleSlots) : p.schedule}
                </span>
              </div>
            );
          }
          return null;
        })()}
        {ageRangeLabel(p.ageMin, p.ageMax) && (
          <div className="flex items-center gap-2">
            <UsersThree className="size-4 shrink-0 text-subtle" />
            <span>{ageRangeLabel(p.ageMin, p.ageMax)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <ChalkboardTeacher className="size-4 shrink-0 text-subtle" />
          <span>
            {p.teacher ? (
              <>Maestro: <span className="font-medium text-ink">{p.teacher.name}</span></>
            ) : (
              <span className="italic">Sin maestro asignado</span>
            )}
          </span>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <UsersThree className="size-4" />
          <span className="tnum font-semibold text-ink">{p._count.enrollments}</span>
          <span>/ {p.studentCapacity} cupos</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {/* Con texto y no solo el icono: era la ÚNICA puerta a las plantillas y
              nadie la encontraba (no hay entrada en el menú). Oculta a quien la
              compuerta rebotaría al panel: un enlace que no lleva a ningún lado. */}
          {canEditTemplate && (
            <Link
              href={`/programas/${p.id}/plantilla`}
              className="flex h-8 items-center gap-1.5 rounded-[var(--radius-input)] px-2 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ListChecks className="size-[1.05rem]" />
              Plantilla
            </Link>
          )}
          {canManage && (
            <>
              <form action={toggleProgram.bind(null, p.id, !p.active)}>
                <button
                  type="submit"
                  aria-label={p.active ? "Desactivar programa" : "Activar programa"}
                  className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {p.active ? <EyeSlash className="size-[1.05rem]" /> : <Eye className="size-[1.05rem]" />}
                </button>
              </form>
              <button
                onClick={onEdit}
                aria-label="Editar programa"
                className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <PencilSimple className="size-[1.05rem]" />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Editor de días y horas de clase. Mantiene las filas en estado local y las envía
 * como JSON en un campo oculto "slots"; el servidor reemplaza el horario completo.
 */
function SlotsEditor({ initial, levels = [] }: { initial: ScheduleSlot[]; levels?: Level[] }) {
  const [slots, setSlots] = useState<Slot[]>(
    initial.map(({ weekday, startTime, endTime, programLevelId }) => ({
      weekday,
      startTime,
      endTime,
      programLevelId: programLevelId ?? null,
    })),
  );

  const update = (i: number, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // Solo los programas con niveles pueden separar el horario por nivel.
  const byLevel = levels.length > 0;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-ink">Días de clase</span>
      {byLevel && (
        <p className="mb-1.5 text-xs text-muted">
          Cada nivel puede tener su propio horario. Deja «Todo el programa» si el
          horario es igual para todos.
        </p>
      )}
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Día de la semana"
              value={s.weekday}
              onChange={(e) => update(i, { weekday: Number(e.target.value) })}
              className="w-40"
            >
              {WEEK_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS[d]}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Hora de inicio"
              type="time"
              value={s.startTime}
              onChange={(e) => update(i, { startTime: e.target.value })}
              className="w-28"
              required
            />
            <span className="text-sm text-subtle">a</span>
            <Input
              aria-label="Hora de fin"
              type="time"
              value={s.endTime}
              onChange={(e) => update(i, { endTime: e.target.value })}
              className="w-28"
              required
            />
            {byLevel && (
              <Select
                aria-label="Nivel"
                value={s.programLevelId ?? ""}
                onChange={(e) => update(i, { programLevelId: e.target.value || null })}
                className="w-44"
              >
                <option value="">Todo el programa</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
            <button
              type="button"
              onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Quitar día"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="mt-2"
        onClick={() =>
          setSlots((prev) => {
            // La fila nueva hereda la hora de la anterior: casi siempre es la misma.
            const last = prev[prev.length - 1];
            return [
              ...prev,
              {
                weekday: last ? (last.weekday % 6) + 1 : 1,
                startTime: last?.startTime ?? "10:00",
                endTime: last?.endTime ?? "11:00",
                programLevelId: last?.programLevelId ?? null,
              },
            ];
          })
        }
      >
        <Plus weight="bold" className="size-4" />
        Agregar día
      </Button>
    </div>
  );
}

function ProgramForm({
  action,
  onClose,
  title,
  defaults,
  teachers,
  copySources,
  presets,
}: {
  action: (prev: ProgramFormState, fd: FormData) => Promise<ProgramFormState>;
  onClose: () => void;
  title: string;
  defaults?: Partial<Program>;
  teachers: Teacher[];
  /** Solo al crear: de dónde sacar la evaluación. Al editar no aplica. */
  copySources?: CopySource[];
  presets?: PresetSource[];
}) {
  const [state, formAction, pending] = useActionState<ProgramFormState, FormData>(
    action,
    undefined,
  );
  const [color, setColor] = useState(defaults?.color ?? SWATCHES[0]);
  const err = state?.errors ?? {};

  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok]);

  return (
    <Card className="p-5 sm:p-6">
      <form action={formAction} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {copySources && presets && (
          <TemplateSource programs={copySources} presets={presets} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" required error={err.name?.[0]}>
            <Input id="name" name="name" defaultValue={defaults?.name} required autoFocus />
          </Field>
          <Field label="Área" htmlFor="area" hint="Ej. Comunicación, Motor, Cognición.">
            <Input id="area" name="area" defaultValue={defaults?.area ?? ""} />
          </Field>
        </div>

        <Field label="Descripción" htmlFor="description">
          <Textarea id="description" name="description" rows={2} defaultValue={defaults?.description ?? ""} />
        </Field>

        {/* Días y horas de clase: es lo que pinta el calendario del equipo. */}
        <SlotsEditor initial={defaults?.scheduleSlots ?? []} levels={defaults?.levels ?? []} />

        {/* Datos de la actividad */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nota de horario (opcional)"
            htmlFor="schedule"
            hint="Texto libre, ej. “Se suspende en vacaciones”."
          >
            <Input id="schedule" name="schedule" defaultValue={defaults?.schedule ?? ""} />
          </Field>
          <Field label="Tipo de actividad" htmlFor="type">
            <Input id="type" name="type" defaultValue={defaults?.type ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Edad mín." htmlFor="ageMin">
            <Input id="ageMin" name="ageMin" type="number" min={0} max={120} defaultValue={defaults?.ageMin ?? ""} />
          </Field>
          <Field label="Edad máx." htmlFor="ageMax">
            <Input id="ageMax" name="ageMax" type="number" min={0} max={120} defaultValue={defaults?.ageMax ?? ""} />
          </Field>
          <Field label="Cupo alumnos" htmlFor="studentCapacity">
            <Input
              id="studentCapacity"
              name="studentCapacity"
              type="number"
              min={0}
              defaultValue={defaults?.studentCapacity ?? 7}
            />
          </Field>
          <Field label="Cupo colab." htmlFor="collaboratorCapacity">
            <Input
              id="collaboratorCapacity"
              name="collaboratorCapacity"
              type="number"
              min={0}
              defaultValue={defaults?.collaboratorCapacity ?? ""}
            />
          </Field>
        </div>

        <Field label="Maestro a cargo" htmlFor="teacherId">
          <Select id="teacherId" name="teacherId" defaultValue={defaults?.teacherId ?? ""}>
            <option value="">Sin asignar</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Color</span>
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform ${
                  color === c ? "scale-110 ring-ink" : "ring-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {defaults ? "Guardar cambios" : "Crear programa"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
