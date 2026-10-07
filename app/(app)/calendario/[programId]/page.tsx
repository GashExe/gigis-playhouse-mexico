import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  ChalkboardTeacher,
  ChartBar,
  Clock,
  ClockCounterClockwise,
  Printer,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { canGradeProgram, getCurrentUser } from "@/lib/dal";
import { canRunClasses, isReadOnly } from "@/lib/roles";
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
import { teacherNames } from "@/lib/teaching";

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

type GroupLite = {
  id: string;
  name: string;
  level: { name: string } | null;
  slots: { weekday: number; startTime: string; endTime: string }[];
};

/** Cómo se llama el grupo en pantalla: "Intermedio · Grupo 2" (o solo "Intermedio"). */
function groupLabel(g: GroupLite): string {
  return [g.level?.name, g.name === g.level?.name ? null : g.name].filter(Boolean).join(" · ");
}

/** A qué hora empieza el grupo ese día ("" si ese día no le toca). */
function startOnDay(g: GroupLite, weekday: number): string {
  return g.slots
    .filter((s) => s.weekday === weekday)
    .map((s) => s.startTime)
    .sort()[0] ?? "";
}

/** Hora del reloj como "HH:MM", para comparar contra los horarios. */
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function ClassPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ fecha?: string; grupo?: string }>;
}) {
  const { programId } = await params;
  const { fecha, grupo } = await searchParams;

  const me = await getCurrentUser();
  // Quien lleva la clase: dirección, coordinación y operación en cualquier programa;
  // la terapeuta solo en los suyos. El lector entra a mirar, sin tocar nada.
  const soloLectura = isReadOnly(me.role);
  const puedeCalificar = await canGradeProgram(programId);
  if (!soloLectura && !canRunClasses(me.role)) redirect("/panel");
  if (me.role === "TERAPEUTA" && !puedeCalificar) redirect("/panel");

  const date = fecha && isDateKey(fecha) ? fromDateKey(fecha) : new Date();
  const dateKey = toDateKey(date);
  const cycle = await getActiveCycle();
  const { program, students, session, notes } = await getClassPanel(
    programId,
    dateKey,
    cycle?.id,
  );
  if (!program) notFound();

  // ¿QUÉ grupo se está pasando? En los programas repartidos en grupos, la lista de
  // una clase es la de esa hora y no la del programa entero: siete lugares no pueden
  // salir como treinta nombres. Se ofrece el reparto del día y, aparte, "todos" para
  // cuando alguien quiere ver el programa completo.
  const dayGroups = program.groups
    .filter((g) => startOnDay(g, date.getDay()) !== "")
    .sort((a, b) => startOnDay(a, date.getDay()).localeCompare(startOnDay(b, date.getDay())));
  // Si ese día no toca ninguno (clase repuesta, día fuera de horario) se ofrecen todos.
  const groupChoices = dayGroups.length > 0 ? dayGroups : program.groups;
  // La terapeuta que da algunos grupos de un programa ajeno cae primero en los suyos.
  const misGrupos =
    me.role === "TERAPEUTA" ? groupChoices.filter((g) => g.teacher?.id === me.id) : [];
  const candidatos = misGrupos.length > 0 ? misGrupos : groupChoices;
  // Sin elección explícita: el grupo que corre a esta hora cuando el día es HOY, y el
  // primero del día en cualquier otro caso. Así la terapeuta abre el panel y ya está
  // en la lista que va a pasar.
  const ahora = nowHHMM();
  const porDefecto =
    dateKey === toDateKey(new Date())
      ? candidatos.find((g) =>
          g.slots.some((s) => s.weekday === date.getDay() && s.endTime >= ahora),
        ) ?? candidatos[candidatos.length - 1]
      : candidatos[0];
  const verTodos = grupo === "todos" || program.groups.length === 0;
  const group = verTodos
    ? null
    : (grupo ? program.groups.find((g) => g.id === grupo) : null) ?? porDefecto ?? null;

  // Quién da la clase que se está viendo: la del grupo, o las del programa.
  const quienDa = group?.teacher
    ? group.teacher.name
    : teacherNames(program.teacher, program.coTeachers);

  // Los alumnos del grupo, y su asistencia. La sesión del día es una sola por
  // programa, así que las marcas de los otros grupos se quedan guardadas: aquí solo
  // se recortan para que los contadores hablen de este grupo.
  const groupStudents = group ? students.filter((s) => s.groupId === group.id) : students;
  const visibles = new Set(groupStudents.map((s) => s.id));
  const groupAttendance = (session?.attendance ?? []).filter((a) => visibles.has(a.studentId));

  // Calificación de cada alumno del grupo, para poderla poner sin salir del panel.
  // El grupo es chico (cupo ~7), así que traerla completa no pesa.
  const grading: Record<
    string,
    { levelName: string; initialScore: number | null; finalScore: number | null } | null
  > = {};
  if (cycle && puedeCalificar) {
    await Promise.all(
      groupStudents.map(async (s) => {
        const data = await getGradingData(s.id, programId, cycle.id);
        grading[s.id] = data
          ? {
              levelName: data.level.name,
              initialScore: data.initialScore,
              finalScore: data.finalScore,
            }
          : null;
      }),
    );
  }

  const color = program.color ?? "var(--primary)";
  // Con un grupo elegido, el horario que manda es el SUYO: es la hora a la que de
  // verdad hay clase para esta lista.
  const slots = group ? group.slots : program.scheduleSlots;
  const isClassDay = slots.length === 0 || slots.some((s) => s.weekday === date.getDay());
  const daySlots = slots.filter((s) => s.weekday === date.getDay());
  // Para no perder el grupo al moverse de día ni al imprimir.
  const grupoQS = group ? `&grupo=${group.id}` : verTodos ? "&grupo=todos" : "";
  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6">
      {/* Encabezado del programa */}
      <div>
        <Link
          href="/calendario"
          className="tap mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
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
          {slots.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-subtle" />
              {slotsLabel(slots)}
            </span>
          )}
          {quienDa && (
            <span className="flex items-center gap-1.5">
              <ChalkboardTeacher className="size-4 text-subtle" />
              {quienDa}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <UsersThree className="size-4 text-subtle" />
            {`${groupStudents.length} ${group ? `en ${groupLabel(group)}` : "en el grupo"}`}
            {cycle ? ` · ${cycle.label}` : ""}
          </span>
        </div>
      </div>

      {/* Navegación por fecha de clase */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/calendario/${program.id}?fecha=${toDateKey(stepClassDay(slots, date, -1))}${grupoQS}`}
          aria-label="Clase anterior"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretLeft className="size-4" />
        </Link>
        <Link
          href={`/calendario/${program.id}?fecha=${toDateKey(stepClassDay(slots, date, 1))}${grupoQS}`}
          aria-label="Clase siguiente"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretRight className="size-4" />
        </Link>
        <span className="ml-1 inline-block text-sm font-bold text-ink first-letter:uppercase">{dateLabel}</span>
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
        {/* La lista en papel está siempre a la mano, no solo cuando se llena el cupo. */}
        <Link
          href={`/calendario/${program.id}/lista?fecha=${dateKey}${group ? `&grupo=${group.id}` : ""}`}
          className="tap ml-auto flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Printer className="size-4" />
          Imprimir lista
        </Link>
        <Link
          href={`/calendario/${program.id}/reporte${group ? `?grupo=${group.id}` : ""}`}
          className="tap flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ChartBar className="size-4" />
          Reporte del grupo
        </Link>
        <Link
          href={`/calendario/${program.id}/bitacoras`}
          className="tap flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ClockCounterClockwise className="size-4" />
          Historial de bitácoras
        </Link>
        {!session?.canceled && !soloLectura && (
          <CancelClassControl
            programId={program.id}
            dateKey={dateKey}
            canceled={false}
            reason={null}
          />
        )}
      </div>

      {/* Reparto en grupos: cada uno es su propia clase, con su hora y su cupo. */}
      {program.groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-subtle">
            Grupo
          </span>
          {groupChoices.map((g) => {
            const activo = group?.id === g.id;
            const hora = startOnDay(g, date.getDay());
            return (
              <Link
                key={g.id}
                href={`/calendario/${program.id}?fecha=${dateKey}&grupo=${g.id}`}
                aria-current={activo ? "page" : undefined}
                className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-bold transition-colors ${
                  activo
                    ? "border-transparent bg-primary-weak text-primary-strong"
                    : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {groupLabel(g)}
                {hora && <span className="tnum ml-1.5 font-semibold opacity-70">{hora}</span>}
              </Link>
            );
          })}
          <Link
            href={`/calendario/${program.id}?fecha=${dateKey}&grupo=todos`}
            aria-current={verTodos ? "page" : undefined}
            className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-bold transition-colors ${
              verTodos
                ? "border-transparent bg-primary-weak text-primary-strong"
                : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {`Todos (${students.length})`}
          </Link>
        </div>
      )}

      {session?.canceled &&
        (soloLectura ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-warning bg-warning-weak/50 px-4 py-3">
            <p className="text-sm font-extrabold text-warning-strong">Clase suspendida</p>
            {session.cancelReason && (
              <p className="text-xs text-muted">{session.cancelReason}</p>
            )}
          </div>
        ) : (
          <CancelClassControl
            programId={program.id}
            dateKey={dateKey}
            canceled
            reason={session.cancelReason}
          />
        ))}

      <ClassPanel
        programId={program.id}
        dateKey={dateKey}
        color={color}
        cycleId={cycle?.id ?? null}
        canGrade={puedeCalificar}
        readOnly={soloLectura}
        grading={grading}
        students={groupStudents}
        attendance={groupAttendance}
        classNotes={session?.notes ?? ""}
        notes={notes.map((n) => ({
          id: n.id,
          body: n.body,
          visibleToFamily: n.visibleToFamily,
          createdAt: n.createdAt.toISOString(),
          authorName: n.author?.name ?? null,
          canDelete: !soloLectura && (me.role !== "TERAPEUTA" || n.authorId === me.id),
          student: n.student,
        }))}
      />
    </div>
  );
}
