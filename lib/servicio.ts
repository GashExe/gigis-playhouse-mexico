import type { ServiceLogStatus, VolunteerStatus } from "@/lib/generated/prisma/client";

/**
 * Servicio social: cómo se leen y cómo se escriben las horas.
 *
 * Las horas viven en MINUTOS en la base. Aquí están las dos traducciones —del
 * texto que escribe una persona a minutos, y de vuelta a algo legible— y la
 * lectura del "Autorizado (Si/NO)" de la hoja vieja.
 *
 * Este archivo lo comparten la plataforma y el importador de la hoja del Google
 * Form a propósito: si el importador leyera "10:30" de una manera y el formulario
 * de otra, las horas de una misma persona no cuadrarían entre lo que trae de
 * antes y lo que reporta de hoy.
 */

/** Quita acentos y baja a minúsculas, para comparar texto escrito a mano. */
function plano(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Horas ─────────────────────────────────────────────────────────────────── */

/**
 * Lee las horas que escribió una persona y las devuelve en minutos, o null si no
 * se pudo entender.
 *
 * Acepta lo que de hecho llegó al formulario en estos años, no solo el número
 * limpio: "8", "8.5", "10:30", "8h30", "6 hrs.", "2 horas.", "1 1/2",
 * "1 hora y 15", "9:30 HORAS". Devuelve null para lo que no es una cantidad
 * —un punto, un párrafo de actividades en el campo equivocado, "5 horas más el
 * apoyo de g100 (3hrs). 8 horas en total"—: ahí la coordinación tiene que leerlo
 * y decidir, y adivinar por ella sería inventarle horas a alguien.
 */
export function parseHorasAMinutos(raw: string | null | undefined): number | null {
  const s = plano(String(raw ?? ""))
    .replace(/\.$/, "")
    .trim();
  if (!s) return null;

  // La palabra "horas" al final sobra para la cuenta: "6 hrs", "108 h", "9:30 HORAS".
  const sinUnidad = s.replace(/\s*(horas?|hrs?|hras?|h)\s*$/, "").trim();

  // 8 · 8.5 · 0
  const decimal = /^(\d+(?:[.,]\d+)?)$/.exec(sinUnidad);
  if (decimal) return redondeaMinutos(parseFloat(decimal[1].replace(",", ".")) * 60);

  // 10:30 · 8h30 · 3:15
  const reloj = /^(\d+)\s*[:h]\s*(\d{1,2})$/.exec(sinUnidad);
  if (reloj) {
    const minutos = parseInt(reloj[2], 10);
    if (minutos < 60) return parseInt(reloj[1], 10) * 60 + minutos;
  }

  // 1 1/2
  const mixto = /^(\d+)\s+(\d+)\/(\d+)$/.exec(sinUnidad);
  if (mixto) {
    const den = parseInt(mixto[3], 10);
    if (den > 0) {
      return redondeaMinutos(
        (parseInt(mixto[1], 10) + parseInt(mixto[2], 10) / den) * 60,
      );
    }
  }

  // 1 hora y 15
  const conMinutos = /^(\d+)\s*(?:horas?|hrs?|h)\s*y\s*(\d{1,2})(?:\s*min(?:utos)?)?$/.exec(s);
  if (conMinutos) {
    const minutos = parseInt(conMinutos[2], 10);
    if (minutos < 60) return parseInt(conMinutos[1], 10) * 60 + minutos;
  }

  return null;
}

function redondeaMinutos(minutos: number): number | null {
  if (!Number.isFinite(minutos) || minutos < 0) return null;
  return Math.round(minutos);
}

/** Minutos → número de horas (10.5). Para sumar y comparar contra la meta. */
export function aHoras(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}

/** Minutos → cómo se escribe en pantalla: "10.5 h", "6 h", "0 h". */
export function horasLabel(minutos: number | null | undefined): string {
  if (minutos == null) return "—";
  const horas = aHoras(minutos);
  return `${Number.isInteger(horas) ? horas : horas.toFixed(2).replace(/0$/, "")} h`;
}

/* ── "Autorizado (Si/NO)" ──────────────────────────────────────────────────── */

/** Distancia de edición, acotada: para leer "Aotorizado" como "Autorizado". */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        previo + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previo = temp;
    }
  }
  return fila[b.length];
}

export type LecturaAutorizacion = {
  status: ServiceLogStatus;
  /** Horas que la coordinación dejó pasar, cuando escribió un número distinto. */
  horasAutorizadas: number | null;
  /** El texto original, cuando dice algo más que "autorizado". */
  nota: string | null;
};

/**
 * Lee la columna "Autorizado (Si/NO)" de la hoja del formulario.
 *
 * Ahí nadie escribió dos veces igual: hay "AUTORIZADO", "Autorizo", "Aotorizado",
 * "autorizaod" y 30 variantes más, todas queriendo decir lo mismo. Se leen con
 * distancia de edición contra "autorizado"/"autorizo" en vez de con una lista de
 * erratas, porque la lista siempre se queda corta a la siguiente que alguien teclee.
 *
 * Vacío es PENDIENTE: que nadie haya escrito nada no es un rechazo.
 * "Se autorizan 20" es AUTORIZADO pero con sus horas recortadas, y eso se guarda
 * aparte para no borrar lo que la persona dijo que trabajó.
 */
export function leeAutorizacion(raw: string | null | undefined): LecturaAutorizacion {
  const original = String(raw ?? "").trim();
  const s = plano(original);
  if (!s || s === "0") {
    return { status: "PENDIENTE", horasAutorizadas: null, nota: null };
  }

  // "se autorizan 20": pasa, pero solo esas horas.
  const recorte = /\bse autorizan?\s+(\d+(?:[.,]\d+)?)\b/.exec(s);
  if (recorte) {
    return {
      status: "AUTORIZADO",
      horasAutorizadas: parseFloat(recorte[1].replace(",", ".")),
      nota: original,
    };
  }

  const soloLetras = s.replace(/[^a-z ]/g, "").trim();

  // "no autorizado", "no", "noautorizado", "cancelado ...".
  if (/^no\b/.test(soloLetras) || soloLetras.startsWith("noautorizado")) {
    return { status: "NO_AUTORIZADO", horasAutorizadas: null, nota: notaSiDiceMas(original) };
  }
  if (soloLetras.includes("cancelad")) {
    return { status: "NO_AUTORIZADO", horasAutorizadas: null, nota: original };
  }

  // "autorizado (si)", "autorizados", "AUTORIZO*", y sus erratas.
  const primera = soloLetras.split(" ")[0] ?? "";
  if (distancia(primera, "autorizado") <= 2 || distancia(primera, "autorizo") <= 2) {
    return { status: "AUTORIZADO", horasAutorizadas: null, nota: notaSiDiceMas(original) };
  }

  // Cualquier otra cosa se queda pendiente CON su texto: que la lea una persona.
  return { status: "PENDIENTE", horasAutorizadas: null, nota: original };
}

/** Guarda el texto solo cuando dice algo más que la palabra suelta. */
function notaSiDiceMas(original: string): string | null {
  const palabras = plano(original).replace(/[^a-z ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return null;
  if (palabras.length === 2 && (palabras[0] === "no" || palabras[1] === "si")) return null;
  return original;
}

/* ── Etiquetas ─────────────────────────────────────────────────────────────── */

export const SERVICE_LOG_STATUS_LABEL: Record<ServiceLogStatus, string> = {
  PENDIENTE: "Por revisar",
  AUTORIZADO: "Autorizado",
  NO_AUTORIZADO: "No autorizado",
};

export const VOLUNTEER_STATUS_LABEL: Record<VolunteerStatus, string> = {
  ACTIVO: "Activo",
  CONCLUIDO: "Concluido",
  BAJA: "Baja",
};

export function serviceLogTone(status: ServiceLogStatus): "warning" | "success" | "danger" {
  if (status === "AUTORIZADO") return "success";
  if (status === "NO_AUTORIZADO") return "danger";
  return "warning";
}

/**
 * Minutos que CUENTAN de un reporte: los que autorizó la coordinación si le
 * recortó, y si no, los que reportó. Un reporte que no está autorizado no suma.
 */
export function minutosQueCuentan(log: {
  status: ServiceLogStatus;
  reportedMinutes: number;
  approvedMinutes: number | null;
}): number {
  if (log.status !== "AUTORIZADO") return 0;
  return log.approvedMinutes ?? log.reportedMinutes;
}
