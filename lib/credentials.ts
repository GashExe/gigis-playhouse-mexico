/**
 * Generación de credenciales para las cuentas de los participantes (role ALUMNO).
 *
 * - El usuario de acceso es la matrícula Gigi's normalizada (solo dígitos).
 * - La contraseña inicial se arma de forma determinista con el nombre y el
 *   apellido paterno más el año: 3 letras del nombre + 3 del apellido + año.
 *   Ej.: "Roberto", "Abad", 2026  ->  "RobAba2026".
 */

/** Quita acentos/diacríticos y deja texto ASCII básico. */
function stripAccents(value: string): string {
  // NFD separa las letras de sus acentos (marcas combinantes); luego quitamos
  // todo lo que no sea ASCII, eliminando esos acentos y dejando la letra base.
  return value.normalize("NFD").replace(/[^\x00-\x7f]/g, "");
}

/** Limpia espacios repetidos, tabuladores y saltos que a veces trae el CSV. */
export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    // Secuencias de escape LITERALES que trae el CSV (dos caracteres: \ + t).
    .replace(/\\[tnr]/g, " ")
    // Espacios/tabs/saltos reales.
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza la matrícula a solo dígitos: recorta espacios y quita la "G" inicial
 * del formato nuevo (G + 8 dígitos). Si tras limpiar no queda nada numérico,
 * devuelve el texto saneado (mayúsculas, sin espacios) como respaldo para casos
 * atípicos como "SAID29052018".
 */
export function normalizeMatricula(raw: string | null | undefined): string {
  const cleaned = cleanText(raw).replace(/\s+/g, "");
  if (!cleaned) return "";
  // Quita una "G"/"g" inicial (formato nuevo) y deja los dígitos.
  const withoutG = cleaned.replace(/^[Gg]/, "");
  const digitsOnly = withoutG.replace(/\D/g, "");
  if (digitsOnly.length > 0) return digitsOnly;
  // Respaldo para matrículas no estándar (no numéricas).
  return cleaned.toUpperCase();
}

/** Toma las primeras `n` letras de la primera palabra, con Inicial Mayúscula. */
function letterBlock(word: string, n: number): string {
  const letters = stripAccents(word)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, n)
    .toLowerCase();
  if (!letters) return "";
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

/**
 * Contraseña inicial: 3 letras del primer nombre + 3 del apellido paterno + año.
 * Maneja nombres cortos sin romper (usa lo que haya disponible).
 */
export function generatePassword(
  firstName: string,
  apellidoPaterno: string,
  year: number,
): string {
  const firstWord = (s: string) => cleanText(s).split(" ")[0] ?? "";
  const namePart = letterBlock(firstWord(firstName), 3);
  const lastPart = letterBlock(firstWord(apellidoPaterno), 3);
  const base = `${namePart}${lastPart}` || "Gigis";
  return `${base}${year}`;
}
