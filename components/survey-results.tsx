import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { SCALE_LABELS } from "@/lib/survey-types";

type EscalaResult = {
  id: string;
  text: string;
  type: "escala";
  distribution: number[];
  average: number | null;
  answered: number;
};
type AbiertaResult = {
  id: string;
  text: string;
  type: "abierta";
  comments: string[];
  answered: number;
};
type SurveyResults = {
  total: number;
  questions: (EscalaResult | AbiertaResult)[];
};

/** Gráficas y comentarios de la encuesta de un ciclo (barras simples, sin librería). */
export function SurveyResults({ results }: { results: SurveyResults }) {
  if (results.total === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-muted">
        Aún no hay respuestas para este ciclo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        <span className="font-bold text-ink">{results.total}</span>{" "}
        {results.total === 1 ? "familia respondió" : "familias respondieron"}.
      </p>

      {results.questions.map((q) =>
        q.type === "escala" ? (
          <div
            key={q.id}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-ink">{q.text}</h4>
              <span className="text-xs font-semibold text-muted">
                Promedio: <span className="text-ink">{q.average ?? "—"}</span> / 5
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = q.distribution[n] ?? 0;
                const pct = q.answered > 0 ? Math.round((count / q.answered) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2.5">
                    <span className="w-28 shrink-0 text-xs text-muted">
                      {n} · {SCALE_LABELS[n]}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs font-semibold text-ink">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            key={q.id}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
          >
            <h4 className="text-sm font-bold text-ink">{q.text}</h4>
            {q.comments.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Sin comentarios.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {q.comments.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink"
                  >
                    <ChatCircleText className="mt-0.5 size-4 shrink-0 text-subtle" />
                    <span className="whitespace-pre-wrap">{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </div>
  );
}
