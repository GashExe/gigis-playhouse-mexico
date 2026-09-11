/**
 * Importa la hoja de respuestas del Google Form «Registro de horas "Servicio
 * Social"» (2021 en adelante) a las tablas de servicio social.
 *
 *   npm run db:import-servicio-social -- "<ruta.xlsx>" [--commit]
 *
 * Lo que hace, en orden:
 *   1. Arma el catálogo de áreas y de líderes. Las que el formulario todavía
 *      ofrece quedan activas; las que solo existen en filas viejas quedan
 *      INACTIVAS —no se borran— porque los reportes de entonces las nombran.
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
import { leeAutorizacion, parseHorasAMinutos } from "../lib/servicio";

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

/** Áreas que el formulario ofrece HOY, en su orden. Las demás quedan inactivas. */
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

/** Líderes que el formulario ofrece HOY, en su orden. */
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

/** Clave para comparar texto escrito a mano: sin acentos, minúsculas, sin puntos. */
function clave(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de edición, para reconocer un nombre mal tecleado. */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = temp;
    }
  }
  return fila[b.length];
}

/**
 * ¿Son la misma persona con el nombre mal tecleado? Solo cuando tienen las mismas
 * palabras, el mismo primer nombre y a lo más dos letras de diferencia: así
 * «David Hernpandez Garcilazo» se junta con «David Hernández Garcilazo», pero
 * «David Hernández» —que puede ser otro David— se queda aparte.
 *
 * Se peca de conservador a propósito: juntar a dos personas distintas le regala
 * horas a una y se las quita a la otra, y eso no se ve hasta que alguien reclama
 * su constancia. Lo que quede separado de más se junta después desde la
 * plataforma, que para eso está el botón de fusionar.
 */
function mismaPersona(a: string, b: string): boolean {
  const pa = a.split(" ");
  const pb = b.split(" ");
  if (pa.length !== pb.length || pa.length < 2) return false;
  if (pa[0] !== pb[0]) return false;
  if (a.length < 15) return false;
  const d = distancia(a, b);
  return d > 0 && d <= 2;
}

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
): Promise<Map<string, string>> {
  const porClave = new Map<string, { name: string; active: boolean; order: number }>();
  vigentes.forEach((name, i) => porClave.set(clave(name), { name, active: true, order: i }));

  for (const crudo of usados) {
    const k = clave(crudo);
    if (!k || k === "0" || porClave.has(k)) continue;
    porClave.set(k, { name: crudo, active: false, order: 900 });
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
  return mapa;
}

/* ── Importación ───────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const dry = !args.includes("--commit");
  const ruta = args.find((a) => !a.startsWith("--"));
  if (!ruta) {
    console.error(
      'Falta la ruta del archivo.\n  npm run db:import-servicio-social -- "Registro de horas.xlsx" [--commit]',
    );
    process.exit(1);
  }

  const filas = leeHoja(ruta);
  const problemas: string[] = [];

  // Filas que no se pueden usar: sin nombre no hay a quién acreditárselas.
  const utiles = filas.filter((f) => {
    if (!f.nombre) return false;
    if (!f.inicio && !f.fin && !f.marca) {
      problemas.push(`línea ${f.linea}: «${f.nombre}» sin ninguna fecha legible; se omite`);
      return false;
    }
    return true;
  });
  console.log(`Filas en la hoja: ${filas.length} · con datos: ${utiles.length}`);

  const areas = await armaCatalogo("serviceArea", AREAS_VIGENTES, utiles.map((f) => f.area), !dry);
  const lideres = await armaCatalogo("serviceLeader", LIDERES_VIGENTES, utiles.map((f) => f.lider), !dry);
  console.log(`Áreas en el catálogo: ${areas.size} · líderes: ${lideres.size}`);

  /* Agrupa por persona. Primero por nombre idéntico y luego, con cuidado, los
     que solo difieren en una errata. */
  const grupos = new Map<string, Fila[]>();
  for (const f of utiles) {
    const k = clave(f.nombre);
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
      if (alias.has(otra) || !mismaPersona(k, otra)) continue;
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

    const areaId = areas.get(clave(moda(lista.map((f) => f.area)))) ?? null;
    const leaderId = lideres.get(clave(moda(lista.map((f) => f.lider)))) ?? null;

    if (dry) {
      altas++;
      reportes += lista.length;
      sinHoras += lista.filter((f) => parseHorasAMinutos(f.horasTexto) == null).length;
      continue;
    }

    // Se reconoce por el nombre ya normalizado: correr esto dos veces no duplica.
    const yaEsta = await prisma.volunteer.findFirst({
      where: { name: nombre },
      select: { id: true },
    });
    const volunteer = yaEsta
      ? await prisma.volunteer.update({
          where: { id: yaEsta.id },
          data: { school: escuela || "—", areaId, leaderId },
          select: { id: true },
        })
      : await prisma.volunteer.create({
          data: {
            name: nombre,
            school: escuela || "—",
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
          areaId: areas.get(clave(f.area)) ?? null,
          leaderId: lideres.get(clave(f.lider)) ?? null,
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
  if (problemas.length) {
    console.log(`\nFilas omitidas (${problemas.length}):`);
    problemas.slice(0, 30).forEach((p) => console.log("  · " + p));
    if (problemas.length > 30) console.log(`  … y ${problemas.length - 30} más`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
