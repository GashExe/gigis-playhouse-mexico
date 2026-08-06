"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement, familyDonationHold } from "@/lib/queries";
import { enrollStudent, occupiedSeats } from "@/lib/enroll";
import {
  checkEnrollmentLoad,
  findScheduleClash,
  isDroppedByStaff,
} from "@/lib/enrollment-rules";
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

/** La familia aparta lugar en una actividad del ciclo activo: inscribe de una vez. */
export async function requestReservation(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Compuerta de donativos: si la familia tiene un donativo OBLIGATORIO sin cumplir
  // (y sin prórroga vigente), no puede apartar clases hasta cumplir o que la dirección
  // la libere. La pantalla ya lo avisa; esto cierra la puerta por si entran por URL.
  if ((await familyDonationHold(studentId)).length > 0) return;

  // Solo actividades reales de la oferta del ciclo, y de las que la familia puede
  // inscribir sola: hay grupos de lista preestablecida que arma dirección.
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      active: true,
      allowFamilyEnroll: true,
      cycles: { some: { id: cycle.id } },
    },
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

  // Baja decidida por dirección: la familia no se vuelve a meter sola. Solo
  // dirección la reabre desde el expediente.
  if (await isDroppedByStaff(studentId, programId, cycle.id)) return;

  // Dos actividades a la misma hora no se pueden cursar. La pantalla ya lo dice;
  // esto cubre la carrera de inscribir las dos a la vez.
  if (await findScheduleClash(studentId, cycle.id, programId)) return;

  // Ya inscrito: nada que apartar.
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, cycleId: cycle.id, status: "ACTIVA" },
    select: { id: true },
  });
  if (enrolled) return;

  // Tope de actividades del ciclo. Va después de "ya inscrito" a propósito: así
  // reinscribir algo que ya lleva nunca tropieza con su propio conteo.
  const load = await checkEnrollmentLoad(studentId, cycle.id, {
    max: cycle.maxEnrollments,
  });
  if (load.full) return;

  // Sin lugares no se inscribe (la pantalla ya lo deshabilita; esto cubre la
  // carrera de dos familias tomando el último lugar).
  if ((await occupiedSeats(programId, cycle.id)) >= program.studentCapacity) return;

  // Constancia de que fue la familia quien apartó (y cuándo). Va aparte de la
  // inscripción: el upsert es idempotente, así que no necesita ser atómico con ella.
  await prisma.reservation.upsert({
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
  });

  await enrollStudent({
    studentId,
    programId,
    cycleId: cycle.id,
    notes: "Inscrito por la familia desde Mi espacio",
    audit: {
      summary: `${student.firstName} ${student.lastName} apartó lugar en ${program.name} (${cycle.label})`,
      entityType: "Program",
      entityId: program.id,
    },
  });

  revalidatePath("/mi-espacio");
  revalidatePath("/panel");
  revalidatePath(`/estudiantes/${studentId}`);
}
