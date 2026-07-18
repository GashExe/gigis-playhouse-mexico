import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  ChalkboardTeacher,
  Clock,
  ClockCounterClockwise,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { requireGraderForProgram, getCurrentUser } from "@/lib/dal";
import { getActiveCycle, getClassPanel, getGradingData } from "@/lib/queries";
import {
  addDays,
  fromDateKey,
  isDateKey,
  slotsLabel,
  toDateKey,
  type Slot,
} from "@/lib/schedule";
import { ClassPanel, CancelClassControl } from "@/components/class-panel";

export const metadata = { title: "Panel de clase" };

/**
 * Siguiente (o anterior) día con clase según el horario del programa. Si no hay
 * horario capturado se navega de día en día.
 */
function stepClassDay(slots: Slot[], from: Date, dir: 1 | -1): Date {
  if (slots.length === 0) return addDays(from, dir);
  const weekdays = new Set(slots.map((s) => s.weekday));
  let d = addDays(from, dir);
  for (let i = 0; i < 7; i++) {
    if (weekdays.has(d.getDay())) return d;
    d = addDays(d, dir);
  }
  return addDays(from, dir);
}

export default async function ClassPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { programId } = await params;
  const { fecha } = await searchParams;

  // Solo quien puede llevar la clase: la maestra en sus programas; dirección y
  // coordinación en cualquiera.
  await requireGraderForProgram(programId);
  const me = await getCurrentUser();

  const date = fecha && isDateKey(fecha) ? fromDateKey(fecha) : new Date();
  const dateKey = toDateKey(date);
  const cycle = await getActiveCycle();
  const { program, students, session, notes } = await getClassPanel(
    programId,
    dateKey,
    cycle?.id,
  );
  if (!program) notFound();

  // Evaluación de cada alumno del grupo, para calificar sin salir del panel.
  // El grupo es chico (cupo ~7), así que traerla completa no pesa.
  type Grading = NonNullable<Awaited<ReturnType<typeof getGradingData>>>;
  const grading: Record<
    string,
    { levelName: string; nextLevelName: string | null; blocks: Grading["blocks"] } | null
  > = {};
  if (cycle) {
    await Promise.all(
      students.map(async (s) => {
        const data = await getGradingData(s.id, programId, cycle.id);
        grading[s.id] = data
          ? { levelName: data.level.name, nextLevelName: data.nextLevelName, blocks: data.blocks }
          : null;
      }),
    );
  }

  const color = program.color ?? "var(--primary)";
  const isClassDay =
    program.scheduleSlots.length === 0 ||
    program.scheduleSlots.some((s) => s.weekday === date.getDay());
  const daySlots = program.scheduleSlots.filter((s) => s.weekday === date.getDay());
  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6">
      {/* Encabezado del programa */}
      <div>
        <Link
          href="/calendario"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Calendario
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="size-3.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {program.name}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {program.scheduleSlots.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-subtle" />
              {slotsLabel(program.scheduleSlots)}
            </span>
          )}
          {program.teacher && (
            <span className="flex items-center gap-1.5">
              <ChalkboardTeacher className="size-4 text-subtle" />
              {program.teacher.name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <UsersThree className="size-4 text-subtle" />
            {students.length} en el grupo{cycle ? ` · ${cycle.label}` : ""}
          </span>
        </div>
      </div>

      {/* Navegación por fecha de clase */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/calendario/${program.id}?fecha=${toDateKey(stepClassDay(program.scheduleSlots, date, -1))}`}
          aria-label="Clase anterior"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretLeft className="size-4" />
        </Link>
        <Link
          href={`/calendario/${program.id}?fecha=${toDateKey(stepClassDay(program.scheduleSlots, date, 1))}`}
          aria-label="Clase siguiente"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretRight className="size-4" />
        </Link>
        <span className="ml-1 text-sm font-bold capitalize text-ink">{dateLabel}</span>
        {daySlots.length > 0 && (
          <span className="tnum text-sm font-semibold" style={{ color }}>
            {daySlots.map((s) => `${s.startTime}–${s.endTime}`).join(" y ")}
          </span>
        )}
        {!isClassDay && (
          <span className="rounded-full bg-warning-weak px-3 py-1 text-xs font-semibold text-warning-strong">
            Este día no hay clase según el horario
          </span>
        )}
        <Link
          href={`/calendario/${program.id}/bitacoras`}
          className="ml-auto flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ClockCounterClockwise className="size-4" />
          Historial de bitácoras
        </Link>
        {!session?.canceled && (
          <CancelClassControl
            programId={program.id}
            dateKey={dateKey}
            canceled={false}
            reason={null}
          />
        )}
      </div>

      {session?.canceled && (
        <CancelClassControl
          programId={program.id}
          dateKey={dateKey}
          canceled
          reason={session.cancelReason}
        />
      )}

      <ClassPanel
        programId={program.id}
        dateKey={dateKey}
        color={color}
        cycleId={cycle?.id ?? null}
        passThreshold={program.passThreshold}
        grading={grading}
        students={students}
        attendance={session?.attendance ?? []}
        classNotes={session?.notes ?? ""}
        notes={notes.map((n) => ({
          id: n.id,
          body: n.body,
          visibleToFamily: n.visibleToFamily,
          createdAt: n.createdAt.toISOString(),
          authorName: n.author?.name ?? null,
          canDelete: me.role !== "MAESTRA" || n.authorId === me.id,
          student: n.student,
        }))}
      />
    </div>
  );
}
