"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { LoginSchema } from "@/lib/validators";

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
