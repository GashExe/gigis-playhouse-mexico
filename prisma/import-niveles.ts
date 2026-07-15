import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Importa el Excel "Titulares de derecho por Niveles" y registra, para cada alumno,
 * su UBICACIÓN DE NIVEL por programa en un ciclo (LevelRecord).
 *
 * Uso:
 *   npm run db:import-niveles -- <ruta.xlsx> [--cycle=ENE_JUN] [--year=2026] [--commit]
 *
 * Por seguridad corre en DRY-RUN por defecto (NO escribe): imprime a quién emparejó,
 * a quién NO, y los casos ambiguos, y guarda un reporte en exports/. Solo escribe en
 * la BD si se pasa --commit. Los nombres del Excel están escritos a mano (acentos y
 * erratas), así que el emparejamiento es tolerante pero conservador: si no está seguro,
 * NO inventa la coincidencia y la reporta para revisión manual.
 *
 * Idempotente: upsert por (alumno, programa, ciclo).
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

// Hoja del Excel -> programa + cuántas columnas (desde la 0) son niveles, en orden.
const HOJAS: { sheet: string; program: string; levelCols: number }[] = [
  { sheet: "Lectura", program: "Lectura", levelCols: 4 },
  { sheet: "Escritura", program: "Escritura", levelCols: 4 },
  { sheet: "Matemáticas", program: "Matemáticas", levelCols: 3 },
];

/**
 * Correcciones manuales verificadas una por una contra la base (nombre del Excel →
 * nombre EXACTO del alumno). Cubren erratas del Excel o de la base que el
 * emparejamiento automático, a propósito conservador, no une solo. NO incluye
 * personas inexistentes ni el alumno duplicado (esos se resuelven aparte).
 */
const OVERRIDES: Record<string, string> = {
  "Erick Yahir Matehuala Trejo": "Erick Yair Matehuala Trejo",
  "Iker Juares Castillo": "Iker Juárez Castillo",
  "Luis Rosendo Alfaro Mares": "Luis Roseldo Alfaro Mares",
  "Oziel Emmanuel Velázquez Martínez": "Oziel Emanuel Velázquez Martínez",
  "Isabella Sagarra Montae": "Angela Isabela Sagarra Montane",
  "Isabella Sagarra Montane": "Angela Isabela Sagarra Montane",
  "Ángela Isabella Sagarra Montane": "Angela Isabela Sagarra Montane",
  "Fátima Sofía Hernpandez Acevedo": "Fátima Sofía Hernández Acevedo",
  "Zev Elias Domenzain González": "Zez Elias Domenzain González",
  "Zev Elías Domenzain González": "Zez Elias Domenzain González",
  "Diego Danjhael Ramirez Valerio": "Diego Danjhael Ramirez Velorio",
  "Liam MateoDe Jesús Pérez": "Liam Mateo De Jesús Pérez",
  "Guillermo Guadalupe  Gónzalez": "Guillermo Guadalupe Gonzáles",
  "Romina Guadalupe Hidalgo Utrera": "Romina Guadalupe Hidalgo Utreta",
  "Ismael Rodríguez Granados": "Ismael Rodríguez Granada Vázquez",
  "Ismael Rodriguez-Granada Vazquez": "Ismael Rodríguez Granada Vázquez",
  // Said Ramirez Manjarez ya coincide por nombre exacto (alta provisional).
};

const STOPWORDS = [
  "total", "titulares", "probatorios", "posibles", "graduados", "nivel",
  "columna", "de derecho",
];

/** Normaliza un nombre: minúsculas, sin acentos, solo letras/espacios, colapsado. */
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

/** ¿La celda parece un nombre de persona (y no un encabezado/conteo)? */
function looksLikeName(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (t.length < 3) return false;
  const n = norm(t);
  if (!n || n.split(" ").length < 2) return false; // al menos nombre + apellido
  if (STOPWORDS.some((w) => n.includes(w))) return false;
  return true;
}

type MatchResult =
  | { kind: "ok"; studentId: string; studentName: string }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: string[] };

function buildMatcher(students: { id: string; firstName: string; lastName: string }[]) {
  const byExact = new Map<string, string[]>(); // norm fullname -> ids
  const list = students.map((s) => ({
    id: s.id,
    full: `${s.firstName} ${s.lastName}`,
    toks: new Set(tokens(`${s.firstName} ${s.lastName}`)),
  }));
  for (const s of list) {
    const key = norm(s.full);
    (byExact.get(key) ?? byExact.set(key, []).get(key)!).push(s.id);
  }
  const nameById = new Map(list.map((s) => [s.id, s.full]));
  const overridesNorm = new Map(Object.entries(OVERRIDES).map(([k, v]) => [norm(k), norm(v)]));

  return function match(raw: string): MatchResult {
    const key = norm(raw);
    // 0) Corrección manual verificada: apunta al alumno exacto.
    const target = overridesNorm.get(key);
    if (target) {
      const ids = byExact.get(target);
      if (ids && ids.length === 1) return { kind: "ok", studentId: ids[0], studentName: nameById.get(ids[0])! };
    }
    // 1) Coincidencia exacta normalizada.
    const exact = byExact.get(key);
    if (exact && exact.length === 1) return { kind: "ok", studentId: exact[0], studentName: nameById.get(exact[0])! };
    if (exact && exact.length > 1) return { kind: "ambiguous", candidates: exact.map((id) => nameById.get(id)!) };

    // 2) Subconjunto de tokens: todos los tokens del Excel están en el alumno.
    const xt = tokens(raw);
    if (xt.length === 0) return { kind: "none" };
    let cands = list.filter((s) => xt.every((t) => s.toks.has(t)));
    if (cands.length === 1) return { kind: "ok", studentId: cands[0].id, studentName: cands[0].full };
    if (cands.length > 1) return { kind: "ambiguous", candidates: cands.map((s) => s.full) };

    // 3) Al revés: todos los tokens del alumno están en el nombre del Excel.
    const xtSet = new Set(xt);
    cands = list.filter((s) => s.toks.size >= 2 && [...s.toks].every((t) => xtSet.has(t)));
    if (cands.length === 1) return { kind: "ok", studentId: cands[0].id, studentName: cands[0].full };
    if (cands.length > 1) return { kind: "ambiguous", candidates: cands.map((s) => s.full) };

    return { kind: "none" };
  };
}

/** Extrae, por hoja, las ubicaciones (nombre, orden de nivel) y la lista de "Posibles Graduados". */
function extractSheet(ws: XLSX.WorkSheet, levelCols: number) {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  const placements: { name: string; order: number }[] = [];
  const graduates: string[] = [];

  // Ubicaciones: columnas 0..levelCols-1, desde la fila 1 (la 0 es encabezado).
  for (let r = 1; r < rows.length; r++) {
    for (let c = 0; c < levelCols; c++) {
      const v = rows[r]?.[c];
      if (looksLikeName(v)) placements.push({ name: (v as string).trim(), order: c + 1 });
    }
  }

  // "Posibles Graduados de Nivel": busca el encabezado y lee la columna hacia abajo.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === "string" && norm(cell).includes("posibles graduados")) {
        for (let rr = r + 1; rr < rows.length; rr++) {
          const v = rows[rr]?.[c];
          if (v == null || String(v).trim() === "") break;
          if (looksLikeName(v)) graduates.push((v as string).trim());
        }
      }
    }
  }
  return { placements, graduates };
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const fileArg = args.find((a) => !a.startsWith("--"));
  const cycleArg = (args.find((a) => a.startsWith("--cycle=")) ?? "").split("=")[1] || "ENE_JUN";
  const yearArg = Number((args.find((a) => a.startsWith("--year=")) ?? "").split("=")[1] || "2026");

  const filePath = fileArg
    ? path.resolve(fileArg)
    : path.resolve(process.env.HOME ?? "", "Downloads/Titulares de derecho por Niveles ENE-JUN 26.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    process.exit(1);
  }
  console.log(`📄 Leyendo: ${filePath}`);
  console.log(commit ? "✍️  Modo COMMIT (se escribirá en la BD)\n" : "🧪 Modo DRY-RUN (no se escribe; usa --commit para guardar)\n");

  const cycle = await prisma.cycle.findUnique({
    where: { season_year: { season: cycleArg as "ENE_JUN" | "JUL_AGO" | "SEP_DIC", year: yearArg } },
  });
  if (!cycle) {
    console.error(`❌ No existe el ciclo ${cycleArg} ${yearArg}. Corre primero: npm run db:seed-niveles`);
    process.exit(1);
  }
  console.log(`🗓️  Ciclo destino: ${cycle.label}\n`);

  const students = await prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } });
  const match = buildMatcher(students);

  const wb = XLSX.readFile(filePath);
  const report: string[] = [`REPORTE IMPORTACIÓN NIVELES — ${cycle.label} — ${new Date().toISOString()}`, ""];
  let okCount = 0;
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const usedInSheet = new Set<string>(); // programId|studentId (evita doble ubicación en la misma hoja)

  for (const { sheet, program, levelCols } of HOJAS) {
    const ws = wb.Sheets[sheet];
    if (!ws) { console.warn(`⚠️  Hoja no encontrada: ${sheet}`); continue; }

    const prog = await prisma.program.findFirst({ where: { name: program } });
    if (!prog) { console.warn(`⚠️  Programa no encontrado: ${program}`); continue; }
    const levels = await prisma.programLevel.findMany({ where: { programId: prog.id }, orderBy: { order: "asc" } });
    const levelByOrder = new Map(levels.map((l) => [l.order, l]));

    const { placements, graduates } = extractSheet(ws, levelCols);
    const gradKeys = new Set(graduates.map(norm));

    report.push(`\n## ${sheet}  (${placements.length} ubicaciones, ${graduates.length} posibles graduados)`);
    console.log(`\n📋 ${sheet}: ${placements.length} nombres en columnas de nivel`);

    for (const p of placements) {
      const res = match(p.name);
      const level = levelByOrder.get(p.order);
      if (!level) { report.push(`  ⚠️ ${p.name} — nivel orden ${p.order} inexistente`); continue; }

      if (res.kind === "ok") {
        const dedupe = `${prog.id}|${res.studentId}`;
        if (usedInSheet.has(dedupe)) continue;
        usedInSheet.add(dedupe);
        const isGrad = gradKeys.has(norm(p.name));
        okCount++;
        report.push(`  ✅ ${p.name}  →  ${res.studentName}  ·  ${level.name}${isGrad ? "  · POSIBLE GRADUADO" : ""}`);
        if (commit) {
          await prisma.levelRecord.upsert({
            where: { studentId_programId_cycleId: { studentId: res.studentId, programId: prog.id, cycleId: cycle.id } },
            update: { programLevelId: level.id, placement: isGrad ? "POSIBLE_GRADUADO" : "REGULAR" },
            create: {
              studentId: res.studentId, programId: prog.id, cycleId: cycle.id,
              programLevelId: level.id, placement: isGrad ? "POSIBLE_GRADUADO" : "REGULAR",
            },
          });
        }
      } else if (res.kind === "ambiguous") {
        ambiguous.push(`${sheet}: "${p.name}" → ${res.candidates.join(" | ")}`);
        report.push(`  ❓ ${p.name}  → AMBIGUO: ${res.candidates.join(" | ")}`);
      } else {
        unmatched.push(`${sheet}: "${p.name}"`);
        report.push(`  ❌ ${p.name}  → SIN COINCIDENCIA`);
      }
    }
  }

  report.push("\n\n### SIN COINCIDENCIA (revisar a mano):");
  report.push(...(unmatched.length ? unmatched.map((u) => "  - " + u) : ["  (ninguno)"]));
  report.push("\n### AMBIGUOS (revisar a mano):");
  report.push(...(ambiguous.length ? ambiguous.map((u) => "  - " + u) : ["  (ninguno)"]));

  const outDir = path.resolve("exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `import-niveles-${cycle.season}-${cycle.year}.txt`);
  fs.writeFileSync(outFile, report.join("\n"), "utf8");

  console.log(`\n──────────────`);
  console.log(`✅ Emparejados: ${okCount}`);
  console.log(`❌ Sin coincidencia: ${unmatched.length}`);
  console.log(`❓ Ambiguos: ${ambiguous.length}`);
  console.log(`📝 Reporte: ${outFile}`);
  console.log(commit ? "\n✍️  Guardado en la BD." : "\n🧪 DRY-RUN: no se escribió nada. Revisa el reporte y vuelve a correr con --commit.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
