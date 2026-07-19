"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { LoginSchema, PasswordChangeSchema } from "@/lib/validators";

export type LoginState = {
  error?: string;
} | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Revisa el usuario y la contraseña." };
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      passwordHash: true,
      studentId: true,
    },
  });

  // Mensaje genérico para no revelar si el usuario existe.
  const invalid = { error: "Usuario o contraseña incorrectos." };
  if (!user || !user.active) return invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid;

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
    studentId: user.studentId ?? undefined,
  });

  // Los alumnos entran a su propio espacio; el equipo, al panel.
  redirect(user.role === "ALUMNO" ? "/mi-espacio" : "/panel");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export type PasswordState =
  | { errors?: Record<string, string[]>; ok?: boolean }
  | undefined;

/**
 * Cambia la contraseña de la cuenta con sesión activa (familia o equipo). Confirma
 * la contraseña actual antes de reemplazarla. Al hacerlo, se borra la contraseña
 * inicial que veía la dirección: ya no aplica y no debe quedar a la vista.
 */
export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await getSession();
  if (!session?.userId) {
    return { errors: { current: ["Tu sesión expiró. Entra de nuevo."] } };
  }

  const parsed = PasswordChangeSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!user) {
    return { errors: { current: ["No encontramos tu cuenta."] } };
  }

  const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!ok) {
    return { errors: { current: ["La contraseña actual no es correcta."] } };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.next, 10),
      initialPassword: null,
    },
  });
  return { ok: true };
}
