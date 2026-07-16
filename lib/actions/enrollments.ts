"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getActiveCycle } from "@/lib/queries";

/**
 * Inscribe a un alumno a un programa en el ciclo activo. La inscripción es POR
 * CICLO: el mismo alumno puede llevar un programa en Ene–Jun y repetirlo en Sep–Dic,
 * cada uno con su propio historial.
 */
export async function addEnrollment(studentId: string, formData: FormData) {
  await verifySession();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Solo programas ofertados en el ciclo activo: la directora arma esa oferta.
  const ofertado = await prisma.program.findFirst({
    where: { id: programId, cycles: { some: { id: cycle.id } } },
    select: { id: true },
  });
  if (!ofertado) return;

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
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  studentId: string,
  status: "ACTIVA" | "PAUSADA" | "FINALIZADA",
) {
  await verifySession();
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      endDate: status === "FINALIZADA" ? new Date() : null,
    },
  });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}

export async function removeEnrollment(enrollmentId: string, studentId: string) {
  await verifySession();
  await prisma.enrollment.delete({ where: { id: enrollmentId } });
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
}
