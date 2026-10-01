import { cn } from "@/lib/utils";

/** Tonos de marca disponibles para las tarjetas. */
export type StatTone =
  | "pink"
  | "blue"
  | "orange"
  | "green"
  | "teal"
  | "purple"
  | "yellow";

const TONE_VAR: Record<StatTone, string> = {
  pink: "var(--brand-pink)",
  blue: "var(--brand-blue)",
  orange: "var(--brand-orange)",
  green: "var(--brand-green)",
  teal: "var(--brand-teal)",
  purple: "var(--brand-purple)",
  yellow: "var(--brand-yellow)",
};

/** Secuencia por defecto cuando no se especifica tono. */
const TONE_CYCLE: StatTone[] = ["pink", "blue", "orange", "green", "purple", "teal"];

export type Stat = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  hint?: string;
  tone?: StatTone;
};

export function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 divide-border rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)] sm:grid-cols-4 sm:divide-x">
      {stats.map((s, i) => {
        const color = TONE_VAR[s.tone ?? TONE_CYCLE[i % TONE_CYCLE.length]];
        return (
          <div
            key={s.label}
            className={cn(
              "flex flex-col gap-2 p-4 sm:p-5",
              i < 2 && "border-b border-border sm:border-b-0",
              i % 2 === 0 && "border-r border-border sm:border-r-0",
            )}
          >
            {/* El ícono va suelto y en el color de marca apagado: el cuadrito
                pastel detrás de cada ícono era la parte más "de plantilla". */}
            <span
              className="flex size-5 items-center"
              style={{ color: `color-mix(in oklch, ${color} 78%, var(--ink))` }}
            >
              {s.icon}
            </span>
            <div>
              <p className="tnum font-[family-name:var(--font-display)] text-[1.75rem] leading-none font-semibold tracking-tight text-ink">
                {s.value}
              </p>
              <p className="mt-1.5 text-[0.8125rem] font-medium text-muted">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
