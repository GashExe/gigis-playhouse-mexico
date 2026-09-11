/**
 * Importa la hoja de respuestas del Google Form «Registro de horas "Servicio
 * Social"» (2021 en adelante) a las tablas de servicio social.
 *
 *   npm run db:import-servicio-social -- "<ruta.xlsx>" [--commit] [--desde 2026]
 *
 * Solo trae de 2026 en adelante (`--desde`). Lo pidió la casa: de 2025 para atrás
 * son prestadores que hace años se liberaron, y arrastrarlos hace que el padrón
 * de hoy no se pueda leer. De 3,339 filas con nombre, 622 son de 2026.
 *
 * Lo que hace, en orden:
 *   1. Arma el catálogo de instituciones con la lista que lleva la casa, y el de
 *      áreas y líderes. Como solo se leen filas del año
 *      de corte en adelante, todo lo que aparece está VIGENTE por definición, y
 *      entra activo. Al final se avisa qué se usó que no está en la lista del
 *      formulario, y qué de la lista no usó nadie: eso lo decide la coordinación
 *      desde Áreas y líderes, no este archivo.
 *   2. Agrupa las filas por persona y crea un prestador por cada una.
 *   3. Mete cada fila como un reporte semanal, ya autorizado o rechazado según
 *      la columna "Autorizado (Si/NO)".
 *
 * Como los demás importadores del proyecto, va en SIMULACIÓN por defecto: enseña
 * el resumen y lo que no pudo leer, y solo escribe con --commit. Se puede correr
 * las veces que haga falta: reconoce al prestador por su nombre y no vuelve a
 * meter un reporte que ya está.
 *
 * Lo que NO adivina:
 *   - La meta de horas de cada quien (la marca su escuela y la hoja no la trae):
 *     queda vacía y la captura la coordinación.
 *   - Las horas que no se dejaron leer ("1 hora y 15" sí; un párrafo de
 *     actividades en el campo de horas, no) entran en 0 con el texto original
 *     guardado, para que se vean y se corrijan a mano. No se inventa un número.
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { INSTITUCIONES, institucionDe } from "../lib/instituciones";
import {
  claveDeBusqueda,
  clavesDePrestador,
  distanciaTexto,
  esLaMismaPersona,
  leeAutorizacion,
  parseHorasAMinutos,
} from "../lib/servicio";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

/* ── Columnas de la hoja ───────────────────────────────────────────────────── */
const COL = {
  marca: 0,
  nombre: 1,
  escuela: 2,
  area: 3,
  lider: 4,
  inicio: 5,
  fin: 6,
  horas: 7,
  actividades: 8,
  autorizado: 10,
} as const;

/** Áreas que el menú del formulario de Google ofrece HOY, en su orden. */
const AREAS_VIGENTES = [
  "Redes sociales",
  "Programas educacionales (Planeaciones y/o materiales)",
  "Dirección",
  "Gestora de familias y operaciones",
  "Programas educacionales (Tutorías)",
  "Desarrollo institucional (Recaudación de fondos)",
  "Programas generales (Paula Tornell)",
  "Habilidades sociales (Verónica García)",
  "Coordinación Local",
  "Coordinación Servicio Social",
];

/** Líderes que el menú del formulario de Google ofrece HOY, en su orden. */
const LIDERES_VIGENTES = [
  "Paula Tornell",
  "Nadia Diaz",
  "Mallely Martínez",
  "Eva Barba",
  "Karyna Ordóñez",
  "Dayra Moreno",
  "Verónica García",
  "Mariana Martínez",
  "Jorge Vargas",
];

/* ── Utilidades de texto ───────────────────────────────────────────────────── */

const limpia = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** "8/16/21" o "8/23/2021 9:52:00" → Date a medianoche UTC (convención @db.Date). */
function parseFecha(texto: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(texto.trim());
  if (!m) return null;
  const mes = parseInt(m[1], 10);
  const dia = parseInt(m[2], 10);
  let anio = parseInt(m[3], 10);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2015 || anio > 2100) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Una semana de verdad no dura tres años. Arriba de este tramo, el renglón trae
 * un año mal tecleado en una de las dos fechas y no se le puede creer.
 */
const DIAS_SEMANA_CREIBLE = 60;

/**
 * De qué AÑO es un renglón, para el corte.
 *
 * Normalmente manda la fecha de término: una semana que se mandó tarde sigue
 * siendo de cuando ocurrió. Pero cuando el tramo entre las dos fechas es absurdo
 * —"22/ene/2023 a 26/ene/2026"— lo que pasó es que alguien tecleó mal el año de
 * una, y casi siempre es el de la de término, porque la de inicio es la que
 * escogen primero y con calma. En ese caso manda la de inicio.
 *
 * No es un detalle: sin esto, tres prestadores de 2023 y 2024 se colaron al corte
 * de 2026 por un dedazo, cada uno con un solo renglón, y en el padrón parecían
 * gente activa este año.
 */
function anioDelRenglon(f: Fila): { anio: number; sospechoso: boolean } {
  if (f.inicio && f.fin) {
    const dias = Math.abs(f.fin.getTime() - f.inicio.getTime()) / 86_400_000;
    if (dias > DIAS_SEMANA_CREIBLE) {
      return { anio: f.inicio.getUTCFullYear(), sospechoso: true };
    }
  }
  const referencia = (f.fin ?? f.inicio ?? f.marca)!;
  return { anio: referencia.getUTCFullYear(), sospechoso: false };
}

/** El valor que más se repite (y, si empatan, el último). */
function moda(valores: string[]): string {
  const cuenta = new Map<string, number>();
  valores.filter(Boolean).forEach((v) => cuenta.set(v, (cuenta.get(v) ?? 0) + 1));
  let mejor = "";
  let max = 0;
  for (const [v, c] of cuenta) {
    if (c >= max) {
      max = c;
      mejor = v;
    }
  }
  return mejor;
}

/* ── Lectura de la hoja ────────────────────────────────────────────────────── */

type Fila = {
  linea: number;
  nombre: string;
  escuela: string;
  area: string;
  lider: string;
  inicio: Date | null;
  fin: Date | null;
  horasTexto: string;
  actividades: string;
  autorizado: string;
  marca: Date | null;
};

function leeHoja(ruta: string): Fila[] {
  const wb = XLSX.readFile(ruta);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // raw:false devuelve el texto TAL COMO SE VE en la hoja. Es a propósito: las
  // celdas de fecha traen la hora con el huso de quien exportó (medianoche en
  // México = 06:00 UTC), y leer el Date crudo corre el día según dónde corra esto.
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
  return filas.slice(1).map((r, i) => ({
    linea: i + 2,
    nombre: limpia(r[COL.nombre]),
    escuela: limpia(r[COL.escuela]),
    area: limpia(r[COL.area]),
    lider: limpia(r[COL.lider]),
    inicio: parseFecha(limpia(r[COL.inicio])),
    fin: parseFecha(limpia(r[COL.fin])),
    horasTexto: limpia(r[COL.horas]),
    actividades: limpia(r[COL.actividades]),
    autorizado: limpia(r[COL.autorizado]),
    marca: parseFecha(limpia(r[COL.marca])),
  }));
}

/* ── Catálogos ─────────────────────────────────────────────────────────────── */

/**
 * Arma un catálogo (áreas o líderes) juntando lo vigente con lo que solo aparece
 * en filas viejas. Devuelve un mapa de clave normalizada → id, para que
 * "Direcciòn" de 2021 caiga en la misma "Dirección" de hoy.
 */
async function armaCatalogo(
  tabla: "serviceArea" | "serviceLeader",
  vigentes: string[],
  usados: string[],
  escribe: boolean,
): Promise<{ mapa: Map<string, string>; nuevos: string[] }> {
  const porClave = new Map<string, { name: string; active: boolean; order: number }>();
  vigentes.forEach((name, i) => porClave.set(claveDeBusqueda(name), { name, active: true, order: i }));

  // Un catálogo SÍ se puede corregir por parecido, al revés que los nombres de
  // personas: "Malellely Martínez" es un dedazo de "Mallely Martínez" y no un
  // líder nuevo. Aquí lo peor que pasa si se equivoca es que un reporte quede
  // apuntando al área de junto —se cambia con un clic—; allá sería regalarle las
  // horas de alguien a otro.
  const comoVigente = (k: string): string | null => {
    for (const vigente of porClave.keys()) {
      if (k.length >= 8 && distanciaTexto(k, vigente) <= 2) return vigente;
    }
    return null;
  };

  // Lo que se usó en el periodo importado entra ACTIVO: si alguien reportó en
  // esa área este año, el área existe, aunque el menú del formulario ya no la
  // ofrezca. Apagarla de entrada escondería reportes que sí hay que revisar.
  const erratas = new Map<string, string>();
  for (const crudo of usados) {
    const k = claveDeBusqueda(crudo);
    if (!k || k === "0" || porClave.has(k)) continue;
    const vigente = comoVigente(k);
    if (vigente) {
      erratas.set(k, vigente);
      console.log(`  ~ «${crudo}» se lee como «${porClave.get(vigente)!.name}»`);
      continue;
    }
    porClave.set(k, { name: crudo, active: true, order: 900 });
  }

  const mapa = new Map<string, string>();
  for (const [k, fila] of porClave) {
    if (!escribe) {
      mapa.set(k, `dry:${k}`);
      continue;
    }
    const delegado = prisma[tabla] as unknown as {
      upsert(args: unknown): Promise<{ id: string }>;
    };
    const row = await delegado.upsert({
      where: { name: fila.name },
      update: { order: fila.order },
      create: fila,
      select: { id: true },
    });
    mapa.set(k, row.id);
  }
  // Las erratas apuntan a la misma fila que el nombre bueno.
  for (const [errata, vigente] of erratas) {
    const id = mapa.get(vigente);
    if (id) mapa.set(errata, id);
  }
  // Lo que se usó y NO estaba en el menú del formulario, ya sin las erratas: eso
  // es lo que de verdad hay que enseñarle a la coordinación.
  const nuevos = [...porClave.entries()]
    .filter(([, f]) => f.order === 900)
    .map(([, f]) => f.name);
  return { mapa, nuevos };
}

/* ── Importación ───────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const dry = !args.includes("--commit");
  const desdeArg = args[args.indexOf("--desde") + 1];
  const desde = args.includes("--desde") && /^\d{4}$/.test(desdeArg ?? "") ? Number(desdeArg) : 2026;
  const ruta = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--desde");
  if (!ruta) {
    console.error(
      'Falta la ruta del archivo.\n  npm run db:import-servicio-social -- "Registro de horas.xlsx" [--commit]',
    );
    process.exit(1);
  }

  const filas = leeHoja(ruta);
  const problemas: string[] = [];
  // Renglones que SÍ se traen pero con las fechas raras: no se descartan —las
  // horas son de alguien— pero hay que enseñárselos a quien revisa.
  const sospechosos: string[] = [];

  // Filas que no se pueden usar: sin nombre no hay a quién acreditárselas.
  let viejas = 0;
  const utiles = filas.filter((f) => {
    if (!f.nombre) return false;
    if (!f.inicio && !f.fin && !f.marca) {
      problemas.push(`línea ${f.linea}: «${f.nombre}» sin ninguna fecha legible; se omite`);
      return false;
    }
    const { anio, sospechoso } = anioDelRenglon(f);
    if (anio < desde) {
      viejas++;
      return false;
    }
    if (sospechoso) {
      sospechosos.push(
        `línea ${f.linea}: «${f.nombre}» reporta del ${f.inicio!.toISOString().slice(0, 10)}` +
          ` al ${f.fin!.toISOString().slice(0, 10)} — revisa las fechas`,
      );
    }
    return true;
  });
  console.log(
    `Filas en la hoja: ${filas.length} · de ${desde} en adelante: ${utiles.length}` +
      ` · anteriores a ${desde} que NO se traen: ${viejas}`,
  );

  // Las instituciones no salen de la hoja: salen de la lista que lleva la casa.
  // Lo que la gente tecleó se EMPATA contra ella (ver lib/instituciones.ts): en
  // 2026 hay 24 maneras de nombrar cinco escuelas, y guardar el texto tal cual
  // haría imposible el conteo de voluntarios por institución.
  const escuelas = new Map<string, string>();
  for (const [i, inst] of INSTITUCIONES.entries()) {
    if (dry) {
      escuelas.set(inst.name, `dry:${inst.name}`);
      continue;
    }
    const row = await prisma.serviceSchool.upsert({
      where: { name: inst.name },
      update: { order: i, active: true },
      create: { name: inst.name, order: i },
      select: { id: true },
    });
    escuelas.set(inst.name, row.id);
  }
  console.log(`Instituciones en el catálogo: ${escuelas.size}`);

  const catAreas = await armaCatalogo("serviceArea", AREAS_VIGENTES, utiles.map((f) => f.area), !dry);
  const catLideres = await armaCatalogo("serviceLeader", LIDERES_VIGENTES, utiles.map((f) => f.lider), !dry);
  const areas = catAreas.mapa;
  const lideres = catLideres.mapa;
  console.log(
    `Áreas en el catálogo: ${AREAS_VIGENTES.length + catAreas.nuevos.length}` +
      ` · líderes: ${LIDERES_VIGENTES.length + catLideres.nuevos.length}`,
  );

  /* Agrupa por persona. Primero por nombre idéntico y luego, con cuidado, los
     que solo difieren en una errata. */
  const grupos = new Map<string, Fila[]>();
  for (const f of utiles) {
    const k = claveDeBusqueda(f.nombre);
    const existente = grupos.get(k) ?? [];
    existente.push(f);
    grupos.set(k, existente);
  }

  const claves = [...grupos.keys()].sort((a, b) => b.length - a.length);
  const alias = new Map<string, string>();
  for (const k of claves) {
    if (alias.has(k)) continue;
    alias.set(k, k);
    for (const otra of claves) {
      if (alias.has(otra) || !esLaMismaPersona(k, otra)) continue;
      alias.set(otra, k);
      console.log(`  ~ se juntan «${otra}» y «${k}» (misma persona, nombre mal tecleado)`);
    }
  }

  const personas = new Map<string, Fila[]>();
  for (const [k, lista] of grupos) {
    const destino = alias.get(k) ?? k;
    personas.set(destino, [...(personas.get(destino) ?? []), ...lista]);
  }
  console.log(`Prestadores: ${personas.size}`);

  // Quien reportó en los últimos 120 días sigue activo. Para los demás el estado
  // de verdad no está en la hoja: se les deja CONCLUIDO, que es lo más común al
  // dejar de reportar, y la coordinación corrige a quien se dio de baja antes.
  const corte = new Date();
  corte.setUTCDate(corte.getUTCDate() - 120);

  const sinInstitucion = new Set<string>();
  let altas = 0;
  let reportes = 0;
  let repetidos = 0;
  let sinHoras = 0;

  for (const [k, lista] of personas) {
    lista.sort((a, b) => (a.marca?.getTime() ?? 0) - (b.marca?.getTime() ?? 0));
    const nombre = moda(lista.map((f) => f.nombre)) || lista[0].nombre;
    const escuela = moda(lista.map((f) => f.escuela));
    const semanas = lista.map((f) => f.inicio ?? f.fin ?? f.marca!).filter(Boolean);
    const fines = lista.map((f) => f.fin ?? f.inicio ?? f.marca!).filter(Boolean);
    const inicio = semanas.reduce((a, b) => (a < b ? a : b));
    const fin = fines.reduce((a, b) => (a > b ? a : b));

    const institucion = institucionDe(claveDeBusqueda(escuela));
    const schoolId = institucion ? (escuelas.get(institucion) ?? null) : null;
    // Cuando empata, se guarda el nombre del catálogo; cuando no, el texto tal
    // como lo escribió, para que la coordinación vea de dónde venía y lo arregle.
    const escuelaFinal = institucion ?? escuela ?? "—";
    if (!institucion && escuela) sinInstitucion.add(escuela);

    const areaId = areas.get(claveDeBusqueda(moda(lista.map((f) => f.area)))) ?? null;
    const leaderId = lideres.get(claveDeBusqueda(moda(lista.map((f) => f.lider)))) ?? null;

    if (dry) {
      altas++;
      reportes += lista.length;
      sinHoras += lista.filter((f) => parseHorasAMinutos(f.horasTexto) == null).length;
      continue;
    }

    // Se reconoce por `nameKey` —el nombre sin acentos ni mayúsculas— y no por el
    // texto exacto. Importa: el nombre que se guarda es el que MÁS se repite en
    // las filas leídas, así que al reimportar un rango distinto puede salir otra
    // variante del mismo nombre, y emparejando por texto exacto esa persona
    // quedaría duplicada en vez de actualizada.
    const claves = clavesDePrestador(nombre, escuelaFinal);
    const yaEsta = await prisma.volunteer.findFirst({
      where: { OR: [{ nameKey: claves.nameKey }, { name: nombre }] },
      select: { id: true },
    });
    const volunteer = yaEsta
      ? await prisma.volunteer.update({
          where: { id: yaEsta.id },
          data: {
            name: nombre,
            school: escuelaFinal,
            schoolId,
            ...claves,
            areaId,
            leaderId,
          },
          select: { id: true },
        })
      : await prisma.volunteer.create({
          data: {
            name: nombre,
            school: escuelaFinal,
            schoolId,
            ...claves,
            areaId,
            leaderId,
            startDate: inicio,
            endDate: fin,
            status: fin >= corte ? "ACTIVO" : "CONCLUIDO",
          },
          select: { id: true },
        });
    if (!yaEsta) altas++;

    for (const f of lista) {
      const weekStart = f.inicio ?? f.fin ?? f.marca!;
      const weekEnd = f.fin ?? f.inicio ?? f.marca!;
      const minutos = parseHorasAMinutos(f.horasTexto);
      const lectura = leeAutorizacion(f.autorizado);
      if (minutos == null) sinHoras++;

      const repetido = await prisma.serviceLog.findFirst({
        where: {
          volunteerId: volunteer.id,
          weekStart,
          weekEnd,
          activities: f.actividades,
          source: "FORMULARIO",
        },
        select: { id: true },
      });
      if (repetido) {
        repetidos++;
        continue;
      }

      await prisma.serviceLog.create({
        data: {
          volunteerId: volunteer.id,
          areaId: areas.get(claveDeBusqueda(f.area)) ?? null,
          leaderId: lideres.get(claveDeBusqueda(f.lider)) ?? null,
          weekStart,
          weekEnd,
          reportedMinutes: minutos ?? 0,
          // Las horas recortadas ("se autorizan 20") mandan sobre lo reportado.
          approvedMinutes:
            lectura.horasAutorizadas != null ? Math.round(lectura.horasAutorizadas * 60) : null,
          rawHours: minutos == null && f.horasTexto ? f.horasTexto : null,
          activities: f.actividades,
          status: lectura.status,
          decisionNote: lectura.nota,
          decidedAt: lectura.status === "PENDIENTE" ? null : (f.marca ?? weekEnd),
          source: "FORMULARIO",
          createdAt: f.marca ?? weekEnd,
        },
      });
      reportes++;
    }
    void k;
  }

  console.log(
    `\n${dry ? "[SIMULACIÓN — nada se escribió; corre otra vez con --commit] " : ""}Prestadores dados de alta: ${altas}` +
      `\nReportes importados: ${reportes}` +
      (repetidos ? `\nReportes que ya estaban (no se repitieron): ${repetidos}` : "") +
      `\nReportes cuyas horas hay que capturar a mano: ${sinHoras}`,
  );
  // Lo que la coordinación tiene que mirar: el menú del formulario y lo que de
  // verdad se usó no son la misma lista, y ninguna de las dos manda sobre la otra.
  const usadasArea = new Set(utiles.map((f) => claveDeBusqueda(f.area)).filter(Boolean));
  const usadosLider = new Set(utiles.map((f) => claveDeBusqueda(f.lider)).filter(Boolean));
  const usadaVigente = (k: string, vigentes: string[]) =>
    vigentes.some((v) => claveDeBusqueda(v) === k || distanciaTexto(k, claveDeBusqueda(v)) <= 2);
  const reporta = (titulo: string, lista: string[]) => {
    if (!lista.length) return;
    console.log(`\n${titulo}`);
    lista.forEach((v) => console.log("  · " + v));
  };
  reporta(
    `Escuelas que nadie pudo empatar con la lista de instituciones:`,
    [...sinInstitucion],
  );
  reporta(
    `Áreas usadas en ${desde} que NO están en el menú del formulario:`,
    catAreas.nuevos,
  );
  reporta(
    `Áreas del menú del formulario que NADIE usó en ${desde}:`,
    AREAS_VIGENTES.filter((a) => !usadaVigente(claveDeBusqueda(a), [...usadasArea])),
  );
  reporta(
    `Líderes que avalaron en ${desde} y NO están en el menú del formulario:`,
    catLideres.nuevos,
  );
  reporta(
    `Líderes del menú del formulario que NADIE avaló en ${desde}:`,
    LIDERES_VIGENTES.filter((l) => !usadaVigente(claveDeBusqueda(l), [...usadosLider])),
  );

  if (problemas.length) {
    console.log(`\nFilas omitidas (${problemas.length}):`);
    problemas.slice(0, 30).forEach((p) => console.log("  · " + p));
    if (problemas.length > 30) console.log(`  … y ${problemas.length - 30} más`);
  }
  if (sospechosos.length) {
    console.log(`\nSÍ se trajeron, pero con las fechas raras (${sospechosos.length}):`);
    sospechosos.slice(0, 30).forEach((p) => console.log("  · " + p));
    if (sospechosos.length > 30) console.log(`  … y ${sospechosos.length - 30} más`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
