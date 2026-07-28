import { ArrowRight, TrendUp } from "@phosphor-icons/react/dist/ssr";

/**
 * Piezas visuales compartidas para mostrar la calificación del ciclo: la INICIAL y la
 * FINAL (escala 1–4). Las usan la boleta, el historial y el "proceso" que ve la
 * familia, para que las tres hablen el mismo idioma.
 */

/** Qué quiere decir cada número de la escala. */
export const SCORE_MEANING: Record<number, string> = {
  1: "Inicial",
  2: "En proceso",
  3: "Casi logrado",
  4: "Logrado",
};

function chipClasses(value: number | null): string {
  if (value == null) return "border border-dashed border-border text-subtle";
  if (value === 4) return "bg-success-weak text-success-strong";
  if (value === 3) return "bg-warning-weak text-warning-strong";
  return "bg-primary-weak text-primary-strong";
}

/** Una calificación como pastilla, con su etiqueta debajo. "—" si aún no la ponen. */
export function ScoreBadge({
  label,
  value,
  size = "md",
}: {
  label: string;
  value: number | null;
  size?: "md" | "lg";
}) {
  return (
    <span className="flex flex-col items-center">
      <span
        className={`tnum flex items-center justify-center rounded-[var(--radius-input)] font-extrabold print:border print:border-border ${
          size === "lg" ? "size-12 text-xl" : "size-9 text-base"
        } ${chipClasses(value)}`}
      >
        {value ?? "—"}
      </span>
      <span className="mt-0.5 text-[0.65rem] font-semibold text-subtle">{label}</span>
    </span>
  );
}

/**
 * El par inicial → final de un ciclo. Es la calificación completa de un programa:
 * de dónde partió y a dónde llegó.
 */
export function ScorePair({
  initialScore,
  finalScore,
  size = "md",
}: {
  initialScore: number | null;
  finalScore: number | null;
  size?: "md" | "lg";
}) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <ScoreBadge label="Inicial" value={initialScore} size={size} />
      <ArrowRight className="size-4 text-subtle" />
      <ScoreBadge label="Final" value={finalScore} size={size} />
    </span>
  );
}

/**
 * El avance del ciclo en palabras. Devuelve null cuando falta alguna de las dos
 * calificaciones: sin las dos no hay avance que contar, y un "0" ahí engañaría.
 */
export function ScoreProgress({
  initialScore,
  finalScore,
}: {
  initialScore: number | null;
  finalScore: number | null;
}) {
  if (initialScore == null || finalScore == null) {
    return (
      <p className="text-xs text-muted">
        {finalScore == null
          ? "La calificación final se registra al cerrar el ciclo."
          : "Sin calificación inicial registrada."}
      </p>
    );
  }
  const avance = finalScore - initialScore;
  if (avance > 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-success-strong">
        <TrendUp weight="bold" className="size-3.5" />
        Avanzó {avance} {avance === 1 ? "punto" : "puntos"} en el ciclo
        <span className="font-normal text-muted">
          ({SCORE_MEANING[initialScore]} → {SCORE_MEANING[finalScore]})
        </span>
      </p>
    );
  }
  if (avance === 0) {
    return (
      <p className="text-xs text-muted">
        Cerró el ciclo en {SCORE_MEANING[finalScore]?.toLowerCase()}, igual que como empezó.
      </p>
    );
  }
  return (
    <p className="text-xs font-semibold text-warning-strong">
      Cerró por debajo de como empezó ({SCORE_MEANING[initialScore]} →{" "}
      {SCORE_MEANING[finalScore]}).
    </p>
  );
}
