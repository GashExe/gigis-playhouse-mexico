"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { ageFrom } from "@/lib/utils";

/**
 * Apartar actividades. Aquí no hay solicitud que aprobar: la actividad tiene un
 * cupo y la familia inscribe al participante directo mientras queden lugares
 * (quien llega primero, se queda). Dirección administra las bajas desde el
 * expediente.
 *
 * La `Reservation` se conserva como constancia de que fue la familia quien
 * apartó (y cuándo); la inscripción real es la `Enrollment` que nace en el mismo
 * movimiento.
 */

/** Cupo ocupado de un programa en un ciclo (inscripciones activas). */
async function occupiedSeats(programId: string, cycleId: string) {
  return prisma.enrollment.count({
    where: { programId, cycleId, status: "ACTIVA" },
  });
}

/** La familia aparta lugar en una actividad del ciclo activo: inscribe de una vez. */
export async function requestReservation(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Solo actividades reales de la oferta del ciclo.
  const program = await prisma.program.findFirst({
    where: { id: programId, active: true, cycles: { some: { id: cycle.id } } },
    select: { id: true, name: true, studentCapacity: true, ageMin: true, ageMax: true },
  });
  if (!program) return;

  // Requisitos de la actividad: hoy, el rango de edad. La pantalla ya lo
  // deshabilita; esto evita colar una inscripción fuera de requisito por URL.
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true, birthDate: true },
  });
  if (!student) return;
  if (!meetsAgeRequirement(ageFrom(student.birthDate), program.ageMin, program.ageMax)) {
    return;
  }

  // Ya inscrito: nada que apartar.
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, cycleId: cycle.id, status: "ACTIVA" },
    select: { id: true },
  });
  if (enrolled) return;

  // Sin lugares no se inscribe (la pantalla ya lo deshabilita; esto cubre la
  // carrera de dos familias tomando el último lugar).
  if ((await occupiedSeats(programId, cycle.id)) >= program.studentCapacity) return;

  await prisma.$transaction([
    // Puede existir una inscripción vieja pausada/finalizada de ese mismo ciclo.
    prisma.enrollment.upsert({
      where: {
        studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id },
      },
      update: { status: "ACTIVA", endDate: null },
      create: {
        studentId,
        programId,
        cycleId: cycle.id,
        notes: "Inscrito por la familia desde Mi espacio",
      },
    }),
    prisma.reservation.upsert({
      where: {
        studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id },
      },
      update: { status: "APROBADA", decidedAt: new Date() },
      create: {
        studentId,
        programId,
        cycleId: cycle.id,
        status: "APROBADA",
        decidedAt: new Date(),
      },
    }),
  ]);

  await logAudit({
    action: "inscripcion.alta",
    summary: `${student.firstName} ${student.lastName} apartó lugar en ${program.name} (${cycle.label})`,
    entityType: "Program",
    entityId: program.id,
    studentId,
  });

  revalidatePath("/mi-espacio");
  revalidatePath("/panel");
  revalidatePath(`/estudiantes/${studentId}`);
}
