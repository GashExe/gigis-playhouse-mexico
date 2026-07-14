import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function fecha(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "d 'de' MMM, yyyy", { locale: es });
}

export function fechaLarga(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es });
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
