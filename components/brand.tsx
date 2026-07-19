import { cn } from "@/lib/utils";

/**
 * Marca oficial de GiGi's Playhouse.
 *
 * El logo se muestra TAL CUAL es: letras multicolor + "playhouse." en negro
 * (`/brand/*-color.png`, extraído del membrete oficial). En modo oscuro y sobre
 * fondos de color se usa la versión knockout (blanca) oficial (`/brand/*-white.png`)
 * como máscara CSS, que es el uso invertido estándar de la marca.
 */

const WORDMARK_COLOR_SRC = "/brand/gigis-wordmark-color.png"; // 655 x 313
const WORDMARK_WHITE_SRC = "/brand/gigis-wordmark-white.png"; // 627 x 317
const LOCKUP_COLOR_SRC = "/brand/gigis-lockup-color.png"; //    702 x 525
const LOCKUP_WHITE_SRC = "/brand/gigis-lockup-white.png"; //    698 x 585

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

/**
 * Wordmark oficial "GiGi's Playhouse™" (compacto, para barras y encabezados).
 * A todo color sobre fondos claros; knockout blanco en modo oscuro.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="GiGi's Playhouse México"
      className={cn("block h-9", className)}
      style={{ aspectRatio: "655 / 313" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={WORDMARK_COLOR_SRC}
        alt=""
        className="block h-full w-full object-contain dark:hidden"
      />
      <span
        aria-hidden
        className="hidden h-full w-full dark:block"
        style={{ background: "#ffffff", ...maskStyle(WORDMARK_WHITE_SRC) }}
      />
    </span>
  );
}

/**
 * Lockup COMPLETO y oficial: wordmark + "playhouse" + lema ("Centro de éxito del
 * síndrome de Down · Educar. Inspirar. ¡Creer!") + "Querétaro, México". Es la marca
 * que debe aparecer en la plataforma, sin recortes.
 *
 * A todo color sobre fondos claros y knockout blanco en modo oscuro, igual que el
 * wordmark. Con `onColor` se fuerza la versión blanca: es la que va sobre el panel
 * de color del login, donde la de color no contrastaría.
 *
 * No trae tamaño propio a propósito: cada lugar le da ancho (`w-*`) o alto (`h-*`)
 * y el aspect-ratio calcula el otro lado, para que nunca se deforme.
 */
export function LogoLockup({
  className,
  onColor = false,
}: {
  className?: string;
  onColor?: boolean;
}) {
  const label = "GiGi's Playhouse México · Centro de éxito del síndrome de Down";

  if (onColor) {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn("block", className)}
        style={{
          aspectRatio: "698 / 585",
          background: "#ffffff",
          ...maskStyle(LOCKUP_WHITE_SRC),
        }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("block", className)}
      style={{ aspectRatio: "702 / 525" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOCKUP_COLOR_SRC}
        alt=""
        className="block h-full w-full object-contain dark:hidden"
      />
      <span
        aria-hidden
        className="hidden h-full w-full dark:block"
        style={{ background: "#ffffff", ...maskStyle(LOCKUP_WHITE_SRC) }}
      />
    </span>
  );
}

/** Marca compacta = wordmark en tamaño reducido (para el encabezado móvil). */
export function LogoMark({ className }: { className?: string }) {
  return <Logo className={cn("h-7", className)} />;
}
