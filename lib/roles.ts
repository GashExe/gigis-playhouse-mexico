import type { Coordination, Role } from "@/lib/generated/prisma/client";

/**
 * Quién puede qué. Un solo lugar para las reglas de los roles, en vez de comparar
 * contra un rol suelto en cada pantalla (así fue como antes "todo el que no era
 * maestra" acababa mandando; al entrar un rol nuevo eso se rompe en silencio).
 *
 *  - DIRECTORA: rol maestro, puede absolutamente todo.
 *  - COORDINADOR: coordinación de programas educativos; gestiona y califica.
 *  - GESTORA_OPERACIONES: operación (participantes, programas, calendario, donativos,
 *    avisos, oficios y reportes). NO califica y no toca equipo ni configuración.
 *  - TERAPEUTA: da las clases; pasa lista, escribe bitácora y califica en SUS programas.
 *  - LECTOR: ve toda la plataforma y no modifica nada.
 *  - ALUMNO: la familia, en su propio espacio.
 */

/** Roles del equipo (todo lo que no es una cuenta de familia). */
export const STAFF_ROLES: Role[] = [
  "DIRECTORA",
  "COORDINADOR",
  "GESTORA_OPERACIONES",
  "TERAPEUTA",
  "LECTOR",
];

/** Roles que administran la operación: dan de alta, editan y resuelven. */
export const MANAGER_ROLES: Role[] = ["DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES"];

/** Roles que califican (la terapeuta, solo en los programas a su cargo). */
export const GRADER_ROLES: Role[] = ["DIRECTORA", "COORDINADOR", "TERAPEUTA"];

/** Solo mira: ninguna escritura, en ninguna pantalla. */
export function isReadOnly(role: Role): boolean {
  return role === "LECTOR";
}

/** ¿Administra expedientes, programas, inscripciones y demás operación? */
export function canManage(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}

/** ¿Registra calificaciones? (la terapeuta, además, solo en sus programas) */
export function canGrade(role: Role): boolean {
  return GRADER_ROLES.includes(role);
}

/**
 * ¿Lleva la clase del día (asistencia, bitácora, anotaciones)? Operación también:
 * pasar lista no es calificar.
 */
export function canRunClasses(role: Role): boolean {
  return canManage(role) || role === "TERAPEUTA";
}

/* ── Coordinaciones ─────────────────────────────────────────────────────────
 *
 * Hay dos coordinaciones: la educacional (matemáticas, lectura, escritura,
 * prerrequisitos) y la de lenguaje. No son roles nuevos: el rol COORDINADOR ya
 * existía, lo que faltaba era DE QUÉ coordina cada quien.
 *
 * A cada programa se le pone su coordinación, y de ahí sale todo: la coordinadora
 * ve y gestiona los programas de la suya, y con ellos a las terapeutas que los dan.
 */

export const COORDINATION_LABEL: Record<Coordination, string> = {
  EDUCACIONAL: "Educacional",
  LENGUAJE: "Lenguaje",
};

export const COORDINATIONS: Coordination[] = ["EDUCACIONAL", "LENGUAJE"];

/** Etiqueta legible de una coordinación (o "" si no tiene). */
export function coordinationLabel(coordination: Coordination | null | undefined): string {
  return coordination ? COORDINATION_LABEL[coordination] : "";
}

/** Cómo se llama alguien en pantalla: "Coordinador de lenguaje". */
export function roleWithCoordination(
  role: Role,
  coordination: Coordination | null | undefined,
  label: string,
): string {
  if (role !== "COORDINADOR" || !coordination) return label;
  return `${label} de ${COORDINATION_LABEL[coordination].toLowerCase()}`;
}

/**
 * A qué coordinación se acota esta cuenta, o null si lo ve todo.
 *
 * ES LA ÚNICA función que decide eso: si cada pantalla lo resolviera por su lado,
 * a la primera se le olvidaría a alguien (que es exactamente como antes "todo el
 * que no era maestra" acabó mandando). La DIRECTORA nunca se acota —es el rol
 * maestro—, y el LECTOR tampoco: su encargo es ver la plataforma completa.
 */
export function coordinationScope(user: {
  role: Role;
  coordination?: Coordination | null;
}): Coordination | null {
  if (user.role !== "COORDINADOR") return null;
  return user.coordination ?? null;
}

/**
 * ¿Esta cuenta manda en este programa? Solo dice que no cuando es un coordinador
 * CON coordinación y el programa es de otra. Un programa sin coordinación asignada
 * lo ven todas: nadie se queda sin dueño por un campo vacío.
 */
export function coversProgram(
  user: { role: Role; coordination?: Coordination | null },
  program: { coordination?: Coordination | null },
): boolean {
  const scope = coordinationScope(user);
  if (!scope) return true;
  return program.coordination == null || program.coordination === scope;
}
