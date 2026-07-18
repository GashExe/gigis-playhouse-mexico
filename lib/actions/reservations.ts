"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement } from "@/lib/queries";
import { ageFrom } from "@/lib/utils";

/**
 * Reservas de actividades. La familia pide lugar desde Mi espacio; dirección o
 * coordinación deciden. La inscripción SOLO nace al aprobar: la reserva por sí
 * sola no ocupa cupo.
 */

/** Cupo ocupado de un programa en un ciclo (inscripciones activas). */
async function occupiedSeats(programId: string, cycleId: string) {
  return prisma.enrollment.count({
    where: { programId, cycleId, status: "ACTIVA" },
  });
}

/** La familia pide lugar en una actividad del ciclo activo. */
export async function requestReservation(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;
  const programId = String(formData.get("programId") ?? "");
  const message = String(formData.get("message") ?? "").trim() || null;
  if (!programId) return;

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Solo actividades reales de la oferta del ciclo.
  const program = await prisma.program.findFirst({
    where: { id: programId, active: true, cycles: { some: { id: cycle.id } } },
    select: { id: true, studentCapacity: true, ageMin: true, ageMax: true },
  });
  if (!program) return;

  // Requisitos de la actividad: hoy, el rango de edad. La pantalla ya lo
  // deshabilita; esto evita colar una solicitud fuera de requisito por URL.
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { birthDate: true },
  });
  if (!meetsAgeRequirement(ageFrom(student?.birthDate), program.ageMin, program.ageMax)) {
    return;
  }

  // Si ya está inscrito, no hay nada que reservar.
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, cycleId: cycle.id, status: "ACTIVA" },
    select: { id: true },
  });
  if (enrolled) return;

  // Sin lugares no se levanta la solicitud (la pantalla ya lo deshabilita;
  // esto cubre la carrera de dos familias pidiendo el último lugar).
  if ((await occupiedSeats(programId, cycle.id)) >= program.studentCapacity) return;

  // Única por alumno+programa+ciclo: si hubo una rechazada o cancelada,
  // volver a pedir la revive como pendiente.
  await prisma.reservation.upsert({
    where: {
      studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id },
    },
    update: { status: "PENDIENTE", message, decidedAt: null, decidedById: null },
    create: { studentId, programId, cycleId: cycle.id, message },
  });
  revalidatePath("/mi-espacio");
  revalidatePath("/panel");
}

/** La familia retira su solicitud mientras siga pendiente. */
export async function cancelReservation(reservationId: string) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  await prisma.reservation.updateMany({
    where: { id: reservationId, studentId: user.studentId, status: "PENDIENTE" },
    data: { status: "CANCELADA" },
  });
  revalidatePath("/mi-espacio");
  revalidatePath("/panel");
}

/**
 * Dirección/coordinación resuelve una reserva. Aprobar crea la inscripción
 * (re-verificando cupo, por si se llenó mientras esperaba).
 */
export async function decideReservation(reservationId: string, approve: boolean) {
  const user = await requireRole("DIRECTORA", "COORDINADOR");
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      studentId: true,
      programId: true,
      cycleId: true,
      program: { select: { studentCapacity: true } },
    },
  });
  if (!reservation || reservation.status !== "PENDIENTE") return;

  if (!approve) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "RECHAZADA", decidedAt: new Date(), decidedById: user.id },
    });
    revalidatePath("/panel");
    revalidatePath("/mi-espacio");
    return;
  }

  const seats = await occupiedSeats(reservation.programId, reservation.cycleId);
  if (seats >= reservation.program.studentCapacity) return; // se llenó: queda pendiente

  await prisma.$transaction([
    // Puede existir una inscripción vieja pausada/finalizada de ese mismo ciclo.
    prisma.enrollment.upsert({
      where: {
        studentId_programId_cycleId: {
          studentId: reservation.studentId,
          programId: reservation.programId,
          cycleId: reservation.cycleId,
        },
      },
      update: { status: "ACTIVA", endDate: null },
      create: {
        studentId: reservation.studentId,
        programId: reservation.programId,
        cycleId: reservation.cycleId,
        notes: "Inscrito por reserva de la familia",
      },
    }),
    prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "APROBADA", decidedAt: new Date(), decidedById: user.id },
    }),
  ]);
  revalidatePath("/panel");
  revalidatePath("/mi-espacio");
  revalidatePath(`/estudiantes/${reservation.studentId}`);
}
