import type { Role } from "@/lib/generated/prisma/client";

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
