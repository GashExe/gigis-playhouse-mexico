import { ArrowFatLinesUp, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fecha } from "@/lib/format";

type Entry = {
  recordId: string;
  cycle: { id: string; label: string };
  levelName: string;
  levelOrder: number;
  placement: string;
  percent: number;
  gradedAt: Date;
  leveledUp: boolean;
};
type Group = {
  program: { id: string; name: string; color: string | null };
  entries: Entry[];
};

const PLACEMENT_LABEL: Record<string, string> = {
  PROBATORIO: "Probatorio",
  POSIBLE_GRADUADO: "Posible graduado",
};

/** Color del % de cierre del nivel (igual criterio que el panel de calificación). */
function tone(pct: number): { bar: string; text: string } {
  if (pct >= 80) return { bar: "#1D9E75", text: "text-success-strong" };
  if (pct >= 50) return { bar: "#EF9F27", text: "text-warning-strong" };
  if (pct > 0) return { bar: "var(--primary)", text: "text-primary" };
  return { bar: "var(--border)", text: "text-subtle" };
}

/**
 * Historia del participante entre ciclos: en cada programa, qué nivel llevó cada
 * ciclo, con qué % lo cerró y cuándo subió de nivel. Lee de getStudentTimeline.
 */
export function StudentTimeline({ groups }: { groups: Group[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Línea de tiempo</CardTitle>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-subtle">
          <ClockCounterClockwise weight="fill" className="size-4" />
          Historia entre ciclos
        </span>
      </CardHeader>

      {groups.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<ClockCounterClockwise weight="fill" className="size-6" />}
            title="Todavía no hay historia que contar"
            description="En cuanto se le ubique en un nivel y se le califique en algún ciclo, aquí aparecerá su recorrido."
          />
        </div>
      ) : (
        <div className="space-y-6 p-5">
          {groups.map((g) => (
            <div key={g.program.id}>
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: g.program.color ?? "var(--primary)" }}
                />
                <h3 className="font-bold text-ink">{g.program.name}</h3>
              </div>

              <ol className="relative ml-1.5 space-y-4 border-l-2 border-border pl-5">
                {g.entries.map((e) => {
                  const t = tone(e.percent);
                  return (
                    <li key={e.recordId} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[1.65rem] top-1 size-3 rounded-full border-2 border-surface"
                        style={{ backgroundColor: t.bar }}
                      />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold text-ink">{e.cycle.label}</span>
                        {e.leveledUp && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                            <ArrowFatLinesUp weight="fill" className="size-3" />
                            Subió de nivel
                          </span>
                        )}
                        {PLACEMENT_LABEL[e.placement] && (
                          <span className="rounded-full bg-warning-weak px-2 py-0.5 text-[0.7rem] font-bold text-warning-strong">
                            {PLACEMENT_LABEL[e.placement]}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        Nivel <span className="font-semibold text-ink">{e.levelName}</span> ·
                        cerró con <span className={`tnum font-bold ${t.text}`}>{e.percent}%</span>
                      </p>
                      <p className="text-xs text-subtle">Actualizado {fecha(e.gradedAt)}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
