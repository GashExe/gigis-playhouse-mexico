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
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Revisa el correo y la contraseña." };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Mensaje genérico para no revelar si el correo existe.
  const invalid = { error: "Correo o contraseña incorrectos." };
  if (!user || !user.active) return invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid;

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect("/panel");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
