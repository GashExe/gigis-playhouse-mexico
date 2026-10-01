/**
 * Familias de movimientos de la bitácora, para filtrarla. Cada familia junta las
 * claves de acción (ver `AuditAction` en lib/audit.ts) por prefijo. Vive aparte de
 * lib/audit.ts porque ese módulo es solo de servidor y el filtro (cliente) también
 * necesita las etiquetas.
 */
export const AUDIT_CATEGORIES = [
  { value: "calificaciones", label: "Calificaciones", prefixes: ["calificacion."] },
  { value: "niveles", label: "Niveles", prefixes: ["nivel."] },
  {
    value: "inscripciones",
    label: "Inscripciones",
    prefixes: ["inscripcion.", "espera.", "ciclo.inscripciones"],
  },
  { value: "participantes", label: "Participantes", prefixes: ["alumno.", "acceso."] },
  { value: "donativos", label: "Donativos", prefixes: ["donativo."] },
  { value: "servicio", label: "Servicio social", prefixes: ["servicio."] },
  {
    value: "configuracion",
    label: "Ciclos y configuración",
    prefixes: ["ciclo.alta", "ciclo.editar", "ciclo.continuidad", "config.", "organigrama.", "oficio."],
  },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["value"];

export function isAuditCategory(v: string | undefined): v is AuditCategory {
  return AUDIT_CATEGORIES.some((c) => c.value === v);
}

/** A qué familia pertenece una clave de acción (null si no encaja en ninguna). */
export function categoryOf(action: string): AuditCategory | null {
  for (const c of AUDIT_CATEGORIES) {
    if (c.prefixes.some((p) => action.startsWith(p))) return c.value;
  }
  return null;
}

export const AUDIT_PERIODS = [
  { value: "hoy", label: "Hoy", days: 1 },
  { value: "7", label: "Últimos 7 días", days: 7 },
  { value: "30", label: "Últimos 30 días", days: 30 },
  { value: "todo", label: "Todo", days: null },
] as const;

export type AuditPeriod = (typeof AUDIT_PERIODS)[number]["value"];
