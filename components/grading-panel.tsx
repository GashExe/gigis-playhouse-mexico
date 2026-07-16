"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag, Check } from "@phosphor-icons/react";
import { setItemScore } from "@/lib/actions/item-scores";

type Item = { id: string; code: string | null; text: string; score: number | null };
type Block = { id: string; code: string | null; name: string; items: Item[] };

const SCORES = [1, 2, 3, 4] as const;

/** Color del avance según el porcentaje (0 sin empezar → verde al 100%). */
function tone(pct: number): { bar: string; text: string } {
  if (pct >= 80) return { bar: "#1D9E75", text: "text-success-strong" };
  if (pct >= 50) return { bar: "#EF9F27", text: "text-warning-strong" };
  if (pct > 0) return { bar: "var(--primary)", text: "text-primary" };
  return { bar: "var(--border)", text: "text-subtle" };
}

/** % de una lista de temas: promedio de (calif/4), los no calificados cuentan como 0. */
function pctOf(items: { score: number | null }[]): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, i) => acc + (i.score ? i.score / 4 : 0), 0);
  return Math.round((sum / items.length) * 100);
}

export function GradingPanel({
  studentId,
  programId,
  cycleId,
  levelName,
  passThreshold,
  blocks: initialBlocks,
}: {
  studentId: string;
  programId: string;
  cycleId: string;
  levelName: string;
  passThreshold: number;
  blocks: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [saving, startSaving] = useTransition();

  const allItems = useMemo(() => blocks.flatMap((b) => b.items), [blocks]);
  const levelPct = pctOf(allItems);
  const levelTone = tone(levelPct);
  const passed = levelPct >= passThreshold;

  function grade(itemId: string, score: number) {
    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        items: b.items.map((i) => (i.id === itemId ? { ...i, score } : i)),
      })),
    );
    startSaving(() => {
      void setItemScore({ studentId, programId, itemId, cycleId, score });
    });
  }

  return (
    <div className="space-y-4">
      {/* Resumen del nivel */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-subtle">Nivel</p>
            <p className="text-lg font-extrabold text-ink">{levelName}</p>
          </div>
          <div className="text-right">
            <p className={`tnum text-3xl font-extrabold ${levelTone.text}`}>{levelPct}%</p>
            <p className="text-xs text-subtle">del nivel</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${levelPct}%`, backgroundColor: levelTone.bar }}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          {passed ? (
            <>
              <Check weight="bold" className="size-3.5 text-success-strong" />
              <span className="font-semibold text-success-strong">
                Listo para el siguiente nivel
              </span>{" "}
              (alcanzó {passThreshold}%)
            </>
          ) : (
            <>
              <Flag className="size-3.5" />
              Pasa de nivel al llegar a {passThreshold}%
            </>
          )}
          {saving && <span className="ml-auto text-subtle">Guardando…</span>}
        </p>
      </div>

      {/* Bloques */}
      {blocks.map((block) => {
        const bPct = pctOf(block.items);
        const bTone = tone(bPct);
        return (
          <div
            key={block.id}
            className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
          >
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">
                  {block.code && <span className="text-subtle">{block.code}</span>} {block.name}
                </p>
                <span className={`tnum text-sm font-semibold ${bTone.text}`}>
                  {bPct === 0 ? "Sin empezar" : `${bPct}%`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${bPct}%`, backgroundColor: bTone.bar }}
                />
              </div>
            </div>

            <ul className="divide-y divide-border">
              {block.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-ink">
                    {item.code && <span className="text-subtle">{item.code}) </span>}
                    {item.text}
                  </p>
                  <div className="flex shrink-0 gap-1.5" role="group" aria-label="Calificación 1 a 4">
                    {SCORES.map((n) => {
                      const active = item.score === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => grade(item.id, n)}
                          aria-pressed={active}
                          aria-label={`Calificar ${n}`}
                          className={`flex size-8 items-center justify-center rounded-[var(--radius-input)] text-sm font-semibold transition-colors ${
                            active
                              ? n === 4
                                ? "bg-success-strong text-white"
                                : n === 3
                                  ? "bg-warning-strong text-white"
                                  : "bg-primary text-white"
                              : "border border-border text-subtle hover:bg-surface-2 hover:text-ink"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
