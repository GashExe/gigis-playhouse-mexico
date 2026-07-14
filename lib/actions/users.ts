"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { UserSchema } from "@/lib/validators";

export type UserFormState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined;

/** Solo la directora administra cuentas. */
async function requireDirectora() {
  const user = await getCurrentUser();
  if (user.role !== "DIRECTORA") {
    throw new Error("No autorizado");
  }
  return user;
}

export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireDirectora();
  const parsed = UserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: (formData.get("role") as string) || "MAESTRA",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (!d.password) {
    return { errors: { password: ["Define una contraseña inicial."] } };
  }

  const email = d.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["Ya existe una cuenta con este correo."] } };
  }

  await prisma.user.create({
    data: {
      name: d.name,
      email,
      role: d.role,
      passwordHash: await bcrypt.hash(d.password, 10),
    },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function updateUser(
  id: string,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireDirectora();
  const parsed = UserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: (formData.get("role") as string) || "MAESTRA",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();
  const clash = await prisma.user.findFirst({
    where: { email, NOT: { id } },
  });
  if (clash) {
    return { errors: { email: ["Ya existe una cuenta con este correo."] } };
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      email,
      role: d.role,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function toggleUserActive(id: string, active: boolean) {
  const me = await requireDirectora();
  if (me.id === id) return; // no desactivarse a sí misma
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/usuarios");
}
