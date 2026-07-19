"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Check, LockSimpleOpen, ArrowFatLinesUp } from "@phosphor-icons/react";
import { setItemScore } from "@/lib/actions/item-scores";
import { promoteToNextLevel } from "@/lib/actions/level-records";

type Item = { id: string; code: string | null; text: string; score: number | null };
type Block = { id: string; code: string | null; name: string; items: Item[] };
type EvalFormat = "BLOQUES" | "AREAS" | "PLANO";

const SCORES = [1, 2, 3, 4] as const;

/**
 * Cómo se presenta cada formato de evaluación. El motor de calificación (temas 1–4)
 * es el mismo; lo que cambia es el lenguaje y si hay desbloqueo / paso de nivel.
 *  - BLOQUES (Mate/Lecto): se desbloquean bloques y se sube de nivel.
 *  - AREAS (Lenguaje): igual, pero la unidad es el "área".
 *  - PLANO (Danza/Terapias): secciones con % y calificación, SIN niveles ni desbloqueo.
 */
const FORMAT: Record<
  EvalFormat,
  {
    units: string; // plural de la unidad, para títulos
    unlockBadge: string | null; // etiqueta en la unidad superada (null = sin desbloqueo)
    promote: boolean; // ¿ofrece subir de nivel al completar?
    subtitle: string;
    /** Frase de conteo, ej. "3/5 bloques desbloqueados (cada uno se desbloquea al 80%)". */
    unlockedLine: (done: number, total: number, threshold: number) => string;
  }
> = {
  BLOQUES: {
    units: "bloques",
    unlockBadge: "Desbloqueado",
    promote: true,
    subtitle: "Calificación por bloques",
    unlockedLine: (d, t, th) =>
      `${d}/${t} ${t === 1 ? "bloque desbloqueado" : "bloques desbloqueados"} (cada uno se desbloquea al ${th}%).`,
  },
  AREAS: {
    units: "áreas",
    unlockBadge: "Cubierta",
    promote: true,
    subtitle: "Calificación por áreas",
    unlockedLine: (d, t, th) =>
      `${d}/${t} ${t === 1 ? "área cubierta" : "áreas cubiertas"} (cada una se cubre al ${th}%).`,
  },
  PLANO: {
    units: "secciones",
    unlockBadge: null,
    promote: false,
    subtitle: "Calificación por secciones",
    unlockedLine: () => "",
  },
};

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
  format = "BLOQUES",
  levelName,
  nextLevelName = null,
  passThreshold,
  blocks: initialBlocks,
}: {
  studentId: string;
  programId: string;
  cycleId: string;
  /** Forma de la plantilla: cambia el lenguaje y si hay desbloqueo/paso de nivel. */
  format?: EvalFormat;
  levelName: string;
  /** Nombre del nivel que sigue (null = este es el último del programa). */
  nextLevelName?: string | null;
  passThreshold: number;
  blocks: Block[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [saving, startSaving] = useTransition();
  const [promoting, startPromoting] = useTransition();

  const cfg = FORMAT[format];
  const allItems = useMemo(() => blocks.flatMap((b) => b.items), [blocks]);
  const levelPct = pctOf(allItems);
  const levelTone = tone(levelPct);
  const passed = levelPct >= passThreshold;

  // Desbloqueo (solo BLOQUES/AREAS): una unidad se supera al llegar al umbral; el
  // nivel se completa cuando todas están superadas. En PLANO no aplica.
  const unlockedCount = blocks.filter((b) => pctOf(b.items) >= passThreshold).length;
  const allUnlocked = blocks.length > 0 && unlockedCount === blocks.length;
  const showUnlock = cfg.unlockBadge !== null;
  const showPromotion = cfg.promote && allUnlocked;

  function promote() {
    startPromoting(async () => {
      await promoteToNextLevel(studentId, programId, cycleId);
      // El nivel cambió en el servidor: recargar trae los bloques del nuevo nivel.
      router.refresh();
    });
  }

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
      {/* Resumen del nivel / avance general */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-subtle">
              {format === "PLANO" ? "Formato" : "Nivel"}
            </p>
            <p className="text-lg font-extrabold text-ink">{levelName}</p>
          </div>
          <div className="text-right">
            <p className={`tnum text-3xl font-extrabold ${levelTone.text}`}>{levelPct}%</p>
            <p className="text-xs text-subtle">{format === "PLANO" ? "de avance" : "del nivel"}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${levelPct}%`, backgroundColor: levelTone.bar }}
          />
        </div>

        {/* PLANO no sube de nivel: solo mide el avance general de las secciones. */}
        {format === "PLANO" ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Flag className="size-3.5" />
            Avance general de las {cfg.units}
            {saving && <span className="ml-auto text-subtle">Guardando…</span>}
          </p>
        ) : (
          <>
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
            {showUnlock && blocks.length > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                <LockSimpleOpen weight="bold" className="mr-1 inline size-3.5 align-[-2px] text-subtle" />
                {cfg.unlockedLine(unlockedCount, blocks.length, passThreshold)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Todas las unidades superadas: la plataforma ofrece el paso de nivel */}
      {showPromotion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-success bg-success-weak/50 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-success-strong">
              <ArrowFatLinesUp weight="fill" className="size-4" />
              ¡Todas las {cfg.units} superadas!
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {nextLevelName
                ? `Superó «${levelName}»; el siguiente nivel es «${nextLevelName}».`
                : `«${levelName}» es el último nivel del programa.`}
            </p>
          </div>
          <button
            type="button"
            onClick={promote}
            disabled={promoting}
            className="rounded-[var(--radius-control)] bg-success-strong px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
          >
            {promoting
              ? "Guardando…"
              : nextLevelName
                ? `Subir a «${nextLevelName}»`
                : "Marcar posible graduado"}
          </button>
        </div>
      )}

      {/* Bloques / áreas / secciones */}
      {blocks.map((block) => {
        const bPct = pctOf(block.items);
        const bTone = tone(bPct);
        const unlocked = bPct >= passThreshold;
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
                <span className="flex shrink-0 items-center gap-2">
                  {showUnlock && unlocked && cfg.unlockBadge && (
                    <span className="flex items-center gap-1 rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                      <LockSimpleOpen weight="bold" className="size-3" />
                      {cfg.unlockBadge}
                    </span>
                  )}
                  <span className={`tnum text-sm font-semibold ${bTone.text}`}>
                    {bPct === 0 ? "Sin empezar" : `${bPct}%`}
                  </span>
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
