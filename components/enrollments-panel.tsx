"use client";

import { useState } from "react";
import { Plus, DotsThree, Pause, Play, Flag, Trash, Warning } from "@phosphor-icons/react";
import {
  addEnrollment,
  setEnrollmentStatus,
  removeEnrollment,
} from "@/lib/actions/enrollments";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { EnrollmentStatusBadge } from "@/components/status";
import { Books } from "@phosphor-icons/react";
import { fecha } from "@/lib/format";
import type { EnrollmentStatus } from "@/lib/generated/prisma/client";

type EnrollmentItem = {
  id: string;
  status: EnrollmentStatus;
  startDate: Date;
  program: { id: string; name: string; color: string | null; area: string | null };
};

/**
 * Una actividad a la que se puede inscribir, con sus reparos para ESTE participante.
 * Los reparos no cierran la puerta —dirección es la única que puede pasar por
 * encima— pero se advierten y hay que confirmarlos.
 */
type ProgramOption = {
  id: string;
  name: string;
  /** Fuera del rango de edad de la actividad (texto del rango), o null. */
  ageWarning?: string | null;
  /** Se empalma con otra actividad que ya lleva (con cuál y a qué hora), o null. */
  clashWarning?: string | null;
};

export function EnrollmentsPanel({
  studentId,
  enrollments,
  allPrograms,
  canManage = true,
  loadWarning = null,
}: {
  studentId: string;
  enrollments: EnrollmentItem[];
  allPrograms: ProgramOption[];
  /** Dirección, coordinación y operación inscriben; terapeutas y lectores solo consultan. */
  canManage?: boolean;
  /**
   * Ya llegó al tope de actividades del ciclo. Es un reparo del participante, no de
   * la actividad, por eso viene aquí y no en cada opción.
   */
  loadWarning?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const enrolledIds = new Set(enrollments.map((e) => e.program.id));
  const available = allPrograms.filter((p) => !enrolledIds.has(p.id));
  const selected = available.find((p) => p.id === selectedId);
  const warnings = [
    selected?.ageWarning,
    selected?.clashWarning,
    selected ? loadWarning : null,
  ].filter(Boolean) as string[];

  function startAdding() {
    setSelectedId("");
    setAdding(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programas inscritos</CardTitle>
        {canManage && available.length > 0 && !adding && (
          <Button variant="secondary" size="sm" onClick={startAdding}>
            <Plus weight="bold" className="size-4" />
            Inscribir
          </Button>
        )}
      </CardHeader>

      {adding && (
        <form
          action={async (fd) => {
            await addEnrollment(studentId, fd);
            setAdding(false);
            setSelectedId("");
          }}
          className="border-b border-border bg-surface-2/60 px-5 py-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="programId" className="mb-1.5 block text-sm font-semibold text-ink">
                Programa
              </label>
              <Select
                id="programId"
                name="programId"
                required
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="" disabled>
                  Selecciona un programa…
                </option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.clashWarning ? " · empalmado" : ""}
                    {p.ageWarning ? " · fuera de edad" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="md">
                Inscribir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setAdding(false);
                  setSelectedId("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>

          {/* Reparos de la actividad. La familia no puede saltárselos desde Mi
              espacio; dirección sí, pero confirmando que lo hace a sabiendas. */}
          {warnings.length > 0 && (
            <div className="mt-3 rounded-[var(--radius-control)] border border-warning bg-warning-weak/40 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-warning-strong">
                <Warning weight="fill" className="size-4 shrink-0" />
                {selected?.name}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-ink">
                {warnings.map((w) => (
                  <li key={w}>{w}.</li>
                ))}
              </ul>
              <label className="mt-2 flex items-start gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  name="force"
                  value="1"
                  required
                  className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                />
                Inscribir de todos modos: lo autoriza dirección.
              </label>
            </div>
          )}
        </form>
      )}

      {enrollments.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Books weight="fill" className="size-6" />}
            title="Sin programas todavía"
            description={
              canManage
                ? "Inscribe a este participante en uno o más programas."
                : "Coordinación o dirección lo inscribirán a sus programas."
            }
            action={
              canManage && available.length > 0 && !adding ? (
                <Button size="sm" onClick={startAdding}>
                  <Plus weight="bold" className="size-4" />
                  Inscribir en un programa
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {enrollments.map((e) => (
            <EnrollmentRow key={e.id} enrollment={e} studentId={studentId} canManage={canManage} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EnrollmentRow({
  enrollment: e,
  studentId,
  canManage,
}: {
  enrollment: EnrollmentItem;
  studentId: string;
  canManage: boolean;
}) {
  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="size-9 shrink-0 rounded-[var(--radius-input)]"
          style={{ backgroundColor: (e.program.color ?? "var(--primary)") + "22" }}
        >
          <span
            className="flex size-full items-center justify-center rounded-[var(--radius-input)]"
            style={{ color: e.program.color ?? "var(--primary)" }}
          >
            <Books weight="fill" className="size-[1.1rem]" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{e.program.name}</p>
          <p className="text-xs text-muted">
            {e.program.area ? `${e.program.area} · ` : ""}Desde {fecha(e.startDate)}
          </p>
        </div>
        <EnrollmentStatusBadge status={e.status} />
        {canManage && (
          <EnrollmentMenu enrollmentId={e.id} studentId={studentId} status={e.status} />
        )}
      </div>
    </li>
  );
}

function EnrollmentMenu({
  enrollmentId,
  studentId,
  status,
}: {
  enrollmentId: string;
  studentId: string;
  status: EnrollmentStatus;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Opciones de inscripción"
        className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <DotsThree weight="bold" className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface p-1 shadow-[var(--shadow-lg)]">
          {status !== "ACTIVA" && (
            <MenuAction
              action={setEnrollmentStatus.bind(null, enrollmentId, studentId, "ACTIVA")}
              icon={<Play className="size-4" />}
              label="Marcar activa"
            />
          )}
          {status === "ACTIVA" && (
            <MenuAction
              action={setEnrollmentStatus.bind(null, enrollmentId, studentId, "PAUSADA")}
              icon={<Pause className="size-4" />}
              label="Pausar"
            />
          )}
          {status !== "FINALIZADA" && (
            <MenuAction
              action={setEnrollmentStatus.bind(null, enrollmentId, studentId, "FINALIZADA")}
              icon={<Flag className="size-4" />}
              label="Finalizar"
            />
          )}
          <MenuAction
            action={removeEnrollment.bind(null, enrollmentId, studentId)}
            icon={<Trash className="size-4" />}
            label="Quitar inscripción"
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuAction({
  action,
  icon,
  label,
  danger,
}: {
  action: () => Promise<void>;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={`flex w-full items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-2 text-left text-sm font-medium transition-colors ${
          danger
            ? "text-danger-strong hover:bg-danger-weak"
            : "text-ink hover:bg-surface-2"
        }`}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}
