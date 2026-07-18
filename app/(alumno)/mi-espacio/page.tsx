import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  Sparkle,
  Confetti,
  Clock,
  ChatCircleText,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { getStudentSpace } from "@/lib/queries";
import { needsOnboarding } from "@/lib/legal";
import { slotsLabel } from "@/lib/schedule";
import { fecha, fechaDia } from "@/lib/format";

export const metadata: Metadata = { title: "Mi espacio" };

export default async function MiEspacioPage() {
  const user = await getCurrentUser();
  const student = user.studentId ? await getStudentSpace(user.studentId) : null;

  // Compuerta: sin datos básicos + salud + aviso/reglamento aceptados, no hay acceso a clases.
  if (student && needsOnboarding(student)) {
    redirect("/mi-espacio/bienvenida");
  }

  const firstName = (student?.firstName ?? user.name).split(" ")[0];
  const programs = student?.enrollments ?? [];
  const teamNotes = student?.studentNotes ?? [];
  const attendance = student?.attendance ?? [];

  const ATTENDANCE_LABEL: Record<string, { text: string; cls: string }> = {
    PRESENTE: { text: "Presente", cls: "bg-success-weak text-success-strong" },
    RETARDO: { text: "Retardo", cls: "bg-warning-weak text-warning-strong" },
    JUSTIFICADO: { text: "Justificado", cls: "bg-info-weak text-info" },
    AUSENTE: { text: "Ausente", cls: "bg-danger-weak text-danger-strong" },
  };

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <section>
        <p className="text-sm font-semibold text-primary-strong">Hola de nuevo</p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          ¡Bienvenid@, {firstName}!
        </h1>
        {student?.matricula && (
          <p className="mt-2 text-sm text-muted">
            Matrícula:{" "}
            <span className="font-semibold text-ink">{student.matricula}</span>
          </p>
        )}
      </section>

      {/* Aviso de reservaciones (próximamente) */}
      <section
        className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full opacity-20"
          style={{ background: "var(--brand-rainbow)" }}
        />
        <div className="relative flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: "var(--brand-pink)" }}
          >
            <CalendarCheck weight="fill" className="size-6" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">
              Apartar actividades — muy pronto
            </h2>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted">
              Estamos preparando el espacio para que puedas reservar las
              actividades de {firstName}. En cuanto esté listo, aparecerá aquí.
              ¡Gracias por ser parte de Gigi&apos;s Playhouse!
            </p>
          </div>
        </div>
      </section>

      {/* Programas en los que está inscrito */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkle weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Programas de {firstName}
          </h2>
        </div>

        {programs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
            <Confetti weight="fill" className="size-8 text-brand-purple" />
            <p className="text-sm font-medium text-muted">
              Aún no hay programas asignados. El equipo de Gigi&apos;s los
              registrará pronto.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {programs.map((e) => {
              const color = e.program.color ?? "var(--brand-teal)";
              const horario = slotsLabel(e.program.scheduleSlots);
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
                >
                  <span
                    aria-hidden
                    className="mt-1 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {e.program.name}
                    </p>
                    {e.program.area && (
                      <p className="truncate text-xs text-muted">
                        {e.program.area}
                      </p>
                    )}
                    {horario && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                        <Clock className="size-3.5 shrink-0 text-subtle" />
                        {horario}
                      </p>
                    )}
                    {e.program.teacher && (
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        Con {e.program.teacher.name}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Anotaciones del equipo para la familia */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ChatCircleText weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Anotaciones del equipo
          </h2>
        </div>
        {teamNotes.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-6 text-center text-sm text-muted">
            Aquí verás los avisos y avances que el equipo comparta sobre {firstName}.
          </p>
        ) : (
          <ul className="space-y-3">
            {teamNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {n.program && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: n.program.color ?? "var(--brand-teal)" }}
                    >
                      {n.program.name}
                    </span>
                  )}
                  <span className="text-xs text-subtle">{fecha(n.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {n.body}
                </p>
                {n.author && (
                  <p className="mt-1.5 text-xs text-subtle">— {n.author.name}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Asistencia reciente */}
      {attendance.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks weight="fill" className="size-5 text-primary" />
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Asistencia reciente
            </h2>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)]">
            {attendance.map((a) => {
              const meta = ATTENDANCE_LABEL[a.status] ?? {
                text: a.status,
                cls: "bg-surface-2 text-muted",
              };
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: a.session.program.color ?? "var(--brand-teal)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {a.session.program.name}
                    </p>
                    <p className="text-xs text-subtle">
                      {fechaDia(a.session.date)}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.cls}`}
                  >
                    {meta.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
