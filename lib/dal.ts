import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/generated/prisma/client";

/**
 * Capa de acceso a datos (DAL). Centraliza la verificación de sesión y autorización.
 * Toda página o acción que toque datos debe pasar por aquí.
 */

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

/** Devuelve la sesión sin redirigir (para vistas públicas como /login). */
export const getOptionalSession = cache(async (): Promise<SessionPayload | null> => {
  return getSession();
});

/** Usuario actual (datos frescos desde la BD, sin el hash de contraseña). */
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) {
    redirect("/login");
  }
  return user;
});

/** Exige que el usuario tenga uno de los roles indicados; si no, lo manda al panel. */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) {
    redirect("/panel");
  }
  return user;
}
