import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Siembra las PLANTILLAS de evaluación (Nivel → Bloque → Tema) leyendo los Excel
 * de "Formatos de evaluación GiGi's" para los programas de formato BLOQUES:
 * Matemáticas, Lectura y Prerrequisitos (nivel 1 de Lectura).
 *
 * Uso:
 *   npx tsx prisma/seed-plantillas.ts [--dir=<carpeta>] [--commit]
 *
 * DRY-RUN por defecto: NO escribe. Extrae, imprime la estructura y guarda un
 * reporte en exports/. Solo escribe con --commit.
 *
 * Los CÓDIGOS (1.1, 1.2, a, b…) se generan por POSICIÓN, no se leen del Excel,
 * para evitar erratas (ej. Excel guarda "1.10" como "1.1"). Idempotente: upsert
 * por (nivel, orden) y (bloque, orden), así que re-correrlo no duplica. NO borra
 * bloques/temas: si ya hay calificaciones de alumnos, no las toca.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

const DEFAULT_DIR = path.resolve(
  process.env.HOME ?? "",
  "Documents/GIGIS/Formatos de evaluación GiGi´s",
);

/** Excel → hojas → nivel destino (por `order` del ProgramLevel ya sembrado). */
type Source = {
  program: string;
  file: string;
  sheets: { sheet: string; levelOrder: number }[];
};

const SOURCES: Source[] = [
  {
    program: "Matemáticas",
    file: "Progress_Mate.xlsx",
    sheets: [
      { sheet: "N1", levelOrder: 1 }, // Nivel inicial — Sentido numérico y conteo
      { sheet: "N2", levelOrder: 2 }, // Nivel intermedio — Adición y sustracción
      { sheet: "N3", levelOrder: 3 }, // Nivel avanzado — Multiplicación y división
    ],
  },
  {
    program: "Lectura",
    file: "Progress_Lecto.xlsx",
    sheets: [
      { sheet: "N1 Progreso Anual", levelOrder: 2 }, // Nivel inicial
      { sheet: "N2 Progreso Anual", levelOrder: 3 }, // Nivel intermedio
      { sheet: "N3 Porgreso Anual", levelOrder: 4 }, // Nivel avanzado (typo del Excel)
    ],
  },
  {
    program: "Lectura",
    file: "Formato de evaluación_Prerrequisitos.xlsx",
    sheets: [
      { sheet: "Prerrequisitos Progreso Anual", levelOrder: 1 }, // Prerrequisitos
    ],
  },
];

/** Filas que NO son temas ni bloques aunque caigan dentro de un bloque. */
const SKIP = /^(puntaje total|pasa de nivel|tabla valores|promedio|initial rating|highest rating|total score|copyright|instrucciones|clave del puntaje|progresiones|calificaciones|nombre del|sesión|fecha|registro de progreso|purposeful|ciclo|año|resumen|editado)/i;

const LETTER = /^[a-zñ]$/i;

type Bloque = { name: string; items: string[] };

/** Extrae los bloques y sus temas de una hoja. Columna A = código, B = texto. */
function extractSheet(ws: XLSX.WorkSheet): Bloque[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
  const bloques: Bloque[] = [];
  let current: Bloque | null = null;

  for (const row of rows) {
    const a = row?.[0];
    const b = row?.[1];
    const bText = typeof b === "string" ? b.trim() : "";

    // ¿Encabezado de bloque? Col A es un código tipo "1.2" (número no entero o "X.Y").
    const isBlock =
      (typeof a === "number" && Number.isFinite(a) && !Number.isInteger(a)) ||
      (typeof a === "string" && /^\d+\.\d+/.test(a.trim()));
    if (isBlock && bText && !SKIP.test(bText)) {
      current = { name: bText, items: [] };
      bloques.push(current);
      continue;
    }

    if (!current) continue; // aún no empieza ningún bloque

    // ¿Tema con letra? Col A es una sola letra, texto en B.
    const aStr = typeof a === "string" ? a.trim() : "";
    if (LETTER.test(aStr) && bText && !SKIP.test(bText)) {
      current.items.push(bText);
      continue;
    }

    // ¿Tema sin letra? Col A vacía y B es un objetivo (frase larga).
    const aEmpty = a == null || String(a).trim() === "";
    if (aEmpty && bText.length >= 8 && !SKIP.test(bText)) {
      current.items.push(bText);
    }
  }

  // Descarta bloques que quedaron sin temas (encabezados sueltos).
  return bloques.filter((x) => x.items.length > 0);
}

const codeForItem = (i: number) => {
  // a..z, luego a1, a2… (por si un bloque excede 26 temas)
  return i < 26 ? String.fromCharCode(97 + i) : "a" + (i - 25);
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const dirArg = (args.find((a) => a.startsWith("--dir=")) ?? "").split("=")[1];
  const dir = dirArg ? path.resolve(dirArg) : DEFAULT_DIR;

  console.log(`📂 Carpeta: ${dir}`);
  console.log(commit ? "✍️  Modo COMMIT (se escribirá en la BD)\n" : "🧪 Modo DRY-RUN (no se escribe; usa --commit)\n");

  const report: string[] = [`PLANTILLAS DE EVALUACIÓN — ${new Date().toISOString()}`, ""];
  let totalBlocks = 0;
  let totalItems = 0;

  for (const src of SOURCES) {
    const filePath = path.join(dir, src.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  No se encontró: ${filePath}`);
      report.push(`⚠️ FALTA ARCHIVO: ${src.file}`);
      continue;
    }
    const program = await prisma.program.findFirst({
      where: { name: src.program },
      select: { id: true }, // solo columnas existentes: el DRY-RUN corre sin el push
    });
    if (!program) {
      console.warn(`⚠️  Programa no encontrado: ${src.program} (¿corriste db:seed-programas?)`);
      continue;
    }
    const wb = XLSX.readFile(filePath);

    for (const { sheet, levelOrder } of src.sheets) {
      const wsName = wb.SheetNames.find((n) => n.trim() === sheet.trim());
      const ws = wsName ? wb.Sheets[wsName] : undefined;
      if (!ws) {
        console.warn(`⚠️  Hoja no encontrada: "${sheet}" en ${src.file}`);
        continue;
      }
      const level = await prisma.programLevel.findFirst({
        where: { programId: program.id, order: levelOrder },
        select: { id: true, name: true },
      });
      if (!level) {
        console.warn(`⚠️  Nivel orden ${levelOrder} inexistente en ${src.program} (¿corriste db:seed-niveles?)`);
        continue;
      }

      const bloques = extractSheet(ws);
      report.push(`\n## ${src.program} · ${level.name}  (${bloques.length} bloques)  [${src.file} → ${sheet}]`);
      console.log(`\n📋 ${src.program} · ${level.name}: ${bloques.length} bloques`);

      for (let bi = 0; bi < bloques.length; bi++) {
        const bloque = bloques[bi];
        const blockCode = `${levelOrder}.${bi + 1}`;
        totalBlocks++;
        report.push(`  ▸ ${blockCode}  ${bloque.name}  (${bloque.items.length} temas)`);
        console.log(`   ▸ ${blockCode} ${bloque.name} — ${bloque.items.length} temas`);

        let block;
        if (commit) {
          block = await prisma.evalBlock.upsert({
            where: { levelId_order: { levelId: level.id, order: bi + 1 } },
            update: { code: blockCode, name: bloque.name },
            create: { levelId: level.id, order: bi + 1, code: blockCode, name: bloque.name },
          });
        }

        for (let ii = 0; ii < bloque.items.length; ii++) {
          const text = bloque.items[ii];
          const itemCode = codeForItem(ii);
          totalItems++;
          report.push(`      ${itemCode}) ${text}`);
          if (commit && block) {
            await prisma.evalItem.upsert({
              where: { blockId_order: { blockId: block.id, order: ii + 1 } },
              update: { code: itemCode, text },
              create: { blockId: block.id, order: ii + 1, code: itemCode, text },
            });
          }
        }
      }
    }
  }

  const outDir = path.resolve("exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "seed-plantillas.txt");
  fs.writeFileSync(outFile, report.join("\n"), "utf8");

  console.log(`\n──────────────`);
  console.log(`Bloques: ${totalBlocks}  ·  Temas: ${totalItems}`);
  console.log(`📝 Reporte: ${outFile}`);
  console.log(commit ? "\n✍️  Guardado en la BD." : "\n🧪 DRY-RUN: no se escribió nada. Revisa el reporte y vuelve a correr con --commit.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
