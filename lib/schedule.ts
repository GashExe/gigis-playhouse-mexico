/**
 * Utilidades del horario estructurado y del calendario semanal. Sin dependencias
 * de servidor: se usan igual en páginas (server) y componentes de cliente.
 */

/** Día de la semana indexado como Date.getDay(): 0=domingo … 6=sábado. */
export const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export type Slot = { weekday: number; startTime: string; endTime: string };

/** Orden lunes-primero para pintar la semana (la casa trabaja de lunes a sábado). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Texto legible del horario: agrupa días que comparten la misma hora.
 * Ej. [{lun 10-11},{mié 10-11},{vie 16-17}] → "Lun y Mié 10:00–11:00 · Vie 16:00–17:00".
 */
export function slotsLabel(slots: Slot[]): string {
  if (slots.length === 0) return "";
  const byTime = new Map<string, number[]>();
  const sorted = [...slots].sort(
    (a, b) =>
      WEEK_ORDER.indexOf(a.weekday as (typeof WEEK_ORDER)[number]) -
        WEEK_ORDER.indexOf(b.weekday as (typeof WEEK_ORDER)[number]) ||
      a.startTime.localeCompare(b.startTime),
  );
  for (const s of sorted) {
    const key = `${s.startTime}–${s.endTime}`;
    byTime.set(key, [...(byTime.get(key) ?? []), s.weekday]);
  }
  return [...byTime.entries()]
    .map(([time, days]) => {
      const names = days.map((d) => WEEKDAYS_SHORT[d]);
      const list =
        names.length > 1
          ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
          : names[0];
      return `${list} ${time}`;
    })
    .join(" · ");
}

/** Clave local "YYYY-MM-DD" de una fecha (sin depender de la zona UTC). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fecha local a partir de una clave "YYYY-MM-DD" (mediodía, para esquivar DST). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

/** ¿La clave tiene forma de fecha válida? */
export function isDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = fromDateKey(key);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const shift = (d.getDay() + 6) % 7; // lunes=0 … domingo=6
  d.setDate(d.getDate() - shift);
  return d;
}

/** Suma días a una fecha (devuelve una copia). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
