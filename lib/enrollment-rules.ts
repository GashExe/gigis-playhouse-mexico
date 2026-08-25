import "server-only";
import { prisma } from "@/lib/prisma";
import { resolvePlacement } from "@/lib/placement";
import { findSlotClash, slotsForLevel, slotsLabel, type Slot } from "@/lib/schedule";

/**
 * Las cuatro reglas de quién puede inscribirse a qué. Viven juntas porque las dos
 * puertas de inscripción —la familia desde Mi espacio y dirección desde el
 * expediente— tienen que juzgar con el mismo criterio; si cada una lo resolviera
 * por su lado, la pantalla ofrecería lo que la acción rechaza (o al revés).
 *
 *   1. EMPALME de horario: nadie puede llevar dos actividades a la misma hora.
 *   2. BAJA de dirección: si dirección quitó (o pausó/finalizó) la inscripción, la
 *      familia no puede volver a meterse sola; solo dirección la reabre.
 *   3. EDAD: la actividad ni siquiera se le ofrece a la familia fuera de su rango;
 *      dirección sí puede pasar por encima, a propósito y dejando constancia.
 *   4. CARGA: cada ciclo puede topar cuántas actividades lleva un participante
 *      (`Cycle.maxEnrollments`). Es la carga que aguanta la casa, no un dato del
 *      programa, por eso vive en el ciclo y la pone la dirección.
 */

export type ScheduleClash = {
  /** Programa ya inscrito con el que choca. */
  programId: string;
  programName: string;
  /** Horario del empalme, legible (ej. "Lun 10:00–11:00"). */
  label: string;
};

type ProgramSlots = {
  id: string;
  name: string;
  scheduleSlots: Slot[];
};

/**
 * Horario que REALMENTE le toca al alumno en cada programa: cuando el programa
 * separa horario por nivel, el de su nivel (el que ya tiene en el ciclo, o aquel
 * en el que quedaría al inscribirse). Sin esto, un programa con cuatro niveles a
 * cuatro horas distintas chocaría con todo.
 */
export async function effectiveSlots(
  studentId: string,
  cycleId: string,
  programs: ProgramSlots[],
): Promise<Map<string, Slot[]>> {
  // Solo hay que ubicarlo en los programas que de verdad parten su horario por
  // nivel; en los demás el horario es el del programa entero y preguntarlo sería
  // un viaje a la base para nada.
  const porNivel = programs.filter((p) => p.scheduleSlots.some((s) => s.programLevelId));
  const placements = await Promise.all(
    porNivel.map((p) => resolvePlacement(studentId, p.id, cycleId)),
  );
  const levelOf = new Map(porNivel.map((p, i) => [p.id, placements[i]?.levelId ?? null]));
  return new Map(
    programs.map((p) => [p.id, slotsForLevel(p.scheduleSlots, levelOf.get(p.id) ?? null)]),
  );
}

const SLOT_SELECT = {
  select: { weekday: true, startTime: true, endTime: true, programLevelId: true },
};

/**
 * De una lista de actividades candidatas, cuáles se empalman con lo que el alumno
 * ya lleva en el ciclo. Devuelve un mapa programId → con qué choca.
 */
export async function findScheduleClashes(
  studentId: string,
  cycleId: string,
  candidateProgramIds: string[],
): Promise<Map<string, ScheduleClash>> {
  const clashes = new Map<string, ScheduleClash>();
  if (candidateProgramIds.length === 0) return clashes;

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, cycleId, status: "ACTIVA" },
    select: { program: { select: { id: true, name: true, scheduleSlots: SLOT_SELECT } } },
  });
  if (enrollments.length === 0) return clashes;
  const enrolled = enrollments.map((e) => e.program);

  const candidates = await prisma.program.findMany({
    where: { id: { in: candidateProgramIds } },
    select: { id: true, name: true, scheduleSlots: SLOT_SELECT },
  });

  // Un programa puede estar en las dos listas (candidato y ya inscrito): se resuelve
  // una sola vez para no pedir dos veces la misma ubicación.
  const unique = new Map<string, ProgramSlots>();
  for (const p of [...enrolled, ...candidates]) unique.set(p.id, p);
  const slotsOf = await effectiveSlots(studentId, cycleId, [...unique.values()]);

  for (const candidate of candidates) {
    const mine = slotsOf.get(candidate.id) ?? [];
    if (mine.length === 0) continue; // sin horario no hay nada que empalmar
    for (const other of enrolled) {
      if (other.id === candidate.id) continue;
      const clash = findSlotClash(mine, slotsOf.get(other.id) ?? []);
      if (clash) {
        clashes.set(candidate.id, {
          programId: other.id,
          programName: other.name,
          label: slotsLabel([clash]),
        });
        break;
      }
    }
  }
  return clashes;
}

/** El empalme de una sola actividad (la puerta de las server actions). */
export async function findScheduleClash(
  studentId: string,
  cycleId: string,
  programId: string,
): Promise<ScheduleClash | null> {
  const clashes = await findScheduleClashes(studentId, cycleId, [programId]);
  return clashes.get(programId) ?? null;
}

export type LoadCheck = {
  /** Cuántas actividades lleva ya en el ciclo (solo inscripciones ACTIVA). */
  current: number;
  /** Tope del ciclo. null = sin tope. */
  max: number | null;
  /** Ya no le cabe otra. Siempre false cuando el ciclo no tiene tope. */
  full: boolean;
  /** Texto listo para pantalla ("Ya lleva 4 de 4 actividades"). null si no hay tope. */
  label: string | null;
};

/**
 * CUARTA regla: cuánta carga lleva el participante en el ciclo y si le cabe otra.
 *
 * `max` se pasa cuando quien llama ya tiene el ciclo en la mano (`getActiveCycle`
 * devuelve la fila completa), para no repetir el viaje a la base.
 * `excludeProgramId` es para la puerta de dirección, que inscribe con upsert y por
 * tanto puede estar reinscribiendo algo que el alumno ya lleva: sin excluirlo, la
 * regla lo contaría a él mismo y frenaría una reinscripción inocente.
 *
 * Solo cuentan las inscripciones ACTIVA: una pausada o finalizada no ocupa carga.
 */
export async function checkEnrollmentLoad(
  studentId: string,
  cycleId: string,
  opts?: { max?: number | null; excludeProgramId?: string },
): Promise<LoadCheck> {
  const max =
    opts?.max !== undefined
      ? opts.max
      : (
          await prisma.cycle.findUnique({
            where: { id: cycleId },
            select: { maxEnrollments: true },
          })
        )?.maxEnrollments ?? null;

  const current = await prisma.enrollment.count({
    where: {
      studentId,
      cycleId,
      status: "ACTIVA",
      ...(opts?.excludeProgramId ? { programId: { not: opts.excludeProgramId } } : {}),
    },
  });

  const full = max != null && current >= max;
  return {
    current,
    max,
    full,
    label: max != null ? `Ya lleva ${current} de ${max} actividades del ciclo` : null,
  };
}

/**
 * Dirección dio de baja al alumno de una actividad: queda anotado en su reserva
 * como RECHAZADA. Es lo que impide que la familia se vuelva a meter sola por
 * Mi espacio (antes, quitarla no servía de nada: volvían a apretar "Inscribir").
 */
export async function markDroppedByStaff(
  studentId: string,
  programId: string,
  cycleId: string,
  decidedById: string,
  reason: string,
) {
  await prisma.reservation.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    update: { status: "RECHAZADA", message: reason, decidedAt: new Date(), decidedById },
    create: {
      studentId,
      programId,
      cycleId,
      status: "RECHAZADA",
      message: reason,
      decidedAt: new Date(),
      decidedById,
    },
  });
}

/** Dirección la reabre: la familia vuelve a poder inscribirla por su cuenta. */
export async function clearStaffDrop(studentId: string, programId: string, cycleId: string) {
  await prisma.reservation.updateMany({
    where: { studentId, programId, cycleId, status: "RECHAZADA" },
    data: { status: "APROBADA", decidedAt: new Date() },
  });
}

/** ¿Dirección tiene cerrada esta actividad para el alumno en este ciclo? */
export async function isDroppedByStaff(
  studentId: string,
  programId: string,
  cycleId: string,
): Promise<boolean> {
  const reservation = await prisma.reservation.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: { status: true },
  });
  return reservation?.status === "RECHAZADA";
}
