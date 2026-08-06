import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  canGrade,
  canRunClasses,
  coordinationScope,
  coversProgram,
  isReadOnly,
} from "@/lib/roles";
import type { Coordination, Role } from "@/lib/generated/prisma/client";

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
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      // De qué coordina (solo COORDINADOR). Acota lo que ve y lo que puede tocar.
      coordination: true,
      active: true,
      studentId: true,
      tutorialSeenAt: true,
    },
  });
  if (!user || !user.active) {
    redirect("/login");
  }
  return user;
});

/**
 * VER: exige que el usuario tenga uno de los roles indicados; si no, lo manda al panel.
 *
 * La DIRECTORA pasa siempre: es el rol maestro y puede hacer absolutamente todo.
 * Va aquí y no en cada lista de roles a propósito — si dependiera de que quien
 * escribe la compuerta se acuerde de nombrarla, tarde o temprano una se le olvida
 * y la directora se queda fuera de su propia plataforma. El LECTOR pasa por la misma
 * razón al revés: su encargo es ver TODA la plataforma, y lo que no puede hacer
 * (escribir) lo corta `requireWriter`, no esta compuerta.
 */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (user.role === "DIRECTORA" || user.role === "LECTOR") return user;
  if (!roles.includes(user.role)) {
    redirect("/panel");
  }
  return user;
}

/**
 * VER una pantalla que es puro formulario (alta/edición). Como ahí no hay nada que
 * mirar, al LECTOR se le manda al panel en vez de enseñarle campos que no puede guardar.
 */
export async function requireEditor(...roles: Role[]) {
  const user = await getCurrentUser();
  if (isReadOnly(user.role)) redirect("/panel");
  if (user.role !== "DIRECTORA" && !roles.includes(user.role)) {
    redirect("/panel");
  }
  return user;
}

/**
 * ESCRIBIR: la compuerta de las server actions. A diferencia de `requireRole` no
 * redirige, lanza: una acción que no está autorizada no debe "no hacer nada" en
 * silencio. El LECTOR nunca pasa, y la DIRECTORA siempre.
 */
export async function requireWriter(...roles: Role[]) {
  const user = await getCurrentUser();
  if (user.role === "ALUMNO" || isReadOnly(user.role)) {
    throw new Error("No autorizado");
  }
  if (user.role !== "DIRECTORA" && !roles.includes(user.role)) {
    throw new Error("No autorizado");
  }
  return user;
}

/**
 * Exige que sea del equipo. Las cuentas de alumno se envían a su propio espacio,
 * nunca al panel de administración.
 */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (user.role === "ALUMNO") {
    redirect("/mi-espacio");
  }
  return user;
}

/**
 * Quién puede CALIFICAR en un programa (ubicar en nivel y poner la calificación
 * inicial y final): dirección y coordinación en cualquiera; la terapeuta SOLO en los
 * programas a su cargo (teacherId). La gestora de operaciones no califica.
 */
export async function requireGraderForProgram(programId: string) {
  const user = await getCurrentUser();
  if (!canGrade(user.role)) {
    throw new Error("No autorizado");
  }
  if (user.role === "TERAPEUTA") {
    await requireOwnProgram(user.id, programId);
    return user;
  }
  // Un coordinador con coordinación asignada, solo en los programas de la suya.
  await requireCoordination(user, programId);
  return user;
}

/**
 * Quién puede LLEVAR LA CLASE de un programa (asistencia, bitácora, anotaciones):
 * dirección, coordinación y operación en cualquiera; la terapeuta en los suyos.
 * Pasar lista no es calificar, por eso la gestora de operaciones sí entra aquí.
 */
export async function requireClassManagerForProgram(programId: string) {
  const user = await getCurrentUser();
  if (!canRunClasses(user.role)) {
    throw new Error("No autorizado");
  }
  if (user.role === "TERAPEUTA") {
    await requireOwnProgram(user.id, programId);
    return user;
  }
  await requireCoordination(user, programId);
  return user;
}

/**
 * ¿Esta cuenta puede calificar en ese programa? Para DECIDIR QUÉ MOSTRAR (botones,
 * enlaces, la pantalla de calificar). Las compuertas de arriba son las que mandan.
 */
export async function canGradeProgram(programId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!canGrade(user.role)) return false;
  if (user.role === "TERAPEUTA") {
    const own = await prisma.program.findFirst({
      where: { id: programId, teacherId: user.id },
      select: { id: true },
    });
    return Boolean(own);
  }
  return coversProgramId(user, programId);
}

/**
 * ¿La coordinación de esta cuenta abarca ese programa? Para decidir qué mostrar.
 * Quien no está acotado (dirección, lector, coordinación sin coordinación puesta)
 * siempre da true sin ir a la base.
 */
export async function coversProgramId(
  user: { role: Role; coordination?: Coordination | null },
  programId: string,
): Promise<boolean> {
  if (!coordinationScope(user)) return true;
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { coordination: true },
  });
  return program != null && coversProgram(user, program);
}

/** El programa debe estar a cargo de esa terapeuta. */
async function requireOwnProgram(userId: string, programId: string) {
  const own = await prisma.program.findFirst({
    where: { id: programId, teacherId: userId },
    select: { id: true },
  });
  if (!own) throw new Error("No autorizado");
}

/** El programa debe ser de la coordinación de esa cuenta (si tiene una). */
async function requireCoordination(
  user: { role: Role; coordination?: Coordination | null },
  programId: string,
) {
  if (!(await coversProgramId(user, programId))) throw new Error("No autorizado");
}
