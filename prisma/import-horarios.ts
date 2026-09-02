import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { HORARIOS } from "./horarios-sep-dic";

/**
 * Arma el ciclo Sep-Dic 2026: fechas, qué programas se ofrecen, el horario de cada
 * uno y las listas de participantes que vinieron en los formatos de las especialistas.
 *
 * Uso:
 *   npm run db:import-horarios -- [--commit] [--activar] [--sin-listas]
 *
 * Igual que el importador de niveles: DRY-RUN por defecto. Imprime todo lo que haría
 * y guarda el reporte en exports/; solo escribe con --commit. `--activar` además pone
 * el ciclo como vigente (apagando el anterior). `--sin-listas` se salta las
 * inscripciones y deja solo el horario.
 *
 * El emparejamiento de nombres es el mismo criterio conservador de import-niveles.ts:
 * si no está seguro NO inventa la coincidencia, la reporta para revisión.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

const SEASON = "SEP_DIC" as const;
const YEAR = 2026;
// Ventana del ciclo. Sep-Dic corre de inicio de septiembre al ultimo viernes antes
// de la posada; si la direccion maneja otras fechas se cambian desde el panel.
const START = new Date("2026-09-01T00:00:00Z");
const END = new Date("2026-12-18T00:00:00Z");

const DOCS = path.resolve(
  process.env.HOME ?? "",
  "Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents",
);

/** Una columna de un formato: de donde se leen nombres y a que programa van. */
type Fuente = {
  archivo: string;
  hoja: string;
  /** Etiqueta legible para el reporte. */
  bloque: string;
  /** Columna de nombres (letra) y rango de filas, inclusive. */
  col: string;
  desde: number;
  hasta: number;
  /** Programa por omision de esa columna. */
  programa: string;
};

const TF = "BC1728B5-3134-4355-9D57-E49B124B57E3/Horarios T. Física_DianaSantos.xlsx";
const SEN = "850EF55F-337B-47A1-B782-03FD8A823A50/Horarios Sensorial_DianaSantos.xlsx";
const ORO = "C5184C98-A302-4E7B-8D8C-2D765486C918/Horario Orofacial_RosaBecerra (2).xlsx";
const LEN = "5A9AAE84-6B25-47F2-9328-65F66519C0CE/Horario Lenguaje_Qro (1).xlsx";

const LENG = "Lenguaje individual o en pareja";

const FUENTES: Fuente[] = [
  // Terapia fisica / gateo / brinco: el programa real va anotado por persona.
  { archivo: TF, hoja: "T.F._SEP-DIC_2025 (2)", bloque: "T. Fisica - martes PM", col: "C", desde: 4, hasta: 10, programa: "Terapia física" },
  { archivo: TF, hoja: "T.F._SEP-DIC_2025 (2)", bloque: "T. Fisica - jueves AM", col: "G", desde: 4, hasta: 9, programa: "Terapia física" },
  // Sensorial
  { archivo: SEN, hoja: "Hoja1 (2)", bloque: "Sensorial - miercoles AM", col: "C", desde: 4, hasta: 10, programa: "Sensorial" },
  { archivo: SEN, hoja: "Hoja1 (2)", bloque: "Sensorial - jueves PM", col: "G", desde: 4, hasta: 7, programa: "Sensorial" },
  { archivo: SEN, hoja: "Hoja1 (2)", bloque: "Sensorial - martes PM", col: "C", desde: 16, hasta: 17, programa: "Sensorial" },
  { archivo: SEN, hoja: "Hoja1 (2)", bloque: "Sensorial - jueves AM", col: "G", desde: 16, hasta: 18, programa: "Sensorial" },
  // Orofacial
  { archivo: ORO, hoja: "Hoja1", bloque: "Orofacial - miercoles", col: "C", desde: 4, hasta: 12, programa: "Terapia orofacial" },
  { archivo: ORO, hoja: "Hoja1", bloque: "Orofacial - jueves quincenal", col: "F", desde: 4, hasta: 12, programa: "Terapia orofacial" },
  { archivo: ORO, hoja: "Hoja1", bloque: "Orofacial - sabado quincenal", col: "I", desde: 4, hasta: 12, programa: "Terapia orofacial" },
  // Lenguaje: una columna por dia (jueves ocupa tres: Ceci, Nadia y Regina).
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - lunes", col: "B", desde: 3, hasta: 21, programa: LENG },
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - martes", col: "C", desde: 3, hasta: 21, programa: LENG },
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - miercoles", col: "D", desde: 3, hasta: 21, programa: LENG },
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - jueves (Ceci)", col: "E", desde: 3, hasta: 21, programa: LENG },
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - jueves (Nadia)", col: "F", desde: 3, hasta: 21, programa: LENG },
  { archivo: LEN, hoja: "Hoja2", bloque: "Lenguaje - jueves (Regina)", col: "G", desde: 3, hasta: 21, programa: LENG },
];

/**
 * Aclaraciones que traen los formatos entre parentesis o en el propio texto: dicen
 * a que programa va ESA persona, no toda la columna.
 */
const POR_ANOTACION: { patron: RegExp; programa: string; celda?: boolean }[] = [
  { patron: /gateo/i, programa: "Gateo y caminata" },
  { patron: /brinco/i, programa: "Brinco, salto y corro" },
  // "LMYG_ 1" encabeza la celda entera: ese bloque completo es de música y gestos,
  // a diferencia de los paréntesis de terapia física, que son persona por persona.
  { patron: /lmyg/i, programa: "Lenguaje, música y gestos", celda: true },
];

/**
 * Quién da el bloque. Sus nombres encabezan la celda y hay que quitarlos para no
 * confundirlos con un participante: se descarta solo el nombre COMPLETO al inicio,
 * porque hay participantes que comparten el nombre de pila con una terapeuta
 * (Diana Zamora, Regina Miranda, María de la Luz Becerra).
 */
const TERAPEUTAS = [
  "Cata Palacio", "Ceci Morvillo", "Gaby Aristoy", "Nadia Díaz",
  "Regina Cavazos", "Diana Santos", "Rosy Becerra",
];

/**
 * Nombre del formato -> nombre EXACTO en la plataforma. Verificados uno por uno
 * contra la base: son erratas de un lado o del otro (la base trae varias) que el
 * emparejamiento, a propósito conservador, no une solo.
 */
const OVERRIDES: Record<string, string> = {
  "Romina Hidalgo": "Romina Gudalupe Hidakgo Utera",
  "Romina Hidalgo Utrera": "Romina Gudalupe Hidakgo Utera",
  "Romina Guadalupe Hidalgo": "Romina Gudalupe Hidakgo Utera",
  "Cristian Castillo": "Cristian Castilllo Jiménez",
  "Iktan Jadir López": "Ikthan Jadir López Espindola",
  "Allison Sofia Ibarra": "Alisson Sofía Ibarra Aguilar",
  "Ailani Antonella Balderas": "Aylani Antonella Balderas Balderas",
  "Said Ramíez": "Said Ramírez Manjarrez",
  "Luis Matias Martínez": "Luis Mattias Martínez Sánchez",
  "Oziel Emanuel Velázquez Martínez": "Oziel Emmanuel Velázquez Martínez",
  "Yuritzy Abigail Aguas": "Yuritzy Abigaul Aguas Ávila",
  "Zaira Guadalupe Olvera": "Zaira Guadaluoe Olvera Hernández",
  "Jonatha Uriel López": "Jonathan Uriel Lóepz Estevez",
  // El formato de orofacial le pone "López"; en la base es "Torres". Mismo nombre
  // de pila y mismo segundo apellido, y no hay otro Killian. Confirmar con Rosy.
  "Killian Abdias López Estrada": "Killian Abdias Torres Estrada",
  // Regina lo anota "Emiliano"; en la base y en los demás formatos es "Emilio
  // Adael". "Adael" no se repite en ningún otro participante. Confirmar.
  "Emiliano Adael": "Emilio Adael Vallejo Ramos",
};

/**
 * Celdas donde faltó la coma entre dos participantes y quedan pegados. Se parten
 * a mano en vez de adivinar dónde termina un nombre y empieza el otro.
 */
const SEPARAR: Record<string, string[]> = {
  "Ollin Jaramillo Maureen Cora": ["Ollin Jaramillo", "Maureen Cora"],
};

/** Palabras que en estos formatos NO son un participante. */
const RUIDO = [
  "administrativo", "nota", "horario", "paciente", "grupo", "online",
  "terapia fisica adultos", "terapia física adultos", "terapía física adultos",
  "sensorial", "vi grupo", "nuevo ingreso", "gigifit",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

/**
 * Parte una celda del formato en nombres sueltos, quedandose con la anotacion de
 * programa que le corresponda a cada uno.
 *
 * Las celdas vienen como las escribio la terapeuta: primero su propio nombre, luego
 * la hora y luego a quien atiende, a veces varios separados por comas y con una
 * aclaracion entre parentesis ("Saulo Josue Zetina (brinco, salto y corro)"). La
 * coma de adentro del parentesis no separa personas, asi que se protege primero.
 */
function partirCelda(raw: string, programaBase: string): { nombre: string; programa: string }[] {
  // Primera linea = la terapeuta que da el bloque (solo en el formato de lenguaje).
  const lineas = raw.split("\n");
  const cuerpo = (lineas.length > 1 ? lineas.slice(1) : lineas).join(" ");

  // Etiqueta que encabeza la celda entera (hoy solo "LMYG_ 1 / 2").
  const deCelda = POR_ANOTACION.find((a) => a.celda && a.patron.test(raw));

  const COMA = "\u0000"; // marca temporal para las comas de adentro de un parentesis
  const protegido = cuerpo.replace(/\(([^)]*)\)/g, (_m, dentro: string) =>
    "(" + dentro.replace(/,/g, COMA) + ")",
  );
  // La hora tambien separa participantes ("... Sofia Rivera 4:30 - 5:00 Leandro
  // Olvera"), asi que se convierte en corte en vez de borrarse.
  const conCortes = protegido.replace(/\d{1,2}\s*[:;]\s*\d{2}/g, ",");

  const salida: { nombre: string; programa: string }[] = [];
  for (const bruto of conCortes.split(/[,;]/)) {
    const trozo = bruto.split(COMA).join(",");
    // Anotacion de programa: puede venir entre parentesis o suelta en el texto.
    const anotacion = POR_ANOTACION.find((a) => !a.celda && a.patron.test(trozo)) ?? deCelda;
    const limpio = quitarTerapeuta(
      trozo
        .replace(/\([^)]*\)/g, " ")
        .replace(/LMYG[^A-Za-zÁÉÍÓÚÑáéíóúñ]*\d*/gi, " ")
        .replace(/VI\s+Grupo\s+\S*/gi, " ")
        .replace(/[-–—]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const n = norm(limpio);
    if (!n || n.split(" ").length < 2) continue; // hace falta nombre y apellido
    if (RUIDO.some((r) => n.includes(norm(r)))) continue;
    if (TERAPEUTAS.some((t) => norm(t) === n)) continue; // la terapeuta sola en su celda
    for (const nombre of SEPARAR[limpio] ?? [limpio]) {
      salida.push({ nombre, programa: anotacion?.programa ?? programaBase });
    }
  }
  return salida;
}

/** Quita el nombre COMPLETO de una terapeuta cuando encabeza el trozo. */
function quitarTerapeuta(s: string): string {
  const palabras = s.split(" ").filter(Boolean);
  for (const t of TERAPEUTAS) {
    const tt = tokens(t);
    if (palabras.length > tt.length && tt.every((x, i) => norm(palabras[i]) === x)) {
      return palabras.slice(tt.length).join(" ");
    }
  }
  return s;
}

type MatchResult =
  | { kind: "ok"; studentId: string; studentName: string }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: string[] };

/** Mismo emparejador conservador de import-niveles.ts. */
function buildMatcher(students: { id: string; firstName: string; lastName: string }[]) {
  const list = students.map((s) => ({
    id: s.id,
    full: `${s.firstName} ${s.lastName}`,
    toks: new Set(tokens(`${s.firstName} ${s.lastName}`)),
  }));
  const byExact = new Map<string, string[]>();
  for (const s of list) {
    const key = norm(s.full);
    const arr = byExact.get(key);
    if (arr) arr.push(s.id);
    else byExact.set(key, [s.id]);
  }
  const nameById = new Map(list.map((s) => [s.id, s.full]));
  const overrides = new Map(Object.entries(OVERRIDES).map(([k, v]) => [norm(k), norm(v)]));

  return function match(raw: string): MatchResult {
    const key = overrides.get(norm(raw)) ?? norm(raw);
    const exact = byExact.get(key);
    if (exact?.length === 1) return { kind: "ok", studentId: exact[0], studentName: nameById.get(exact[0])! };
    if (exact && exact.length > 1) return { kind: "ambiguous", candidates: exact.map((id) => nameById.get(id)!) };

    const xt = key.split(" ").filter(Boolean);
    if (xt.length === 0) return { kind: "none" };
    let cands = list.filter((s) => xt.every((t) => s.toks.has(t)));
    if (cands.length === 1) return { kind: "ok", studentId: cands[0].id, studentName: cands[0].full };
    if (cands.length > 1) return { kind: "ambiguous", candidates: cands.map((s) => s.full) };

    const xtSet = new Set(xt);
    cands = list.filter((s) => s.toks.size >= 2 && [...s.toks].every((t) => xtSet.has(t)));
    if (cands.length === 1) return { kind: "ok", studentId: cands[0].id, studentName: cands[0].full };
    if (cands.length > 1) return { kind: "ambiguous", candidates: cands.map((s) => s.full) };

    return { kind: "none" };
  };
}

const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const activar = args.includes("--activar");
  const sinListas = args.includes("--sin-listas");

  console.log(commit ? "MODO COMMIT (se escribe en la BD)\n" : "MODO DRY-RUN (no se escribe; usa --commit)\n");
  const report: string[] = [`CICLO SEP-DIC ${YEAR} - ${new Date().toISOString()}`, ""];

  const cycle = await prisma.cycle.findUnique({ where: { season_year: { season: SEASON, year: YEAR } } });
  if (!cycle) throw new Error(`No existe el ciclo ${SEASON} ${YEAR}.`);
  console.log(`Ciclo: ${cycle.label} (${cycle.id})`);
  console.log(`  Fechas: ${START.toISOString().slice(0, 10)} -> ${END.toISOString().slice(0, 10)}`);
  console.log(`  Vigente: ${activar ? "SI (se apaga el anterior)" : "se deja como esta"}\n`);

  // Programas del ciclo + horario
  const progIds = new Map<string, string>();
  for (const h of HORARIOS) {
    const p = await prisma.program.findFirst({ where: { name: h.programa }, select: { id: true } });
    if (!p) { console.warn(`  ! Programa no encontrado: ${h.programa}`); continue; }
    progIds.set(h.programa, p.id);
  }

  console.log("HORARIO");
  report.push("## Horario");
  for (const h of HORARIOS) {
    const id = progIds.get(h.programa);
    if (!id) continue;
    const previos = await prisma.scheduleSlot.count({ where: { programId: id } });
    const linea = h.slots
      .map((s) => `${DIAS[s.d]} ${s.from}-${s.to}${s.nota ? ` (${s.nota})` : ""}`)
      .join(" | ");
    console.log(`  ${h.programa}: ${h.slots.length} bloques${previos ? ` (reemplaza ${previos})` : ""}`);
    console.log(`     ${linea}`);
    report.push(`- **${h.programa}** - ${linea}`);

    if (commit) {
      await prisma.$transaction([
        prisma.scheduleSlot.deleteMany({ where: { programId: id } }),
        prisma.scheduleSlot.createMany({
          data: h.slots.map((s) => ({ programId: id, weekday: s.d, startTime: s.from, endTime: s.to })),
        }),
        prisma.program.update({ where: { id }, data: { schedule: h.resumen } }),
      ]);
    }
  }

  if (commit) {
    await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        startDate: START,
        endDate: END,
        programs: { set: [...progIds.values()].map((id) => ({ id })) },
      },
    });
    if (activar) {
      await prisma.cycle.updateMany({ where: { id: { not: cycle.id } }, data: { active: false } });
      await prisma.cycle.update({ where: { id: cycle.id }, data: { active: true } });
    }
  }
  console.log(`\n  Oferta del ciclo: ${progIds.size} programas.\n`);

  if (sinListas) {
    fs.writeFileSync(path.resolve("exports", `ciclo-SEP_DIC-${YEAR}.txt`), report.join("\n"));
    await prisma.$disconnect();
    return;
  }

  // Listas de participantes de los formatos
  const students = await prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } });
  const match = buildMatcher(students);

  const inscribir = new Map<string, Set<string>>(); // programa -> alumnos
  const sinEmparejar = new Map<string, string[]>(); // nombre crudo -> bloques donde salio
  const ambiguos = new Map<string, string[]>();

  console.log("LISTAS DE PARTICIPANTES");
  report.push("", "## Listas de participantes");
  for (const f of FUENTES) {
    const file = path.join(DOCS, f.archivo);
    if (!fs.existsSync(file)) { console.warn(`  ! Falta el archivo: ${f.archivo}`); continue; }
    const ws = XLSX.readFile(file).Sheets[f.hoja];
    if (!ws) { console.warn(`  ! Falta la hoja "${f.hoja}" en ${f.archivo}`); continue; }

    let ok = 0;
    for (let r = f.desde; r <= f.hasta; r++) {
      const cell = ws[`${f.col}${r}`];
      const raw = cell?.v == null ? "" : String(cell.v);
      if (!raw.trim()) continue;
      for (const { nombre, programa } of partirCelda(raw, f.programa)) {
        const res = match(nombre);
        if (res.kind === "ok") {
          const set = inscribir.get(programa) ?? new Set<string>();
          set.add(res.studentId);
          inscribir.set(programa, set);
          ok++;
        } else if (res.kind === "ambiguous") {
          ambiguos.set(nombre, [...(ambiguos.get(nombre) ?? []), `${f.bloque} -> ${res.candidates.join(" / ")}`]);
        } else {
          sinEmparejar.set(nombre, [...(sinEmparejar.get(nombre) ?? []), f.bloque]);
        }
      }
    }
    console.log(`  ${f.bloque}: ${ok} emparejados`);
    report.push(`- ${f.bloque}: ${ok} emparejados`);
  }

  console.log("\nINSCRIPCIONES A CREAR");
  report.push("", "## Inscripciones");
  let nuevas = 0;
  let yaEstaban = 0;
  for (const [programa, ids] of inscribir) {
    const programId = progIds.get(programa);
    if (!programId) { console.warn(`  ! Sin programa en la plataforma: ${programa}`); continue; }
    let creadas = 0;
    for (const studentId of ids) {
      const ya = await prisma.enrollment.findUnique({
        where: { studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id } },
        select: { id: true },
      });
      if (ya) { yaEstaban++; continue; }
      creadas++;
      if (commit) {
        await prisma.enrollment.create({ data: { studentId, programId, cycleId: cycle.id, startDate: START } });
        await ubicarNivel(studentId, programId, cycle.id);
      }
    }
    nuevas += creadas;
    console.log(`  ${programa}: ${ids.size} en lista, ${creadas} nuevas`);
    report.push(`- **${programa}**: ${ids.size} en lista, ${creadas} nuevas`);
  }
  console.log(`  Total: ${nuevas} inscripciones nuevas (${yaEstaban} ya existian).`);

  if (ambiguos.size) {
    console.log(`\nAMBIGUOS (${ambiguos.size}) - no se inscriben, revisar a mano`);
    report.push("", "## Ambiguos (no se inscriben)");
    for (const [n, d] of ambiguos) { console.log(`  ${n} -- ${d.join("; ")}`); report.push(`- ${n} - ${d.join("; ")}`); }
  }
  if (sinEmparejar.size) {
    console.log(`\nSIN EMPAREJAR (${sinEmparejar.size}) - no estan en la plataforma o el nombre no coincide`);
    report.push("", "## Sin emparejar");
    for (const [n, d] of sinEmparejar) { console.log(`  ${n} -- ${d.join(", ")}`); report.push(`- ${n} - ${d.join(", ")}`); }
  }

  const out = path.resolve("exports", `ciclo-SEP_DIC-${YEAR}.txt`);
  fs.writeFileSync(out, report.join("\n"));
  console.log(`\nReporte: ${out}`);
  await prisma.$disconnect();
}

/**
 * Misma regla que `ensurePlacementOnEnroll` (lib/placement.ts), reescrita aqui
 * porque aquella es "server-only" y no se puede importar desde un script.
 */
async function ubicarNivel(studentId: string, programId: string, cycleId: string) {
  const ya = await prisma.levelRecord.findFirst({ where: { studentId, programId, cycleId } });
  if (ya) return;
  const niveles = await prisma.programLevel.findMany({ where: { programId }, orderBy: { order: "asc" } });
  if (niveles.length === 0) return;

  const historial = await prisma.levelRecord.findMany({
    where: { studentId, programId },
    include: { cycle: true },
  });
  const rank = (c: { year: number; season: string }) =>
    c.year * 10 + (c.season === "ENE_JUN" ? 1 : c.season === "JUL_AGO" ? 2 : 3);
  const ultimo = historial.sort((a, b) => rank(b.cycle) - rank(a.cycle))[0];

  await prisma.levelRecord.create({
    data: {
      studentId,
      programId,
      cycleId,
      programLevelId: ultimo ? ultimo.programLevelId : niveles[0].id,
      note: ultimo
        ? "Nivel recuperado de su historial al inscribirse."
        : "Ubicado en el nivel inicial al inscribirse (sin historial previo).",
    },
  });
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
