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

export type Slot = {
  weekday: number;
  startTime: string;
  endTime: string;
  programLevelId?: string | null;
  programGroupId?: string | null;
};

/**
 * El horario que de verdad le toca al alumno en un programa.
 *
 * Manda el GRUPO: si ya se sabe en cuál está, su horario es el de ese grupo y nada
 * más. Es lo que arregla el caso de Prerrequisitos, que es una clase de 45 minutos
 * dentro de un programa cuyo bloque general dura toda la tarde: sin esto, al niño
 * se le daba por ocupado el bloque entero y no podía llevar nada más ese día.
 *
 * Sin grupo se cae al criterio de antes (el nivel, o el programa completo), que es
 * lo que siguen usando las terapias grandes: bloques largos con sesiones individuales
 * rotando, donde no hay grupos que repartir.
 */
export function slotsForGroup<T extends { programGroupId?: string | null; programLevelId?: string | null }>(
  slots: T[],
  groupId: string | null | undefined,
  levelId?: string | null,
): T[] {
  if (groupId) return slots.filter((s) => s.programGroupId === groupId);
  // Sin grupo asignado, los horarios que pertenecen a algún grupo no son suyos:
  // son de quien esté en ese grupo.
  return slotsForLevel(slots.filter((s) => !s.programGroupId), levelId);
}

/**
 * Filtra el horario al nivel del alumno cuando el programa separa horario por nivel.
 * - Si NINGÚN slot tiene nivel, el horario es de todo el programa: se devuelve igual.
 * - Si los hay, se muestran los del nivel del alumno más los compartidos (sin nivel).
 *   Si el alumno no tiene nivel (o su nivel no tiene horario), quedan solo los
 *   compartidos (posiblemente ninguno).
 */
export function slotsForLevel<T extends { programLevelId?: string | null }>(
  slots: T[],
  levelId: string | null | undefined,
): T[] {
  const hasLevelSlots = slots.some((s) => s.programLevelId);
  if (!hasLevelSlots) return slots;
  const shared = slots.filter((s) => !s.programLevelId);
  const own = levelId ? slots.filter((s) => s.programLevelId === levelId) : [];
  return own.length > 0 ? [...own, ...shared] : shared;
}

/**
 * ¿Dos horarios se empalman? Mismo día y horas que se cruzan. Que una termine
 * justo cuando la otra empieza (10–11 y 11–12) NO es empalme: se puede pasar de
 * un salón al otro.
 */
export function slotsClash(a: Slot, b: Slot): boolean {
  if (a.weekday !== b.weekday) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Primer horario de `slots` que choca con alguno de `others` (null si conviven).
 * Devuelve el horario propio, que es el que se le enseña a quien inscribe.
 */
export function findSlotClash(slots: Slot[], others: Slot[]): Slot | null {
  for (const s of slots) {
    if (others.some((o) => slotsClash(s, o))) return s;
  }
  return null;
}

/**
 * Reparte al grupo en las HOJAS de asistencia de un día: una por horario, porque
 * la sesión de clase es única por programa+fecha y no sabe de horas.
 *
 * Dos horarios iguales el mismo día son la misma clase (se juntan). Cuando el
 * horario es propio de un nivel, a esa hoja solo van los alumnos ubicados en ese
 * nivel; los horarios compartidos llevan a todo el grupo. Si ese día no toca
 * clase sale una sola hoja sin hora: la casa reprograma, y negarse a dar la hoja
 * porque el horario dice otra cosa la volvería inservible.
 *
 * Vive aquí, aparte de la consulta, porque es la única parte con reglas y así se
 * puede razonar (y probar) sin base de datos.
 */
export function buildAttendanceSheets<T extends { levelId: string | null; groupId?: string | null }>(
  daySlots: (Slot & { levelName?: string | null; groupName?: string | null })[],
  students: T[],
): {
  key: string;
  startTime: string | null;
  endTime: string | null;
  levelId: string | null;
  levelName: string | null;
  groupId: string | null;
  groupName: string | null;
  students: T[];
}[] {
  type Bloque = {
    key: string;
    startTime: string | null;
    endTime: string | null;
    levelId: string | null;
    levelName: string | null;
    groupId: string | null;
    groupName: string | null;
  };
  const bloques = new Map<string, Bloque>();
  for (const s of daySlots) {
    // Dos grupos del mismo nivel son dos clases distintas aunque compartan hora, así
    // que el grupo entra en la llave: si no, a la terapeuta le saldría una sola hoja
    // con los niños de los dos.
    const key = `${s.startTime}-${s.endTime}-${s.programGroupId ?? s.programLevelId ?? ""}`;
    if (!bloques.has(key)) {
      bloques.set(key, {
        key,
        startTime: s.startTime,
        endTime: s.endTime,
        levelId: s.programLevelId ?? null,
        levelName: s.levelName ?? null,
        groupId: s.programGroupId ?? null,
        groupName: s.groupName ?? null,
      });
    }
  }
  if (bloques.size === 0) {
    bloques.set("sin-horario", {
      key: "sin-horario",
      startTime: null,
      endTime: null,
      levelId: null,
      levelName: null,
      groupId: null,
      groupName: null,
    });
  }
  return [...bloques.values()]
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    .map((b) => ({
      ...b,
      students: b.groupId
        ? students.filter((a) => a.groupId === b.groupId)
        : b.levelId
          ? students.filter((a) => a.levelId === b.levelId)
          : students,
    }));
}

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
