"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { ProgramSchema } from "@/lib/validators";

export type ProgramFormState =
  | { errors?: Record<string, string[]>; ok?: boolean }
  | undefined;

const PALETTE = [
  "#E4572E", "#2E86AB", "#8AA624", "#C05299", "#F2A541",
  "#3E7C59", "#6C63FF", "#D7263D", "#0EAD9C", "#B5651D",
];

/** Convierte un campo de texto a entero (o null si viene vacío/no numérico). */
function toInt(value: string | undefined): number | null {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) && value?.trim() ? Math.trunc(n) : null;
}

function parseProgramForm(formData: FormData) {
  return ProgramSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    color: formData.get("color") ?? "",
    schedule: formData.get("schedule") ?? "",
    type: formData.get("type") ?? "",
    ageMin: formData.get("ageMin") ?? "",
    ageMax: formData.get("ageMax") ?? "",
    studentCapacity: formData.get("studentCapacity") ?? "",
    collaboratorCapacity: formData.get("collaboratorCapacity") ?? "",
    teacherId: formData.get("teacherId") ?? "",
  });
}

/** Campos de actividad comunes a crear/editar. */
function activityData(d: ReturnType<typeof ProgramSchema.parse>) {
  return {
    schedule: d.schedule || null,
    type: d.type || null,
    ageMin: toInt(d.ageMin),
    ageMax: toInt(d.ageMax),
    studentCapacity: toInt(d.studentCapacity) ?? 7,
    collaboratorCapacity: toInt(d.collaboratorCapacity),
    teacherId: d.teacherId || null,
  };
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await verifySession();
  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const count = await prisma.program.count();
  await prisma.program.create({
    data: {
      name: d.name,
      description: d.description || null,
      area: d.area || null,
      color: d.color || PALETTE[count % PALETTE.length],
      ...activityData(d),
    },
  });
  revalidatePath("/programas");
  revalidatePath("/panel");
  return { ok: true };
}

export async function updateProgram(
  id: string,
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await verifySession();
  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await prisma.program.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      area: d.area || null,
      color: d.color || null,
      ...activityData(d),
    },
  });
  revalidatePath("/programas");
  revalidatePath("/panel");
  return { ok: true };
}

export async function toggleProgram(id: string, active: boolean) {
  await verifySession();
  await prisma.program.update({ where: { id }, data: { active } });
  revalidatePath("/programas");
  revalidatePath("/panel");
}
