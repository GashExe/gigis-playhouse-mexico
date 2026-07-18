"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  X,
  CaretDown,
  ClockCountdown,
  FileText,
  ChatCircleText,
  NotePencil,
  Stack,
  Trash,
  UsersThree,
  EyeSlash,
  Users,
  CalendarX,
} from "@phosphor-icons/react";
import {
  addStudentNote,
  deleteStudentNote,
  saveClassNotes,
  setAttendance,
  setAttendanceNote,
  setClassCanceled,
} from "@/lib/actions/classes";
import { fecha as fechaLabel } from "@/lib/format";
import { initials } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { GradingPanel } from "@/components/grading-panel";

type StudentLite = { id: string; firstName: string; lastName: string; matricula?: string | null };
type AttendanceRow = { studentId: string; status: string; note: string | null };
type Note = {
  id: string;
  body: string;
  visibleToFamily: boolean;
  createdAt: string;
  authorName: string | null;
  canDelete: boolean;
  student: { id: string; firstName: string; lastName: string };
};
type GradingItem = { id: string; code: string | null; text: string; score: number | null };
type GradingBlock = { id: string; code: string | null; name: string; items: GradingItem[] };
type StudentGrading = {
  levelName: string;
  nextLevelName: string | null;
  blocks: GradingBlock[];
} | null;

const STATUS_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string; weight?: "bold" }>; active: string }
> = {
  PRESENTE: { label: "Presente", icon: Check, active: "bg-success-weak text-success-strong border-transparent" },
  RETARDO: { label: "Retardo", icon: ClockCountdown, active: "bg-warning-weak text-warning-strong border-transparent" },
  JUSTIFICADO: { label: "Justif.", icon: FileText, active: "bg-info-weak text-info border-transparent" },
  AUSENTE: { label: "Ausente", icon: X, active: "bg-danger-weak text-danger-strong border-transparent" },
};
const STATUS_ORDER = ["PRESENTE", "RETARDO", "JUSTIFICADO", "AUSENTE"] as const;

export function ClassPanel({
  programId,
  dateKey,
  color,
  cycleId,
  passThreshold,
  grading,
  students,
  attendance,
  classNotes,
  notes,
}: {
  programId: string;
  dateKey: string;
  color: string;
  cycleId: string | null;
  passThreshold: number;
  grading: Record<string, StudentGrading>;
  students: StudentLite[];
  attendance: AttendanceRow[];
  classNotes: string;
  notes: Note[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <AttendanceList
          programId={programId}
          dateKey={dateKey}
          cycleId={cycleId}
          passThreshold={passThreshold}
          grading={grading}
          students={students}
          attendance={attendance}
          notes={notes}
        />
      </div>
      <div className="space-y-5 lg:col-span-2">
        <ClassNotes programId={programId} dateKey={dateKey} initial={classNotes} />
        <NotesFeed color={color} notes={notes} />
      </div>
    </div>
  );
}

/* ---------- Suspender / reactivar la clase del día ---------- */

/**
 * Control de suspensión de la clase de una fecha. Suspendida, la familia lo ve
 * en Mi espacio y el calendario la tacha; reactivarla borra el motivo.
 */
export function CancelClassControl({
  programId,
  dateKey,
  canceled,
  reason,
}: {
  programId: string;
  dateKey: string;
  canceled: boolean;
  reason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (canceled) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-warning bg-warning-weak/50 px-4 py-3">
        <CalendarX weight="fill" className="size-5 shrink-0 text-warning-strong" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-warning-strong">Clase suspendida</p>
          {reason && <p className="text-xs text-muted">{reason}</p>}
        </div>
        <form
          action={(fd) =>
            startTransition(async () => {
              await setClassCanceled(programId, dateKey, false, fd);
            })
          }
        >
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            Reactivar clase
          </Button>
        </form>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-warning-weak hover:text-warning-strong"
      >
        <CalendarX className="size-4" />
        Suspender esta clase
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await setClassCanceled(programId, dateKey, true, fd);
          setOpen(false);
        })
      }
      className="flex w-full flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-warning bg-warning-weak/40 p-2.5"
    >
      <Input
        name="reason"
        autoFocus
        placeholder="Motivo que verá la familia (ej. “vacaciones”, “evento”)"
        className="h-9 flex-1 bg-surface text-xs"
      />
      <Button type="submit" size="sm" loading={pending}>
        Suspender
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}

/* ---------- Lista de asistencia (con panel por alumno) ---------- */

function AttendanceList({
  programId,
  dateKey,
  cycleId,
  passThreshold,
  grading,
  students,
  attendance,
  notes,
}: {
  programId: string;
  dateKey: string;
  cycleId: string | null;
  passThreshold: number;
  grading: Record<string, StudentGrading>;
  students: StudentLite[];
  attendance: AttendanceRow[];
  notes: Note[];
}) {
  const [, startTransition] = useTransition();
  const serverMap = new Map(attendance.map((a) => [a.studentId, a]));
  // Optimista: el toque pinta el botón al instante; el servidor confirma al refrescar.
  const [optimistic, applyOptimistic] = useOptimistic(
    serverMap,
    (prev, next: { studentId: string; status: string }) => {
      const map = new Map(prev);
      const before = map.get(next.studentId);
      map.set(next.studentId, {
        studentId: next.studentId,
        status: next.status,
        note: before?.note ?? null,
      });
      return map;
    },
  );

  const counts = { PRESENTE: 0, RETARDO: 0, JUSTIFICADO: 0, AUSENTE: 0 } as Record<string, number>;
  for (const a of optimistic.values()) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const pending = students.length - [...optimistic.values()].length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <UsersThree weight="fill" className="size-4 text-primary" />
          Lista de asistencia
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) =>
            counts[s] > 0 ? (
              <span
                key={s}
                className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-bold ${STATUS_META[s].active}`}
              >
                {counts[s]} {STATUS_META[s].label.toLowerCase()}
              </span>
            ) : null,
          )}
          {pending > 0 && (
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-muted">
              {pending} sin marcar
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Toca a un alumno para dejarle una anotación o calificar su evaluación aquí mismo.
      </p>

      {students.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No hay alumnos inscritos a este programa en el ciclo activo.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {students.map((s) => {
            const row = optimistic.get(s.id);
            return (
              <AttendanceItem
                key={s.id}
                student={s}
                row={row}
                programId={programId}
                cycleId={cycleId}
                passThreshold={passThreshold}
                grading={grading[s.id] ?? null}
                studentNotes={notes.filter((n) => n.student.id === s.id)}
                onMark={(status) =>
                  startTransition(async () => {
                    applyOptimistic({ studentId: s.id, status });
                    await setAttendance(programId, dateKey, s.id, status);
                  })
                }
                noteAction={setAttendanceNote.bind(null, programId, dateKey, s.id)}
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AttendanceItem({
  student: s,
  row,
  programId,
  cycleId,
  passThreshold,
  grading,
  studentNotes,
  onMark,
  noteAction,
}: {
  student: StudentLite;
  row: AttendanceRow | undefined;
  programId: string;
  cycleId: string | null;
  passThreshold: number;
  grading: StudentGrading;
  studentNotes: Note[];
  onMark: (status: string) => void;
  noteAction: (formData: FormData) => Promise<void>;
}) {
  const [showNote, setShowNote] = useState(Boolean(row?.note));
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Tocar al alumno abre su panel: anotaciones y evaluación sin salir de aquí. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-weak text-xs font-bold text-primary-strong"
          >
            {initials(`${s.firstName} ${s.lastName}`)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">
              {s.firstName} {s.lastName}
            </span>
            {s.matricula && (
              <span className="tnum block text-xs text-subtle">{s.matricula}</span>
            )}
          </span>
          <CaretDown
            className={`size-4 shrink-0 text-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex items-center gap-1">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            const active = row?.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onMark(status)}
                title={meta.label}
                aria-pressed={active}
                className={`flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 text-xs font-bold transition-colors ${
                  active
                    ? meta.active
                    : "border-border bg-surface text-subtle hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon weight="bold" className="size-3.5" />
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            aria-label="Nota de asistencia"
            disabled={!row}
            title={row ? "Agregar detalle" : "Marca asistencia primero"}
            className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <NotePencil className="size-4" />
          </button>
        </div>
      </div>
      {showNote && row && (
        <form action={noteAction} className="mt-2 flex items-center gap-2 pl-12">
          <Input
            name="note"
            defaultValue={row.note ?? ""}
            placeholder="Detalle (ej. “aviso de la mamá”)"
            className="h-9 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary">
            Guardar
          </Button>
        </form>
      )}

      {expanded && (
        <StudentDrawer
          student={s}
          programId={programId}
          cycleId={cycleId}
          passThreshold={passThreshold}
          grading={grading}
          studentNotes={studentNotes}
        />
      )}
    </li>
  );
}

/* ---------- Panel del alumno: anotación + evaluación ---------- */

function StudentDrawer({
  student: s,
  programId,
  cycleId,
  passThreshold,
  grading,
  studentNotes,
}: {
  student: StudentLite;
  programId: string;
  cycleId: string | null;
  passThreshold: number;
  grading: StudentGrading;
  studentNotes: Note[];
}) {
  const [tab, setTab] = useState<"nota" | "evaluacion">("nota");
  const formRef = useRef<HTMLFormElement>(null);

  const TABS = [
    { id: "nota" as const, label: "Anotación", icon: NotePencil },
    { id: "evaluacion" as const, label: "Evaluación", icon: Stack },
  ];

  return (
    <div className="ml-0 mt-3 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3.5 sm:ml-12">
      <div className="flex gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex h-8 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-xs font-bold transition-colors ${
              tab === id
                ? "bg-primary text-white"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "nota" ? (
        <div className="mt-3 space-y-3">
          <form
            ref={formRef}
            action={async (fd) => {
              await addStudentNote(programId, fd);
              formRef.current?.reset();
            }}
            className="space-y-2.5"
          >
            <input type="hidden" name="studentId" value={s.id} />
            <Textarea
              name="body"
              rows={2}
              required
              placeholder={`Anotación sobre ${s.firstName}. Ej. “Hoy logró contar hasta 10 sin apoyo.”`}
              className="min-h-16 bg-surface"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  name="visibleToFamily"
                  defaultChecked
                  className="size-4 accent-[var(--primary)]"
                />
                Visible para la familia
              </label>
              <Button type="submit" size="sm">
                Guardar anotación
              </Button>
            </div>
          </form>
          {studentNotes.length > 0 && (
            <ul className="space-y-2 border-t border-border pt-3">
              {studentNotes.map((n) => (
                <NoteItem key={n.id} note={n} showStudent={false} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {!cycleId ? (
            <p className="py-4 text-center text-sm text-muted">
              No hay un ciclo activo para calificar.
            </p>
          ) : !grading ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted">
                {s.firstName} aún no está ubicad@ en un nivel de este programa.
              </p>
              <Link
                href={`/estudiantes/${s.id}`}
                className="mt-2 inline-block text-sm font-semibold text-primary-strong hover:underline"
              >
                Ubicar desde su expediente →
              </Link>
            </div>
          ) : grading.blocks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              El nivel «{grading.levelName}» aún no tiene plantilla de bloques.
            </p>
          ) : (
            <GradingPanel
              key={grading.levelName}
              studentId={s.id}
              programId={programId}
              cycleId={cycleId}
              levelName={grading.levelName}
              nextLevelName={grading.nextLevelName}
              passThreshold={passThreshold}
              blocks={grading.blocks}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Bitácora de la clase ---------- */

function ClassNotes({
  programId,
  dateKey,
  initial,
}: {
  programId: string;
  dateKey: string;
  initial: string;
}) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // "Guardado" se apaga solo; si vuelve a escribir y guardar, reaparece.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        <ChatCircleText weight="fill" className="size-4 text-primary" />
        Bitácora de la clase
      </h2>
      <form
        ref={formRef}
        action={(fd) =>
          startTransition(async () => {
            await saveClassNotes(programId, dateKey, fd);
            setSaved(true);
          })
        }
        className="mt-3 space-y-2.5"
      >
        <Textarea
          key={`${dateKey}:${initial}`}
          name="notes"
          rows={5}
          defaultValue={initial}
          placeholder="Qué se trabajó hoy, acuerdos, pendientes para la próxima clase…"
        />
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-xs font-semibold text-success-strong">Guardado ✓</span>
          )}
          <Button type="submit" size="sm" loading={pending}>
            Guardar bitácora
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ---------- Anotaciones recientes del grupo ---------- */

function NoteItem({ note: n, showStudent }: { note: Note; showStudent: boolean }) {
  return (
    <li className="rounded-[var(--radius-control)] bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-ink">
          {showStudent ? `${n.student.firstName} ${n.student.lastName}` : fechaLabel(n.createdAt)}
        </p>
        <div className="flex items-center gap-1.5">
          <Badge tone={n.visibleToFamily ? "success" : "neutral"} className="text-[0.65rem]">
            {n.visibleToFamily ? (
              <>
                <Users className="size-3" /> Familia
              </>
            ) : (
              <>
                <EyeSlash className="size-3" /> Interna
              </>
            )}
          </Badge>
          {n.canDelete && (
            <form action={deleteStudentNote.bind(null, n.id)}>
              <button
                type="submit"
                aria-label="Borrar anotación"
                className="flex size-6 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
              >
                <Trash className="size-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{n.body}</p>
      <p className="mt-1.5 text-[0.7rem] text-subtle">
        {n.authorName ?? "Equipo"}
        {showStudent && <> · {fechaLabel(n.createdAt)}</>}
      </p>
    </li>
  );
}

function NotesFeed({ color, notes }: { color: string; notes: Note[] }) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        <NotePencil weight="fill" className="size-4" style={{ color }} />
        Anotaciones recientes
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Se escriben tocando al alumno en la lista. Las «visibles para la familia» aparecen
        en el espacio del alumno, para que en casa estén enterados.
      </p>
      {notes.length === 0 ? (
        <p className="mt-4 py-4 text-center text-sm text-muted">
          Aún no hay anotaciones en este programa.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} showStudent />
          ))}
        </ul>
      )}
    </Card>
  );
}
