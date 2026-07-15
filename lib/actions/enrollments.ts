"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { NIVELES } from "@/lib/levels";

export async function addEnrollment(studentId: string, formData: FormData) {
  await verifySession();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  // Evita duplicados: si existe, la reactiva.
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_programId: { studentId, programId } },
  });
  if (existing) {
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "ACTIVA", endDate: null },
    });
  } else {
    await prisma.enrollment.create({
      data: { studentId, programId, notes: String(formData.get("notes") ?? "") || null },
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

/**
 * Registra/actualiza la calificación (nivel) del alumno EN ESE PROGRAMA.
 * No es un examen: es el nivel actual del participante en la actividad.
 */
export async function setEnrollmentGrade(
  enrollmentId: string,
  studentId: string,
  formData: FormData,
) {
  await verifySession();
  const rawLevel = String(formData.get("level") ?? "").trim();
  const level = (NIVELES as readonly string[]).includes(rawLevel) ? rawLevel : null;
  const note = String(formData.get("levelNote") ?? "").trim() || null;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      level,
      levelNote: note,
      gradedAt: level ? new Date() : null,
    },
  });
  revalidatePath(`/estudiantes/${studentId}`);
}
