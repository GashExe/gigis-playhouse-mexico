import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChatCircleText,
  CalendarX,
  ClockCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { requireGraderForProgram } from "@/lib/dal";
import { getProgramBasics, listProgramSessions } from "@/lib/queries";
import { fechaDia } from "@/lib/format";
import { toDateKey } from "@/lib/schedule";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Bitácoras" };

const COUNT_META: [string, string, string][] = [
  ["PRESENTE", "presentes", "text-success-strong"],
  ["RETARDO", "retardos", "text-warning-strong"],
  ["JUSTIFICADO", "justificados", "text-info"],
  ["AUSENTE", "ausentes", "text-danger-strong"],
];

export default async function BitacorasPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  await requireGraderForProgram(programId);

  const [program, sessions] = await Promise.all([
    getProgramBasics(programId),
    listProgramSessions(programId),
  ]);
  if (!program) notFound();
  const color = program.color ?? "var(--primary)";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/calendario/${program.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Panel de clase
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-input)]"
          style={{ backgroundColor: color + "22", color }}
        >
          <ClockCounterClockwise weight="fill" className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            Bitácoras de {program.name}
          </h1>
          <p className="text-sm text-muted">
            Sesión por sesión: qué se trabajó y cómo estuvo la asistencia.
          </p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<ChatCircleText weight="fill" className="size-6" />}
          title="Aún no hay sesiones registradas"
          description="Cuando se pase lista o se escriba una bitácora en el panel de clase, la sesión aparecerá aquí."
        />
      ) : (
        <ol className="relative space-y-4 border-l-2 border-border pl-6">
          {sessions.map((s) => {
            const dateKey = toDateKey(
              new Date(
                s.date.getUTCFullYear(),
                s.date.getUTCMonth(),
                s.date.getUTCDate(),
                12,
              ),
            );
            const counts = new Map<string, number>();
            for (const a of s.attendance)
              counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
            return (
              <li key={s.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.95rem] top-1.5 size-3 rounded-full border-2 border-bg"
                  style={{ backgroundColor: s.canceled ? "var(--warning)" : color }}
                />
                <Link
                  href={`/calendario/${program.id}?fecha=${dateKey}`}
                  className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold capitalize text-ink">{fechaDia(s.date)}</p>
                    {s.canceled ? (
                      <span className="flex items-center gap-1 rounded-full bg-warning-weak px-2.5 py-0.5 text-xs font-bold text-warning-strong">
                        <CalendarX weight="bold" className="size-3.5" />
                        Suspendida{s.cancelReason ? ` · ${s.cancelReason}` : ""}
                      </span>
                    ) : (
                      s.attendance.length > 0 && (
                        <span className="flex flex-wrap gap-2 text-xs font-semibold">
                          {COUNT_META.map(([status, label, cls]) =>
                            counts.get(status) ? (
                              <span key={status} className={cls}>
                                {counts.get(status)} {label}
                              </span>
                            ) : null,
                          )}
                        </span>
                      )
                    )}
                  </div>
                  {s.notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                      {s.notes}
                    </p>
                  ) : (
                    !s.canceled && (
                      <p className="mt-2 text-sm italic text-subtle">Sin bitácora escrita.</p>
                    )
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
