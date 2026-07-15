/** Niveles de calificación por programa (no es un examen: es el nivel actual). */
export const NIVELES = ["Inicial", "En proceso", "Logrado"] as const;

export type Nivel = (typeof NIVELES)[number];
