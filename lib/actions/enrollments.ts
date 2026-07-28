"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { ensurePlacementOnEnroll } from "@/lib/placement";
import {
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
  // Dirección puede pasar por encima del rango de edad y del empalme de horario,
  // pero a propósito: la pantalla se lo advierte y tiene que confirmarlo.
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
  if ((!ageOk || clash) && !force) return;
  const salvedad = !ageOk && clash
    ? " (fuera del rango de edad y empalmado, autorizado por dirección)"
    : !ageOk
      ? " (fuera del rango de edad, autorizado por dirección)"
      : clash
        ? ` (empalmado con ${clash.programName}, autorizado por dirección)`
        : "";

  // Evita duplicados dentro del mismo ciclo: si ya existe, la reactiva.
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id } },
  });
  if (existing) {
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "ACTIVA", endDate: null },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        studentId,
        programId,
        cycleId: cycle.id,
        notes: String(formData.get("notes") ?? "") || null,
      },
    });
  }
  // Dirección la vuelve a abrir: si estaba dada de baja, la familia recupera el
  // control de esta actividad en Mi espacio.
  await clearStaffDrop(studentId, programId, cycle.id);

  await logAudit({
    action: "inscripcion.alta",
    summary: `Inscribió a ${ofertado.name} (${cycle.label})${salvedad}`,
    entityType: "Enrollment",
    entityId: programId,
    studentId,
  });
  // Ubicación automática de nivel: recupera su nivel del historial o lo coloca en
  // el más bajo si es nuevo en el programa.
  await ensurePlacementOnEnroll(studentId, programId, cycle.id);
  revalidatePath(`/estudiantes/${studentId}`);
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
