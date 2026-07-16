"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { StudentSchema } from "@/lib/validators";
import { ensureAlumnoAccount } from "@/lib/accounts";

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
    matricula: formData.get("matricula") ?? "",
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
  await verifySession();
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

  // Genera automáticamente su cuenta de acceso (usuario + contraseña).
  // La contraseña inicial queda visible para la directora en el expediente.
  await ensureAlumnoAccount(student, d.matricula || undefined);

  revalidatePath("/estudiantes");
  revalidatePath("/panel");
  redirect(`/estudiantes/${student.id}`);
}

export async function updateStudent(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await verifySession();
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
  revalidatePath(`/estudiantes/${id}`);
  revalidatePath("/estudiantes");
  redirect(`/estudiantes/${id}`);
}

export async function deleteStudent(id: string) {
  await verifySession();
  await prisma.student.delete({ where: { id } });
  revalidatePath("/estudiantes");
  revalidatePath("/panel");
  redirect("/estudiantes");
}
