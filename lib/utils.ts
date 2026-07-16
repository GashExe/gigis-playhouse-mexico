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
    case "MAESTRA":
      return "Maestra";
    case "ALUMNO":
      return "Alumno";
    default:
      return role;
  }
}

/** Tono del Badge para el rol (para <Badge tone={...}>). */
export function roleTone(role: string): "accent" | "warning" | "primary" {
  if (role === "DIRECTORA") return "accent";
  if (role === "COORDINADOR") return "warning";
  return "primary";
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
