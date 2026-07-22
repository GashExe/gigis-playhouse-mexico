import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClockCounterClockwise, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/dal";
import { getStudent, getStudentGradeHistory } from "@/lib/queries";
import { fechaDia } from "@/lib/format";
import { ProgressBar, BlockList } from "@/components/grade-report";

const PLACEMENT_LABEL: Record<string, { text: string; cls: string }> = {
  REGULAR: { text: "En curso", cls: "bg-info-weak text-info" },
  PROBATORIO: { text: "En reforzamiento", cls: "bg-warning-weak text-warning-strong" },
  POSIBLE_GRADUADO: { text: "Por graduarse", cls: "bg-success-weak text-success-strong" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudent(id);
  return {
    title: student ? `Historial · ${student.firstName} ${student.lastName}` : "Historial",
  };
}

export default async function StudentHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const [student, history] = await Promise.all([
    getStudent(id),
    getStudentGradeHistory(id),
  ]);
  if (!student) notFound();

  return (
    <div>
      <Link
        href={`/estudiantes/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {student.firstName} {student.lastName}
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
          <ClockCounterClockwise weight="fill" className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Historial de calificaciones
          </h1>
          <p className="text-sm text-muted">
            Todo el avance de {student.firstName}, ciclo por ciclo, con nivel, bloques y fechas.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-12 text-center">
          <Sparkle weight="fill" className="size-8 text-brand-purple" />
          <p className="text-sm font-medium text-muted">
            Aún no hay calificaciones registradas para {student.firstName}.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {history.map((g) => {
            const color = g.program.color ?? "var(--brand-teal)";
            return (
              <section key={g.program.id} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <h2 className="text-lg font-extrabold tracking-tight text-ink">
                    {g.program.name}
                  </h2>
                </div>

                <div className="space-y-4">
                  {g.entries.map((e) => {
                    const placement = PLACEMENT_LABEL[e.placement] ?? null;
                    return (
                      <div
                        key={e.recordId}
                        className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-ink">{e.levelName}</h3>
                              {placement && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${placement.cls}`}
                                >
                                  {placement.text}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              Ciclo {e.cycle.label} · Calificado el {fechaDia(e.gradedAt)}
                            </p>
                          </div>
                          <span className="shrink-0 text-right">
                            <span className="block text-lg font-extrabold text-ink">
                              {e.overall}%
                            </span>
                            <span className="text-[0.7rem] font-semibold text-subtle">
                              del nivel
                            </span>
                          </span>
                        </div>

                        <div className="mt-3">
                          <ProgressBar percent={e.overall} color={color} />
                        </div>

                        <BlockList blocks={e.blocks} color={color} />

                        {e.note && (
                          <p className="mt-3 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs text-muted">
                            Nota del maestro: {e.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
