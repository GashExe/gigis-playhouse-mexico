"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { enrollStudent } from "@/lib/enroll";
import {
  checkEnrollmentLoad,
  clearStaffDrop,
  findScheduleClash,
  markDroppedByStaff,
} from "@/lib/enrollment-rules";
import { ageFrom } from "@/lib/utils";

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVA: "activa",
  PAUSADA: "pausada",
  FINALIZADA: "finalizada",
};

/**
 * Inscribe a un alumno a un programa en el ciclo activo. La inscripción es POR
 * CICLO: el mismo alumno puede llevar un programa en Ene–Jun y repetirlo en Sep–Dic,
 * cada uno con su propio historial.
 */
export async function addEnrollment(studentId: string, formData: FormData) {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;
  // Dirección puede pasar por encima de los reparos —edad, empalme y tope de
  // actividades del ciclo— pero a propósito: la pantalla se lo advierte y tiene
  // que confirmarlo.
  const force = String(formData.get("force") ?? "") === "1";

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Solo programas ofertados en el ciclo activo: la directora arma esa oferta.
  const ofertado = await prisma.program.findFirst({
    where: { id: programId, cycles: { some: { id: cycle.id } } },
    select: { id: true, name: true, ageMin: true, ageMax: true },
  });
  if (!ofertado) return;

  // Requisitos de la actividad. Sin confirmación explícita no se cuelan por URL.
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { birthDate: true },
  });
  const ageOk = meetsAgeRequirement(
    ageFrom(student?.birthDate),
    ofertado.ageMin,
    ofertado.ageMax,
  );
  const clash = await findScheduleClash(studentId, cycle.id, programId);
  // El tope es del participante, no del programa: se excluye este programa del
  // conteo porque reinscribir algo que ya lleva no le añade carga.
  const load = await checkEnrollmentLoad(studentId, cycle.id, {
    max: cycle.maxEnrollments,
    excludeProgramId: programId,
  });
  if ((!ageOk || clash || load.full) && !force) return;

  // Los reparos van a la bitácora: si dirección pasó por encima, que se sepa de qué.
  const reparos = [
    !ageOk && "fuera del rango de edad",
    clash && `empalmado con ${clash.programName}`,
    load.full && `ya con ${load.current} de ${load.max} actividades del ciclo`,
  ].filter(Boolean) as string[];
  const salvedad =
    reparos.length > 0 ? ` (${reparos.join(", ")}; autorizado por dirección)` : "";

  // Inscribir es lo mismo entre por donde entre (reactiva si ya existía, reabre la
  // baja, cierra la lista de espera y ubica el nivel): eso vive en lib/enroll.
  await enrollStudent({
    studentId,
    programId,
    cycleId: cycle.id,
    notes: String(formData.get("notes") ?? "") || null,
    audit: { summary: `Inscribió a ${ofertado.name} (${cycle.label})${salvedad}` },
  });

  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/mi-espacio");
  revalidatePath("/lista-espera");
  revalidatePath("/panel");
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  studentId: string,
  status: "ACTIVA" | "PAUSADA" | "FINALIZADA",
) {
  const user = await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      endDate: status === "FINALIZADA" ? new Date() : null,
    },
    select: { programId: true, cycleId: true, program: { select: { name: true } } },
  });
  // Pausar o finalizar también es sacarlo: si la familia pudiera reactivarla desde
  // Mi espacio, la decisión de dirección no serviría de nada. Marcarla activa la
  // reabre.
  if (status === "ACTIVA") {
    await clearStaffDrop(studentId, enrollment.programId, enrollment.cycleId);
  } else {
    await markDroppedByStaff(
      studentId,
      enrollment.programId,
      enrollment.cycleId,
      user.id,
      `Dirección marcó la inscripción como ${ENROLLMENT_STATUS_LABEL[status] ?? status.toLowerCase()}.`,
    );
  }
  await logAudit({
    action: "inscripcion.estado",
    summary: `Marcó la inscripción a ${enrollment.program.name} como ${ENROLLMENT_STATUS_LABEL[status] ?? status.toLowerCase()}`,
    entityType: "Enrollment",
    entityId: enrollment.programId,
    studentId,
  });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}

export async function removeEnrollment(enrollmentId: string, studentId: string) {
  const user = await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const enrollment = await prisma.enrollment.delete({
    where: { id: enrollmentId },
    select: { programId: true, cycleId: true, program: { select: { name: true } } },
  });
  // La baja la decide dirección: la familia ya no puede volver a meterse sola a
  // esta actividad en el ciclo. Solo dirección la reabre volviéndola a inscribir.
  await markDroppedByStaff(
    studentId,
    enrollment.programId,
    enrollment.cycleId,
    user.id,
    "Dirección quitó la inscripción.",
  );
  await logAudit({
    action: "inscripcion.baja",
    summary: `Quitó la inscripción a ${enrollment.program.name}`,
    entityType: "Enrollment",
    entityId: enrollment.programId,
    studentId,
  });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}
