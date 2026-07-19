"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { UserSchema } from "@/lib/validators";
import { generatePassword } from "@/lib/credentials";
import { logAudit } from "@/lib/audit";

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
    username: formData.get("username"),
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

  const username = d.username.toLowerCase();
  const email = d.email ? d.email.toLowerCase() : null;

  if (await prisma.user.findUnique({ where: { username } })) {
    return { errors: { username: ["Ese usuario ya está en uso."] } };
  }
  if (email && (await prisma.user.findUnique({ where: { email } }))) {
    return { errors: { email: ["Ya existe una cuenta con este correo."] } };
  }

  await prisma.user.create({
    data: {
      name: d.name,
      username,
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
    username: formData.get("username"),
    email: formData.get("email"),
    role: (formData.get("role") as string) || "MAESTRA",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const username = d.username.toLowerCase();
  const email = d.email ? d.email.toLowerCase() : null;

  const usernameClash = await prisma.user.findFirst({
    where: { username, NOT: { id } },
  });
  if (usernameClash) {
    return { errors: { username: ["Ese usuario ya está en uso."] } };
  }
  if (email) {
    const emailClash = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (emailClash) {
      return { errors: { email: ["Ya existe una cuenta con este correo."] } };
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      username,
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

/**
 * Repone la contraseña de acceso de un participante para cuando la familia la olvidó.
 * Genera una nueva (con el mismo criterio que al crear la cuenta), la guarda como
 * contraseña inicial para que la dirección se la entregue, y queda en la bitácora.
 * Devuelve la nueva contraseña para mostrarla al momento.
 */
export async function resetStudentPassword(
  studentId: string,
): Promise<{ ok: true; password: string } | { ok: false }> {
  await requireDirectora();
  const [account, student] = await Promise.all([
    prisma.user.findFirst({
      where: { studentId, role: "ALUMNO" },
      select: { id: true },
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  if (!account || !student) return { ok: false };

  const password = generatePassword(
    student.firstName,
    student.lastName.split(" ")[0] ?? "",
    new Date().getFullYear(),
  );
  await prisma.user.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(password, 10), initialPassword: password },
  });
  await logAudit({
    action: "acceso.repone-contrasena",
    summary: `Repuso la contraseña de acceso de ${student.firstName} ${student.lastName}`,
    entityType: "Student",
    entityId: studentId,
    studentId,
  });
  revalidatePath(`/estudiantes/${studentId}`);
  return { ok: true, password };
}
