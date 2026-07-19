"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { StudentSchema, StudentStatusSchema, HealthSchema } from "@/lib/validators";
import { ensureAlumnoAccount } from "@/lib/accounts";
import { logAudit } from "@/lib/audit";
import type { StudentStatus } from "@/lib/generated/prisma/client";

const STUDENT_STATUS_LABEL: Record<string, string> = {
  ACTIVO: "activo",
  INACTIVO: "inactivo",
  EGRESADO: "egresado",
};

export type FormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function toDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseStudent(formData: FormData) {
  return StudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    birthDate: formData.get("birthDate") ?? "",
    gender: formData.get("gender") ?? "",
    guardianName: formData.get("guardianName") ?? "",
    guardianPhone: formData.get("guardianPhone") ?? "",
    guardianEmail: formData.get("guardianEmail") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
    status: (formData.get("status") as string) || "ACTIVO",
  });
}

export async function createStudent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("DIRECTORA", "COORDINADOR");
  const parsed = parseStudent(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const student = await prisma.student.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate: toDate(d.birthDate),
      gender: d.gender ? (d.gender as "FEMENINO" | "MASCULINO" | "OTRO") : null,
      guardianName: d.guardianName || null,
      guardianPhone: d.guardianPhone || null,
      guardianEmail: d.guardianEmail || null,
      address: d.address || null,
      notes: d.notes || null,
      status: d.status,
    },
  });

  // Genera automáticamente su cuenta de acceso (usuario del nombre + contraseña).
  // La contraseña inicial queda visible para la directora en el expediente.
  await ensureAlumnoAccount(student);

  await logAudit({
    action: "alumno.alta",
    summary: `Registró a ${student.firstName} ${student.lastName}`,
    entityType: "Student",
    entityId: student.id,
    studentId: student.id,
  });

  revalidatePath("/estudiantes");
  revalidatePath("/panel");
  redirect(`/estudiantes/${student.id}`);
}

export async function updateStudent(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("DIRECTORA", "COORDINADOR");
  const parsed = parseStudent(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await prisma.student.update({
    where: { id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate: toDate(d.birthDate),
      gender: d.gender ? (d.gender as "FEMENINO" | "MASCULINO" | "OTRO") : null,
      guardianName: d.guardianName || null,
      guardianPhone: d.guardianPhone || null,
      guardianEmail: d.guardianEmail || null,
      address: d.address || null,
      notes: d.notes || null,
      status: d.status,
    },
  });
  await logAudit({
    action: "alumno.editar",
    summary: `Editó los datos de ${d.firstName} ${d.lastName}`,
    entityType: "Student",
    entityId: id,
    studentId: id,
  });
  revalidatePath(`/estudiantes/${id}`);
  revalidatePath("/estudiantes");
  redirect(`/estudiantes/${id}`);
}

/**
 * Cambia solo el estado del participante. Existe aparte de updateStudent para poder
 * hacerlo de un clic desde su expediente o la lista, sin abrir el formulario entero.
 */
export async function setStudentStatus(id: string, status: StudentStatus) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const parsed = StudentStatusSchema.safeParse(status);
  if (!parsed.success) return;
  const student = await prisma.student.update({
    where: { id },
    data: { status: parsed.data },
    select: { firstName: true, lastName: true },
  });
  await logAudit({
    action: "alumno.estado",
    summary: `Cambió el estado de ${student.firstName} ${student.lastName} a ${STUDENT_STATUS_LABEL[parsed.data] ?? parsed.data.toLowerCase()}`,
    entityType: "Student",
    entityId: id,
    studentId: id,
  });
  revalidatePath(`/estudiantes/${id}`);
  revalidatePath("/estudiantes");
  revalidatePath("/panel");
}

export async function deleteStudent(id: string) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const student = await prisma.student.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  await prisma.student.delete({ where: { id } });
  // Sin studentId: el participante ya no existe (la FK lo pondría en null de todos
  // modos). El nombre queda en el resumen para que el movimiento no se pierda.
  await logAudit({
    action: "alumno.baja",
    summary: `Eliminó a ${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim(),
    entityType: "Student",
    entityId: id,
  });
  revalidatePath("/estudiantes");
  revalidatePath("/panel");
  redirect("/estudiantes");
}

/**
 * Guarda el cuestionario de salud de un participante. Existe porque el historial solo
 * se llenaba en el onboarding del tutor, y los 470 alumnos vienen del padrón, no de
 * tutores registrándose: sin esto su expediente médico se queda vacío para siempre.
 * Usa el MISMO HealthSchema que el onboarding, así que exige lo mismo.
 */
export async function saveHealth(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("DIRECTORA", "COORDINADOR");
  const parsed = HealthSchema.safeParse({
    bloodType: formData.get("bloodType") ?? "",
    allergies: formData.get("allergies") ?? "",
    medications: formData.get("medications") ?? "",
    medicalConditions: formData.get("medicalConditions") ?? "",
    therapies: formData.get("therapies") ?? "",
    dietaryRestrictions: formData.get("dietaryRestrictions") ?? "",
    doctorName: formData.get("doctorName") ?? "",
    doctorPhone: formData.get("doctorPhone") ?? "",
    emergencyName: formData.get("emergencyName") ?? "",
    emergencyPhone: formData.get("emergencyPhone") ?? "",
    emergencyRelation: formData.get("emergencyRelation") ?? "",
    healthNotes: formData.get("healthNotes") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const data = {
    bloodType: d.bloodType || null,
    allergies: d.allergies || null,
    medications: d.medications || null,
    medicalConditions: d.medicalConditions || null,
    therapies: d.therapies || null,
    dietaryRestrictions: d.dietaryRestrictions || null,
    doctorName: d.doctorName || null,
    doctorPhone: d.doctorPhone || null,
    emergencyName: d.emergencyName || null,
    emergencyPhone: d.emergencyPhone || null,
    emergencyRelation: d.emergencyRelation || null,
    notes: d.healthNotes || null,
  };
  await prisma.healthProfile.upsert({
    where: { studentId },
    create: { studentId, ...data },
    update: data,
  });
  revalidatePath(`/estudiantes/${studentId}`);
  redirect(`/estudiantes/${studentId}`);
}
