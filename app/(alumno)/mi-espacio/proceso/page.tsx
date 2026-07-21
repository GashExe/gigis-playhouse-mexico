import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ChartLineUp,
  Trophy,
  ArrowUp,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getActiveCycle,
  getFamilyProgress,
  getStudentTimeline,
  getStudentSpace,
} from "@/lib/queries";
import { fechaDia } from "@/lib/format";

export const metadata: Metadata = { title: "Proceso" };

const PLACEMENT_LABEL: Record<string, { text: string; cls: string }> = {
  REGULAR: { text: "En curso", cls: "bg-info-weak text-info" },
  PROBATORIO: { text: "En reforzamiento", cls: "bg-warning-weak text-warning-strong" },
  POSIBLE_GRADUADO: { text: "¡Por graduarse!", cls: "bg-success-weak text-success-strong" },
};

function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default async function ProcesoPage() {
  const user = await getCurrentUser();
  if (!user.studentId) redirect("/mi-espacio");
  const studentId = user.studentId;

  const cycle = await getActiveCycle();
  const [student, progress, timeline] = await Promise.all([
    getStudentSpace(studentId),
    cycle ? getFamilyProgress(studentId, cycle.id) : Promise.resolve([]),
    getStudentTimeline(studentId),
  ]);
  const firstName = (student?.firstName ?? user.name).split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/mi-espacio"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ChartLineUp weight="fill" className="size-5 text-primary" />
          El proceso de {firstName}
        </p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          ¿Cómo va {firstName}?
        </h1>
        {cycle && (
          <p className="mt-2 text-sm text-muted">
            Avance del ciclo <span className="font-semibold text-ink">{cycle.label}</span>. Cada
            barra muestra qué tanto lleva dominado; verde quiere decir logrado.
          </p>
        )}
      </div>

      {/* Avance del ciclo actual, programa por programa */}
      {progress.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
          <Sparkle weight="fill" className="size-8 text-brand-purple" />
          <p className="text-sm font-medium text-muted">
            Aún no hay avances registrados para este ciclo. En cuanto el equipo evalúe a{" "}
            {firstName}, lo verás aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((p) => {
            const color = p.program.color ?? "var(--brand-teal)";
            const placement = PLACEMENT_LABEL[p.placement] ?? null;
            return (
              <section
                key={p.program.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-ink">{p.program.name}</h2>
                      <p className="text-xs text-muted">Nivel: {p.levelName}</p>
                    </div>
                  </div>
                  {placement && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${placement.cls}`}
                    >
                      {placement.text}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <Bar percent={p.overall} color={color} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-extrabold text-ink">
                    {p.overall}%
                  </span>
                </div>

                {p.blocks.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {p.blocks.map((b) => (
                      <li key={b.id} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-sm text-ink">
                            {b.code ? (
                              <span className="text-subtle">{b.code} · </span>
                            ) : null}
                            {b.name}
                          </p>
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
                            {b.achieved && (
                              <Trophy weight="fill" className="size-3.5 text-success-strong" />
                            )}
                            {b.hasItems ? `${b.percent}%` : "—"}
                          </span>
                        </div>
                        <Bar
                          percent={b.percent}
                          color={b.achieved ? "var(--success)" : color}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Historia entre ciclos: cómo ha ido subiendo de nivel */}
      {timeline.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ChartLineUp weight="fill" className="size-5 text-primary" />
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Su historia en Gigi&apos;s
            </h2>
          </div>
          <div className="space-y-4">
            {timeline.map((g) => {
              const color = g.program.color ?? "var(--brand-teal)";
              return (
                <div
                  key={g.program.id}
                  className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="font-bold text-ink">{g.program.name}</h3>
                  </div>
                  <ol className="mt-3 space-y-2 border-l-2 border-border pl-4">
                    {g.entries.map((e) => (
                      <li key={e.recordId} className="relative">
                        <span
                          aria-hidden
                          className="absolute -left-[1.4rem] top-1 size-3 rounded-full border-2 border-surface"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <p className="text-sm font-semibold text-ink">
                            {e.levelName}
                            {e.leveledUp && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-success-weak px-1.5 py-0.5 text-[0.7rem] font-bold text-success-strong">
                                <ArrowUp weight="bold" className="size-3" />
                                Subió
                              </span>
                            )}
                          </p>
                          <span className="text-xs text-subtle">{e.cycle.label}</span>
                        </div>
                        <p className="text-xs text-muted">
                          {e.percent}% del nivel · {fechaDia(e.gradedAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
