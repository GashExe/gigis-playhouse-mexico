import { cn } from "@/lib/utils";

/**
 * Marca de la casita (playhouse) con corazón, en versión multicolor.
 * Techo naranja, cuerpo teal y corazón rosa: guiño al arcoíris de GiGi's.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-9", className)}
      role="img"
      aria-label="Gigi's Playhouse"
    >
      {/* Techo */}
      <path
        d="M20 3.5 5 15.5v2.4L20 6.6l15 11.3v-2.4L20 3.5Z"
        fill="var(--brand-orange)"
      />
      {/* Alero amarillo (banda bajo el techo) */}
      <path d="M20 6.6 6 17.6l1.7 1.3L20 9.2l12.3 9.7 1.7-1.3L20 6.6Z" fill="var(--brand-yellow)" />
      {/* Cuerpo de la casa */}
      <path
        d="M8.3 17.4 20 8.4l11.7 9v17.1a2 2 0 0 1-2 2H10.3a2 2 0 0 1-2-2V17.4Z"
        fill="var(--brand-teal)"
      />
      {/* Corazón (ventana) */}
      <path
        d="M20 31.4c-3.3-2.7-5.4-4.6-5.4-7.1a3 3 0 0 1 5.4-1.85 3 3 0 0 1 5.4 1.85c0 2.5-2.1 4.4-5.4 7.1Z"
        fill="var(--brand-pink)"
      />
    </svg>
  );
}

/** Letras del wordmark "GiGi's", cada una con un color de la marca. */
const WORDMARK: { ch: string; color: string }[] = [
  { ch: "G", color: "var(--brand-pink)" },
  { ch: "i", color: "var(--brand-teal)" },
  { ch: "G", color: "var(--brand-orange)" },
  { ch: "i", color: "var(--brand-blue)" },
  { ch: "’", color: "var(--brand-green)" },
  { ch: "s", color: "var(--brand-purple)" },
];

/**
 * Wordmark multicolor. `showText` muestra el lockup completo
 * ("GiGi's" + PLAYHOUSE + México); si es false, solo la casita.
 */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className="text-[1.15rem] font-extrabold tracking-tight"
            aria-label="Gigi's"
          >
            {WORDMARK.map((l, i) => (
              <span key={i} style={{ color: l.color }}>
                {l.ch}
              </span>
            ))}
          </span>
          <span className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.24em] text-muted">
            Playhouse
            <span className="ml-1.5 text-primary-strong">México</span>
          </span>
        </span>
      )}
    </span>
  );
}
