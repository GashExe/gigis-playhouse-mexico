/**
 * Las instituciones de las que vienen los prestadores de servicio social.
 *
 * La lista es la que lleva la casa —la misma del Excel de "Instituciones /
 * Número de voluntarios"— y se escribe TAL COMO ELLAS LA ESCRIBEN, incluida
 * "Universidad Tecnologica de Corregidora" sin acento: es su lista, no la mía.
 * De aquí en adelante se administra desde la plataforma; esto solo es con qué
 * arranca el catálogo.
 *
 * Cada institución trae además cómo la escribe la gente en el formulario. Eso
 * hace falta para lo importado: en los 622 reportes de 2026 hay 24 maneras de
 * nombrar cuatro escuelas ("Universidad Anáhuac", "Anahuac qro", "ITESM",
 * "Tex de mty"), y sin los alias cada variante contaría como una institución
 * aparte. De aquí en adelante ya no hace falta, porque el formulario es una
 * lista desplegable.
 *
 * EL ORDEN IMPORTA: se prueba de arriba abajo y gana la primera. "Politécnica de
 * Santa Rosa" y "Tecnologica de Corregidora" van antes que "Tec" a propósito;
 * al revés, las dos acabarían contadas como Tec.
 */
export type Institucion = { name: string; alias: RegExp[] };

export const INSTITUCIONES: Institucion[] = [
  { name: "Universidad Tecnologica de Corregidora", alias: [/\bcorregidora\b/] },
  { name: "Politécnica de Santa Rosa", alias: [/\bpolitecnica\b/, /\bsanta rosa\b/] },
  { name: "Corporativo Universitario", alias: [/\bcorporativo\b/] },
  { name: "Universidad Privada del Bajío", alias: [/\bbajio\b/] },
  { name: "Universidad OMI", alias: [/\bomi\b/] },
  { name: "Anáhuac", alias: [/\banahuac\b/, /\banahauc\b/, /\banhuac\b/, /\banauhac\b/] },
  // No venía en la lista del Excel y sí aparece en 2026, con 14 reportes. La casa
  // confirmó que va.
  { name: "Universidad Cuauhtémoc", alias: [/\bcuauhtemoc\b/] },
  { name: "Tec", alias: [/\bitesm\b/, /\bmonterrey\b/, /\bmty\b/, /^tec\b/] },
  { name: "UAQ", alias: [/\buaq\b/, /autonoma de queretaro/] },
  { name: "UNIDEP", alias: [/\bunidep\b/] },
  { name: "UNITEC", alias: [/\bunitec\b/] },
  { name: "UNIVA", alias: [/\buniva\b/] },
  { name: "Marista", alias: [/\bmarista\b/] },
  { name: "Asunción", alias: [/\basuncion\b/] },
  { name: "Atenas", alias: [/\batenas\b/] },
  { name: "Colegio Alamos", alias: [/\balamos\b/] },
  { name: "Fonatanar", alias: [/\bfonatanar\b/] },
  { name: "Plancarte", alias: [/\bplancarte\b/] },
];

/**
 * A qué institución de la lista corresponde lo que alguien escribió, o null si a
 * ninguna. Recibe el texto YA normalizado (`claveDeBusqueda`).
 *
 * Null no es un error: significa "esto lo tiene que ver una persona". Forzar una
 * coincidencia aquí metería a alguien en la institución equivocada, y de ahí sale
 * un conteo de voluntarios por escuela que nadie puede cuadrar.
 */
export function institucionDe(claveEscuela: string): string | null {
  if (!claveEscuela) return null;
  for (const inst of INSTITUCIONES) {
    if (inst.alias.some((a) => a.test(claveEscuela))) return inst.name;
  }
  return null;
}
