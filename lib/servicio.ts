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

/* ── Búsqueda ──────────────────────────────────────────────────────────────── */

/**
 * Nombre y escuela juntos, sin acentos y en minúsculas: lo que se guarda en
 * `Volunteer.searchKey` y contra lo que se busca.
 *
 * Hace falta porque Postgres no sabe que "Ramírez" y "Ramirez" son la misma
 * persona, y en esta lista lo son: el mismo prestador mandó su nombre con acentos
 * y sin ellos. Buscando sobre el nombre tal cual, quien tecleaba "Ramirez" no
 * encontraba a quien quedó guardado como "Ramírez", y parecía que no estaba.
 */
export function claveDeBusqueda(...partes: (string | null | undefined)[]): string {
  return plano(partes.filter(Boolean).join(" "))
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Las palabras de lo que alguien tecleó en el buscador. Se parte en palabras
 * porque los nombres se dicen cortos y se guardan largos: quien busca
 * "Paul Ramírez" está buscando a "Paul Francisco Ramírez Jiménez", y una sola
 * cadena no lo encuentra nunca. Cada palabra tiene que aparecer; el orden no.
 */
export function palabrasDeBusqueda(q: string | null | undefined): string[] {
  const clave = claveDeBusqueda(q);
  return clave ? clave.split(" ") : [];
}

/**
 * El correo, normalizado para comparar: minúsculas y sin espacios. Devuelve null
 * si no parece un correo — media identidad es peor que ninguna, porque hace creer
 * que se reconoció a alguien.
 */
export function claveDeCorreo(email: string | null | undefined): string | null {
  const limpio = String(email ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!limpio || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) return null;
  return limpio;
}

/** Las claves derivadas de un prestador, para guardarlas de un tiro. */
export function clavesDePrestador(name: string, school: string, email?: string | null) {
  return {
    nameKey: claveDeBusqueda(name),
    searchKey: claveDeBusqueda(name, school),
    emailKey: claveDeCorreo(email),
  };
}

/* ── Actividades ───────────────────────────────────────────────────────────── */

/**
 * Tope de palabras de las actividades de un reporte. Lo pidió la coordinación:
 * lo que se lee para avalar horas tiene que caber de un vistazo.
 *
 * Para calibrar: de los 622 reportes de 2026, el promedio son 18 palabras y 57
 * pasan de 50. O sea que frena a uno de cada once, y los que frena son los que
 * hoy llegan como párrafos.
 */
export const MAX_PALABRAS_ACTIVIDADES = 50;

/** Cuántas palabras trae un texto. */
export function cuentaPalabras(texto: string | null | undefined): number {
  return String(texto ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/** Distancia de edición, para reconocer un nombre mal tecleado. */
export function distanciaTexto(a: string, b: string): number {
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

/**
 * ¿Son la misma persona con el nombre mal tecleado? Se compara sobre claves ya
 * normalizadas (`claveDeBusqueda`).
 *
 * Pide las mismas palabras, el mismo primer nombre y a lo más dos letras de
 * diferencia: así «David Hernpandez Garcilazo» se junta con «David Hernández
 * Garcilazo», pero «David Hernández» —que puede ser otro David— se queda aparte.
 *
 * Se peca de conservador a propósito, y esta es la razón: juntar a dos personas
 * distintas le regala horas a una y se las quita a la otra, y eso no se ve hasta
 * que alguien reclama su constancia. Lo que quede separado de más se junta
 * después a mano, con alguien mirando.
 */
export function esLaMismaPersona(a: string, b: string): boolean {
  const pa = a.split(" ");
  const pb = b.split(" ");
  if (pa.length !== pb.length || pa.length < 2) return false;
  if (pa[0] !== pb[0]) return false;
  if (a.length < 15) return false;
  const d = distanciaTexto(a, b);
  return d > 0 && d <= 2;
}

/**
 * ¿Vale la pena que una persona MIRE si estas dos fichas son la misma? Más suelto
 * que `esLaMismaPersona`: aquí no se junta nada solo, se sugiere.
 *
 * Da true cuando una es el nombre corto de la otra —«Paul Ramírez» dentro de
 * «Paul Francisco Ramírez Jiménez»—, que es justo el caso que la regla estricta
 * nunca junta y que en la hoja del formulario pasó decenas de veces.
 */
export function seParecen(a: string, b: string): boolean {
  if (a === b) return false;
  if (esLaMismaPersona(a, b)) return true;
  const pa = a.split(" ");
  const pb = b.split(" ");
  if (pa[0] !== pb[0]) return false;
  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (corto.length < 2) return false;
  // Todas las palabras del nombre corto aparecen en el largo, en orden.
  let i = 0;
  for (const palabra of largo) {
    if (palabra === corto[i]) i++;
    if (i === corto.length) return true;
  }
  return false;
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
  if (distanciaTexto(primera, "autorizado") <= 2 || distanciaTexto(primera, "autorizo") <= 2) {
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
