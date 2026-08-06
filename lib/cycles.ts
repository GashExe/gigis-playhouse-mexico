import type { CycleSeason } from "@/lib/generated/prisma/client";

/**
 * Cómo se nombran y se fechan los ciclos. Sin dependencias de servidor: el
 * formulario de alta necesita ver la etiqueta mientras la directora elige, y el
 * servidor la vuelve a calcular al guardar (nunca se fía de lo que llega del
 * formulario).
 */

/** Temporada en corto, con guion largo (U+2013), como lo escribe la casa. */
export const SEASON_LABEL: Record<CycleSeason, string> = {
  ENE_JUN: "Ene–Jun",
  JUL_AGO: "Jul–Ago",
  SEP_DIC: "Sep–Dic",
};

/** Las tres temporadas en orden cronológico, para pintar el selector. */
export const SEASONS: CycleSeason[] = ["ENE_JUN", "JUL_AGO", "SEP_DIC"];

/** Etiqueta legible del ciclo: "Ene–Jun 2026". */
export function cycleLabel(season: CycleSeason, year: number): string {
  return `${SEASON_LABEL[season]} ${year}`;
}

/** Orden cronológico de un ciclo (mismo criterio que la línea de tiempo). */
export function cycleRank(cycle: { year: number; season: string }): number {
  const s = cycle.season;
  return cycle.year * 10 + (s === "ENE_JUN" ? 1 : s === "JUL_AGO" ? 2 : 3);
}

/**
 * Fechas propuestas de una temporada, en clave "YYYY-MM-DD" para prellenar el
 * formulario. Son solo el punto de partida: la directora las ajusta a lo que de
 * verdad dura el ciclo.
 */
export function defaultCycleDates(
  season: CycleSeason,
  year: number,
): { start: string; end: string } {
  const day = (month: number, date: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  if (season === "ENE_JUN") return { start: day(1, 8), end: day(6, 30) };
  if (season === "JUL_AGO") return { start: day(7, 1), end: day(8, 31) };
  return { start: day(9, 1), end: day(12, 15) };
}

/**
 * Las fechas del ciclo son SOLO-FECHA (@db.Date): se guardan y se leen a medianoche
 * UTC. Leerlas o escribirlas en hora local las corre un día hacia atrás en México
 * (es la misma trampa que resuelve `fechaDia` en lib/format).
 */

/** "YYYY-MM-DD" del formulario → fecha pura. null si viene vacía o mal escrita. */
export function dateOnly(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha pura → "YYYY-MM-DD", para prellenar un <input type="date">. */
export function dateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
