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

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await verifySession();
  const parsed = ProgramSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    color: formData.get("color") ?? "",
  });
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
  const parsed = ProgramSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    color: formData.get("color") ?? "",
  });
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
    },
  });
  revalidatePath("/programas");
  return { ok: true };
}

export async function toggleProgram(id: string, active: boolean) {
  await verifySession();
  await prisma.program.update({ where: { id }, data: { active } });
  revalidatePath("/programas");
  revalidatePath("/panel");
}
