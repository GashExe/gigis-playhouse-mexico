import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Iniciales para avatares (máx. 2). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Color de avatar derivado del nombre (paleta cálida y accesible). */
const AVATAR_HUES = [12, 45, 78, 150, 194, 240, 300, 340];
export function avatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Etiqueta legible del rol de una cuenta del equipo. */
export function roleLabel(role: string): string {
  switch (role) {
    case "DIRECTORA":
      return "Directora";
    case "COORDINADOR":
      return "Coordinador";
    case "GESTORA_OPERACIONES":
      return "Gestora de operaciones";
    case "TERAPEUTA":
    // La bitácora guarda una copia del rol tal como se llamaba entonces. Los
    // movimientos viejos dicen MAESTRA: es el mismo rol con el nombre anterior.
    case "MAESTRA":
      return "Terapeuta";
    case "LECTOR":
      return "Lector";
    case "ALUMNO":
      return "Alumno";
    default:
      return role;
  }
}

/** Qué hace cada rol, en una línea (para el administrador del equipo). */
export function roleDescription(role: string): string {
  switch (role) {
    case "DIRECTORA":
      return "Puede hacer todo en la plataforma.";
    case "COORDINADOR":
      return "Coordina los programas educativos: gestiona y califica.";
    case "GESTORA_OPERACIONES":
      return "Lleva la operación (participantes, programas, calendario, donativos, avisos, oficios y reportes). No califica.";
    case "TERAPEUTA":
      return "Pasa lista, escribe bitácora y califica en los programas a su cargo.";
    case "LECTOR":
      return "Ve toda la plataforma; no puede modificar nada.";
    case "ALUMNO":
      return "Cuenta de la familia para Mi espacio.";
    default:
      return "";
  }
}

/** Tono del Badge para el rol (para <Badge tone={...}>). */
export function roleTone(role: string): "accent" | "warning" | "primary" | "neutral" {
  if (role === "DIRECTORA") return "accent";
  if (role === "COORDINADOR") return "warning";
  if (role === "LECTOR") return "neutral";
  return "primary";
}

/**
 * ¿La edad cae dentro del rango? Sin fecha de nacimiento no se descarta a nadie:
 * frenar a un participante por un dato que la casa todavía no capturó sería
 * castigarlo por un hueco del expediente.
 *
 * Vive aquí, y no en las consultas, porque la usan tanto el programa como el grupo
 * y las consultas ya dependen de las reglas de inscripción: tenerla allá cerraba
 * un círculo de importaciones.
 */
export function meetsAgeRequirement(
  age: number | null,
  ageMin: number | null,
  ageMax: number | null,
): boolean {
  if (age == null) return true;
  if (ageMin != null && age < ageMin) return false;
  if (ageMax != null && age > ageMax) return false;
  return true;
}

/** Edad en años a partir de fecha de nacimiento. */
export function ageFrom(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Edad en meses cumplidos a partir de fecha de nacimiento. */
export function ageMonthsFrom(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months--;
  return months >= 0 ? months : null;
}

/**
 * Etiqueta de edad legible. Los bebés (menos de un año) se muestran en meses, y
 * los de menos de un mes en días, para no dejar un confuso "0 años". Devuelve
 * null si no hay fecha de nacimiento.
 */
export function edadLabel(date: Date | null | undefined): string | null {
  if (!date) return null;
  const years = ageFrom(date);
  if (years == null) return null;
  if (years >= 1) return `${years} ${years === 1 ? "año" : "años"}`;
  const months = ageMonthsFrom(date) ?? 0;
  if (months >= 1) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return `${days} ${days === 1 ? "día" : "días"}`;
}
