"use client";

import { useState } from "react";
import { Plus, DotsThree, Pause, Play, Flag, Trash } from "@phosphor-icons/react";
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

type ProgramOption = { id: string; name: string };

export function EnrollmentsPanel({
  studentId,
  enrollments,
  allPrograms,
  canManage = true,
}: {
  studentId: string;
  enrollments: EnrollmentItem[];
  allPrograms: ProgramOption[];
  /** Dirección/coordinación inscriben y modifican; la maestra solo consulta. */
  canManage?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const enrolledIds = new Set(enrollments.map((e) => e.program.id));
  const available = allPrograms.filter((p) => !enrolledIds.has(p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programas inscritos</CardTitle>
        {canManage && available.length > 0 && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
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
          }}
          className="flex flex-col gap-2 border-b border-border bg-surface-2/60 px-5 py-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="programId" className="mb-1.5 block text-sm font-semibold text-ink">
              Programa
            </label>
            <Select id="programId" name="programId" required defaultValue="">
              <option value="" disabled>
                Selecciona un programa…
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="md">
              Inscribir
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
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
                <Button size="sm" onClick={() => setAdding(true)}>
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
