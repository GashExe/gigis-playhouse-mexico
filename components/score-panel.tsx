"use client";

import { useState, useTransition } from "react";
import { ArrowRight, TrendUp, Flag, CheckCircle } from "@phosphor-icons/react";
import { setProgramScore } from "@/lib/actions/level-records";

/**
 * Captura de la calificación del ciclo: la INICIAL (con qué llegó el participante) y
 * la FINAL (con qué cerró). Escala 1–4; 4 es el máximo. Es todo lo que califica la
 * terapeuta — ya no hay bloques ni temas que ir palomeando.
 *
 * Guarda al tocar, sin botón de "guardar": son dos datos y el viaje de ida y vuelta a
 * un formulario pesaba más que la captura misma. El número que ya está puesto se
 * vuelve a tocar para borrarlo.
 */

const SCORES = [1, 2, 3, 4] as const;

/** Qué quiere decir cada número, para que no sea un botón sin significado. */
const SCORE_LABEL: Record<number, string> = {
  1: "Inicial",
  2: "En proceso",
  3: "Casi logrado",
  4: "Logrado",
};

function scoreClasses(n: number, active: boolean): string {
  if (!active) {
    return "border border-border text-subtle hover:bg-surface-2 hover:text-ink";
  }
  if (n === 4) return "bg-success-strong text-white";
  if (n === 3) return "bg-warning-strong text-white";
  return "bg-primary text-white";
}

function ScoreRow({
  label,
  hint,
  icon,
  value,
  onPick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: number | null;
  onPick: (score: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          {icon}
          {label}
        </p>
        <p className="text-xs text-muted">
          {value ? `${value} · ${SCORE_LABEL[value]}` : hint}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5" role="group" aria-label={`${label}, 1 a 4`}>
        {SCORES.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              // Volver a tocar el número puesto lo quita: es el único modo de corregir
              // una calificación capturada por error sin borrar la ubicación de nivel.
              onClick={() => onPick(active ? null : n)}
              aria-pressed={active}
              title={`${n} · ${SCORE_LABEL[n]}`}
              aria-label={`${label}: ${n}, ${SCORE_LABEL[n]}`}
              className={`flex size-9 items-center justify-center rounded-[var(--radius-input)] text-sm font-semibold transition-colors ${scoreClasses(n, active)}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScorePanel({
  studentId,
  programId,
  cycleId,
  levelName,
  initialScore: initialFromServer,
  finalScore: finalFromServer,
  canEdit = true,
}: {
  studentId: string;
  programId: string;
  cycleId: string;
  levelName: string;
  initialScore: number | null;
  finalScore: number | null;
  /** Falso para quien solo mira (lector): se ven las calificaciones, no se tocan. */
  canEdit?: boolean;
}) {
  const [inicial, setInicial] = useState<number | null>(initialFromServer);
  const [final, setFinal] = useState<number | null>(finalFromServer);
  const [saving, startSaving] = useTransition();

  function save(kind: "inicial" | "final", score: number | null) {
    if (kind === "inicial") setInicial(score);
    else setFinal(score);
    startSaving(() => {
      void setProgramScore({ studentId, programId, cycleId, kind, score });
    });
  }

  const avance = inicial != null && final != null ? final - inicial : null;

  if (!canEdit) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <p className="text-xs font-semibold text-subtle">Nivel</p>
        <p className="text-lg font-extrabold text-ink">{levelName}</p>
        <div className="mt-3 flex items-center gap-3">
          <ScoreChip label="Inicial" value={inicial} />
          <ArrowRight className="size-4 text-subtle" />
          <ScoreChip label="Final" value={final} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-subtle">Nivel</p>
            <p className="text-lg font-extrabold text-ink">{levelName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <ScoreChip label="Inicial" value={inicial} />
            <ArrowRight className="size-4 text-subtle" />
            <ScoreChip label="Final" value={final} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          {avance == null ? (
            <>
              <Flag className="size-3.5" />
              Registra la calificación inicial y, al cerrar el ciclo, la final.
            </>
          ) : avance > 0 ? (
            <>
              <TrendUp weight="bold" className="size-3.5 text-success-strong" />
              <span className="font-semibold text-success-strong">
                Avanzó {avance} {avance === 1 ? "punto" : "puntos"}
              </span>{" "}
              en el ciclo
            </>
          ) : avance === 0 ? (
            <>
              <Flag className="size-3.5" />
              Cerró el ciclo en el mismo punto en el que empezó
            </>
          ) : (
            <>
              <Flag className="size-3.5 text-warning-strong" />
              <span className="font-semibold text-warning-strong">
                Cerró por debajo de como empezó
              </span>
            </>
          )}
          {saving && <span className="ml-auto text-subtle">Guardando…</span>}
        </div>
      </div>

      <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface px-5">
        <ScoreRow
          label="Calificación inicial"
          hint="Con qué llegó al empezar el ciclo"
          icon={<Flag weight="fill" className="size-4 text-primary" />}
          value={inicial}
          onPick={(s) => save("inicial", s)}
        />
        <ScoreRow
          label="Calificación final"
          hint="Con qué cerró el ciclo"
          icon={<CheckCircle weight="fill" className="size-4 text-success-strong" />}
          value={final}
          onPick={(s) => save("final", s)}
        />
      </div>

      <p className="px-1 text-xs text-muted">
        Escala 1 a 4: 1 inicial, 2 en proceso, 3 casi logrado, 4 logrado. Toca de nuevo un
        número puesto para borrarlo.
      </p>
    </div>
  );
}

/** La calificación como pastilla; "—" mientras no la registran. */
export function ScoreChip({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="flex flex-col items-center">
      <span
        className={`tnum flex size-9 items-center justify-center rounded-[var(--radius-input)] text-base font-extrabold ${
          value == null
            ? "border border-dashed border-border text-subtle"
            : value === 4
              ? "bg-success-weak text-success-strong"
              : value === 3
                ? "bg-warning-weak text-warning-strong"
                : "bg-primary-weak text-primary-strong"
        }`}
      >
        {value ?? "—"}
      </span>
      <span className="mt-0.5 text-[0.65rem] font-semibold text-subtle">{label}</span>
    </span>
  );
}
