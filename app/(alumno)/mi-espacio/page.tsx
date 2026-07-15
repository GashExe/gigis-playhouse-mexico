import type { Metadata } from "next";
import { CalendarCheck, Sparkle, Confetti } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { getStudentSpace } from "@/lib/queries";

export const metadata: Metadata = { title: "Mi espacio" };

export default async function MiEspacioPage() {
  const user = await getCurrentUser();
  const student = user.studentId ? await getStudentSpace(user.studentId) : null;

  const firstName = (student?.firstName ?? user.name).split(" ")[0];
  const programs = student?.enrollments ?? [];

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
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
