import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function fecha(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "d 'de' MMM, yyyy", { locale: es });
}

/**
 * Fecha de un campo SOLO-FECHA (@db.Date, guardado a medianoche UTC). Se lee con
 * las partes UTC: formatearlo como `fecha()` lo corre un día hacia atrás en México.
 */
export function fechaDia(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  return format(local, "d 'de' MMM, yyyy", { locale: es });
}

export function fechaLarga(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Versión larga de `fechaDia`: para campos SOLO-FECHA (guardados a medianoche
 * UTC, como birthDate). Lee las partes UTC para no correr el día en México.
 */
export function fechaDiaLarga(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  return format(local, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function haceTiempo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { locale: es, addSuffix: true });
}

export function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
