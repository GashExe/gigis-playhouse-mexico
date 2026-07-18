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
    select: { id: true, name: true, email: true, role: true, active: true, studentId: true },
  });
  if (!user || !user.active) {
    redirect("/login");
  }
  return user;
});

/**
 * Exige que el usuario tenga uno de los roles indicados; si no, lo manda al panel.
 *
 * La DIRECTORA pasa siempre: es el rol maestro y puede hacer absolutamente todo.
 * Va aquí y no en cada lista de roles a propósito — si dependiera de que quien
 * escribe la compuerta se acuerde de nombrarla, tarde o temprano una se le olvida
 * y la directora se queda fuera de su propia plataforma.
 */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (user.role !== "DIRECTORA" && !roles.includes(user.role)) {
    redirect("/panel");
  }
  return user;
}

/**
 * Exige que sea personal (DIRECTORA o MAESTRA). Las cuentas de alumno se envían
 * a su propio espacio, nunca al panel de administración.
 */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (user.role === "ALUMNO") {
    redirect("/mi-espacio");
  }
  return user;
}

/**
 * Quién puede calificar en un programa (ubicar en nivel y registrar temas):
 * dirección y coordinación en cualquiera; la maestra SOLO en los programas a su
 * cargo (teacherId). Es la única escritura que conserva el rol maestra.
 */
export async function requireGraderForProgram(programId: string) {
  const user = await getCurrentUser();
  if (user.role === "ALUMNO") redirect("/mi-espacio");
  if (user.role !== "MAESTRA") return user; // DIRECTORA y COORDINADOR pasan
  const own = await prisma.program.findFirst({
    where: { id: programId, teacherId: user.id },
    select: { id: true },
  });
  if (!own) redirect("/panel");
  return user;
}
