import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  ChalkboardTeacher,
  UsersThree,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/dal";
import {
  getActiveCycle,
  listCalendarPrograms,
  listCanceledSessions,
} from "@/lib/queries";
import {
  WEEKDAYS,
  addDays,
  fromDateKey,
  isDateKey,
  mondayOf,
  toDateKey,
} from "@/lib/schedule";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Calendario" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const me = await requireStaff();
  const cycle = await getActiveCycle();

  // La maestra ve sus clases; dirección y coordinación ven todo el calendario.
  const onlyMine = me.role === "MAESTRA";
  const programs = await listCalendarPrograms(
    cycle?.id,
    onlyMine ? me.id : undefined,
  );

  const today = new Date();
  const monday = mondayOf(semana && isDateKey(semana) ? fromDateKey(semana) : today);
  const todayKey = toDateKey(today);

  // Semana de lunes a sábado; el domingo solo aparece si algún programa lo usa.
  const hasSunday = programs.some((p) => p.scheduleSlots.some((s) => s.weekday === 0));
  const days = Array.from({ length: hasSunday ? 7 : 6 }, (_, i) => addDays(monday, i));

  // Clases suspendidas de la semana, para tacharlas en su tarjeta.
  const canceledSessions = await listCanceledSessions(
    toDateKey(monday),
    toDateKey(addDays(monday, days.length - 1)),
  );
  const canceledSet = new Set(
    canceledSessions.map((s) => `${s.programId}:${s.date.toISOString().slice(0, 10)}`),
  );

  const withSlots = programs.filter((p) => p.scheduleSlots.length > 0);
  const withoutSlots = programs.filter((p) => p.scheduleSlots.length === 0);

  const weekLabel = `${format(monday, "d 'de' MMM", { locale: es })} – ${format(
    addDays(monday, days.length - 1),
    "d 'de' MMM yyyy",
    { locale: es },
  )}`;

  return (
    <div>
      <PageHeader
        title="Calendario de clases"
        subtitle={
          onlyMine
            ? "Tus clases de la semana. Toca una para pasar lista y llevar el control del día."
            : "Las clases de la semana según el horario de cada programa. Toca una para abrir su panel."
        }
      />

      {/* Navegación de semana */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/calendario?semana=${toDateKey(addDays(monday, -7))}`}
          aria-label="Semana anterior"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretLeft className="size-4" />
        </Link>
        <Link
          href={`/calendario?semana=${toDateKey(addDays(monday, 7))}`}
          aria-label="Semana siguiente"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] border border-border bg-surface text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CaretRight className="size-4" />
        </Link>
        <span className="ml-1 text-sm font-bold capitalize text-ink">{weekLabel}</span>
        <Link
          href="/calendario"
          className="ml-auto rounded-[var(--radius-input)] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Hoy
        </Link>
        {cycle && (
          <span className="rounded-full bg-primary-weak px-3 py-1.5 text-xs font-semibold text-primary-strong">
            Ciclo {cycle.label}
          </span>
        )}
      </div>

      {withSlots.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank weight="fill" className="size-6" />}
          title={onlyMine ? "No tienes clases con horario" : "Ningún programa tiene horario"}
          description={
            onlyMine
              ? "Cuando dirección capture los días de clase de tus programas, aparecerán aquí."
              : "Captura los días y horas de cada programa (Programas → Editar → Días de clase) y el calendario se arma solo."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {days.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const classes = withSlots
              .flatMap((p) =>
                p.scheduleSlots
                  .filter((s) => s.weekday === day.getDay())
                  .map((s) => ({ program: p, slot: s })),
              )
              .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
            return (
              <section
                key={key}
                className={`rounded-[var(--radius-card)] border bg-surface p-3 shadow-[var(--shadow-sm)] ${
                  isToday ? "border-primary" : "border-border"
                }`}
              >
                <header className="mb-2 flex items-baseline justify-between gap-2">
                  <h2
                    className={`text-xs font-extrabold uppercase tracking-wide ${
                      isToday ? "text-primary-strong" : "text-muted"
                    }`}
                  >
                    {WEEKDAYS[day.getDay()]}
                  </h2>
                  <span
                    className={`tnum text-sm font-bold ${isToday ? "text-primary-strong" : "text-ink"}`}
                  >
                    {day.getDate()}
                  </span>
                </header>
                {classes.length === 0 ? (
                  <p className="py-3 text-center text-xs text-subtle">Sin clases</p>
                ) : (
                  <ul className="space-y-2">
                    {classes.map(({ program: p, slot }, i) => {
                      const color = p.color ?? "var(--primary)";
                      const isCanceled = canceledSet.has(`${p.id}:${key}`);
                      return (
                        <li key={`${p.id}-${i}`}>
                          <Link
                            href={`/calendario/${p.id}?fecha=${key}`}
                            className={`block rounded-[var(--radius-control)] border border-border bg-surface-2 p-2.5 transition-colors hover:border-border-strong hover:bg-surface ${
                              isCanceled ? "opacity-60" : ""
                            }`}
                            style={{ borderLeft: `4px solid ${color}` }}
                          >
                            <p
                              className={`truncate text-sm font-bold text-ink ${
                                isCanceled ? "line-through" : ""
                              }`}
                            >
                              {p.name}
                            </p>
                            {isCanceled && (
                              <span className="mt-0.5 inline-block rounded-full bg-warning-weak px-2 py-0.5 text-[0.65rem] font-bold text-warning-strong">
                                Suspendida
                              </span>
                            )}
                            <p className="tnum mt-0.5 text-xs font-semibold" style={{ color }}>
                              {slot.startTime}–{slot.endTime}
                            </p>
                            <p className="mt-1 flex items-center gap-3 text-[0.7rem] text-muted">
                              {p.teacher && (
                                <span className="flex min-w-0 items-center gap-1">
                                  <ChalkboardTeacher className="size-3 shrink-0" />
                                  <span className="truncate">{p.teacher.name.split(" ")[0]}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <UsersThree className="size-3" />
                                {p._count.enrollments}
                              </span>
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Programas que aún no tienen días capturados: sin esto "desaparecen" del
          calendario en silencio y nadie sabe por qué. */}
      {withSlots.length > 0 && withoutSlots.length > 0 && (
        <div className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-subtle" />
          <p>
            Sin días de clase capturados:{" "}
            <span className="font-semibold text-ink">
              {withoutSlots.map((p) => p.name).join(", ")}
            </span>
            {me.role === "MAESTRA" ? (
              <> — pide a dirección capturar su horario para verlos aquí.</>
            ) : (
              <>
                {" "}
                — captúralos en{" "}
                <Link href="/programas" className="font-semibold text-primary-strong hover:underline">
                  Programas
                </Link>{" "}
                (Editar → Días de clase).
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
