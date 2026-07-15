"use client";

import { useState } from "react";
import { Plus, DotsThree, Pause, Play, Flag, Trash, Star, PencilSimple } from "@phosphor-icons/react";
import {
  addEnrollment,
  setEnrollmentStatus,
  removeEnrollment,
  setEnrollmentGrade,
} from "@/lib/actions/enrollments";
import { NIVELES } from "@/lib/levels";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { EnrollmentStatusBadge } from "@/components/status";
import { Books } from "@phosphor-icons/react";
import { fecha } from "@/lib/format";
import type { EnrollmentStatus } from "@/lib/generated/prisma/client";

type EnrollmentItem = {
  id: string;
  status: EnrollmentStatus;
  startDate: Date;
  level: string | null;
  levelNote: string | null;
  gradedAt: Date | null;
  program: { id: string; name: string; color: string | null; area: string | null };
};

/** Color del badge según el nivel alcanzado. */
const LEVEL_TONE: Record<string, string> = {
  Inicial: "bg-warning-weak text-warning-strong",
  "En proceso": "bg-primary-weak text-primary-strong",
  Logrado: "bg-success-weak text-success-strong",
};

type ProgramOption = { id: string; name: string };

export function EnrollmentsPanel({
  studentId,
  enrollments,
  allPrograms,
}: {
  studentId: string;
  enrollments: EnrollmentItem[];
  allPrograms: ProgramOption[];
}) {
  const [adding, setAdding] = useState(false);
  const enrolledIds = new Set(enrollments.map((e) => e.program.id));
  const available = allPrograms.filter((p) => !enrolledIds.has(p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programas inscritos</CardTitle>
        {available.length > 0 && !adding && (
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
            description="Inscribe a este participante en uno o más programas."
            action={
              available.length > 0 && !adding ? (
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
            <EnrollmentRow key={e.id} enrollment={e} studentId={studentId} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EnrollmentRow({
  enrollment: e,
  studentId,
}: {
  enrollment: EnrollmentItem;
  studentId: string;
}) {
  const [grading, setGrading] = useState(false);

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
        {e.level && (
          <span
            className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-block ${
              LEVEL_TONE[e.level] ?? "bg-surface-2 text-muted"
            }`}
          >
            {e.level}
          </span>
        )}
        <EnrollmentStatusBadge status={e.status} />
        <EnrollmentMenu enrollmentId={e.id} studentId={studentId} status={e.status} />
      </div>

      {/* Calificación por programa */}
      <div className="mt-2 flex items-center gap-2 pl-12">
        {!grading ? (
          <button
            onClick={() => setGrading(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {e.level ? (
              <>
                <PencilSimple className="size-3.5" />
                {e.levelNote ? `Nivel: ${e.levelNote}` : "Editar calificación"}
                {e.gradedAt ? ` · ${fecha(e.gradedAt)}` : ""}
              </>
            ) : (
              <>
                <Star className="size-3.5" />
                Calificar
              </>
            )}
          </button>
        ) : (
          <form
            action={async (fd) => {
              await setEnrollmentGrade(e.id, studentId, fd);
              setGrading(false);
            }}
            className="flex w-full flex-col gap-2 rounded-[var(--radius-control)] bg-surface-2/60 p-2.5 sm:flex-row sm:items-center"
          >
            <Select name="level" defaultValue={e.level ?? ""} className="sm:w-40">
              <option value="">Sin calificar</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Input
              name="levelNote"
              placeholder="Nota breve (opcional)"
              defaultValue={e.levelNote ?? ""}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Guardar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setGrading(false)}>
                Cancelar
              </Button>
            </div>
          </form>
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
