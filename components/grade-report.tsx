import { Trophy } from "@phosphor-icons/react/dist/ssr";

/**
 * Piezas visuales compartidas para mostrar calificaciones por nivel y bloque
 * (escala 1–4 → %). Las usan la boleta y el historial del participante; son el
 * mismo lenguaje visual que el "proceso" que ve la familia.
 */

export type ReportBlock = {
  id: string;
  code: string | null;
  name: string;
  percent: number;
  achieved: boolean;
  hasItems: boolean;
};

export function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 print:border print:border-border">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** Lista de bloques del nivel con su barra de avance y palomeo de "logrado". */
export function BlockList({ blocks, color }: { blocks: ReportBlock[]; color: string }) {
  if (blocks.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2.5">
      {blocks.map((b) => (
        <li key={b.id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-ink">
              {b.code ? <span className="text-subtle">{b.code} · </span> : null}
              {b.name}
            </p>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
              {b.achieved && <Trophy weight="fill" className="size-3.5 text-success-strong" />}
              {b.hasItems ? `${b.percent}%` : "—"}
            </span>
          </div>
          <ProgressBar percent={b.percent} color={b.achieved ? "var(--success)" : color} />
        </li>
      ))}
    </ul>
  );
}
