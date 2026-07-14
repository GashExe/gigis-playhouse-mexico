import { cn } from "@/lib/utils";

/**
 * Marca oficial de GiGi's Playhouse.
 *
 * Los assets (`/brand/*.png`) son la versión knockout (blanca) del logo
 * oficial. Se usan como MÁSCARA CSS: la silueta oficial se rellena con el
 * color/degradado que se indique, así el mismo asset sirve en claro, oscuro
 * o a todo color sin perder fidelidad al logo real.
 */

const WORDMARK_SRC = "/brand/gigis-wordmark-white.png"; // 627 x 317
const LOCKUP_SRC = "/brand/gigis-lockup-white.png"; //   698 x 585

type Tone = "rainbow" | "brand" | "ink" | "white";

function toneBackground(tone: Tone): string {
  switch (tone) {
    case "rainbow":
      return "var(--brand-rainbow)";
    case "brand":
      return "var(--primary)";
    case "white":
      return "#ffffff";
    case "ink":
    default:
      return "var(--ink)";
  }
}

function maskStyle(src: string): React.CSSProperties {
  return {
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

/** Wordmark oficial "GiGi's Playhouse™" (compacto, para barras y encabezados). */
export function Logo({
  className,
  tone = "rainbow",
}: {
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      role="img"
      aria-label="GiGi's Playhouse México"
      className={cn("block h-9", className)}
      style={{
        aspectRatio: "627 / 317",
        background: toneBackground(tone),
        ...maskStyle(WORDMARK_SRC),
      }}
    />
  );
}

/** Lockup completo (wordmark + lema + "Quéretaro, México"), para el login. */
export function LogoLockup({
  className,
  tone = "white",
}: {
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      role="img"
      aria-label="GiGi's Playhouse México · Centro de éxito del síndrome de Down"
      className={cn("block w-56", className)}
      style={{
        aspectRatio: "698 / 585",
        background: toneBackground(tone),
        ...maskStyle(LOCKUP_SRC),
      }}
    />
  );
}

/** Marca compacta = wordmark en tamaño reducido (para el encabezado móvil). */
export function LogoMark({ className }: { className?: string }) {
  return <Logo className={cn("h-7", className)} tone="rainbow" />;
}
