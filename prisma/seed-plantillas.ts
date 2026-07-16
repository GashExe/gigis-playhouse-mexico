import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Siembra las PLANTILLAS de evaluación (Nivel → Bloque → Tema) leyendo los formatos
 * de "Formatos de evaluación GiGi's". Cubre los 15 programas.
 *
 * Los formatos en papel no comparten estructura, así que cada fuente declara la
 * suya (campo `format`). Ver EXTRACTORES abajo.
 *
 * ESCALA: la plataforma califica 1–4 y ese es el máximo, sin excepciones (regla de
 * la directora). Dos formatos en papel no venían en 1–4 y se traducen al importar:
 *   • Lenguaje traía 1–5 por % de precisión. Se fusionan "Progresando" (26–45%) y
 *     "Avanzando" (46–79%) en un solo escalón 3. Así el 4 sigue siendo "meta
 *     cumplida (80%+)" como en el resto, y la regla de corte del formato ("menos
 *     de 3 → no continuar") sigue cayendo en el mismo punto (hasta 25%).
 *   • Orofacial trae 3 escalones: No presente=1, En proceso=2, Presente=4. El 3
 *     queda sin usar; no se pierde información.
 * La plantilla NO guarda la escala (no hay dónde: ItemScore.score es 1–4 global),
 * así que esto es criterio de lectura del papel, no configuración.
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

/**
 * EXTRACTORES — cómo está armado cada formato en papel:
 *
 *  progress  Col A = código, col B = texto. Bloque = código "1.2" (o entero, ver
 *            `intBlocks`); tema = letra. Es el Progress tracker de Gigi's.
 *  planos    Col A = lista corrida de objetivos, sin agrupar. Va a un bloque único.
 *  bloques   Col A mezcla encabezados de bloque y temas, sin marcador fiable en el
 *            valor. Los nombres de bloque se declaran a mano en `blockNames`.
 *  areas     Col B = texto, col C = nombre del área (Receptivo/Expresivo…).
 *  filas     Col A = nombre del bloque (solo en su primera fila), col B = tema.
 *  literal   Sin Excel: la estructura viene transcrita en `literal`. Se usa para
 *            los tres formatos que están en Word.
 */
type Format = "progress" | "planos" | "bloques" | "areas" | "filas" | "literal";

type Bloque = { name: string; items: string[] };

type Source = {
  program: string;
  levelOrder: number;
  format: Format;
  file?: string;
  sheet?: string;
  /** progress: los bloques se numeran con enteros (1,2,3) y no con "1.2". */
  intBlocks?: boolean;
  /** bloques: nombres EXACTOS de los encabezados, en orden de aparición. */
  blockNames?: string[];
  /** planos: nombre del bloque único. */
  blockName?: string;
  /** literal: estructura transcrita de un .docx. */
  literal?: Bloque[];
  /** De dónde viene, para el reporte. */
  note?: string;
};

/**
 * Los .docx no se leen: no hay librería en el proyecto y añadir una por 3 archivos
 * estáticos no se justifica. Van transcritos. ⚠️ Si editan el Word, hay que
 * actualizar esto a mano.
 */
const OROFACIAL: Bloque[] = [
  { name: "Respiración", items: [
    "Tipo torácico costo abdominal",
    "Ritmo adecuado en su respiración",
    "Modo nasal",
    "Respiración sin protrusión lingual",
    "Coordinación entre respiración y masticación",
    "Coordinación entre respiración y deglución",
  ]},
  { name: "Tono muscular", items: [
    "Tono muscular adecuado en brazos",
    "Tono muscular adecuado en m. occipito-frontales",
    "Tono muscular adecuado en m. temporo-parietales",
    "Tono muscular adecuado en m. maseteros",
    "Tono muscular adecuado en m. buccinadores",
    "Tono muscular adecuado en m. orbicular de los ojos",
    "Tono muscular adecuado en m. orbicular de la boca",
    "Tono muscular adecuado en m. mentoniano",
    "Tono muscular adecuado en m. depresor de labio",
    "Tono muscular adecuado en m. elevador de labios",
    "Contracción de labio superior por respiración oral",
    "Tono muscular adecuado en lengua",
    "Tono muscular adecuado en labios",
    "Correcta labialización y deslabialización",
    "Adecuada estabilidad mandibular",
    "Ausencia de bruxismo",
  ]},
  { name: "Cavidad oral", items: [
    "Dentición acorde a su edad",
    "Adecuada elevación de velo de paladar",
    "Lengua: posición adecuada al abrir la boca",
    "Lengua: ápice formado",
    "Lengua: surco lingual",
  ]},
  { name: "Sensibilidad y propiocepción", items: [
    "Sensibilidad adecuada en brazos",
    "Sensibilidad adecuada en cara",
    "Sensibilidad adecuada en cavidad oral",
    "Propiocepción adecuada en cavidad oral",
    "Ingiere todo tipo de alimentos",
  ]},
  { name: "Alimentación", items: [
    "Ingiere papillas muy molidas",
    "No protruye la lengua al recibir el alimento",
    "Ingiere papillas con pequeños trocitos",
    "Ingiere alimentos de baja resistencia en trozos",
    "Ingiere alimentos de alta resistencia",
    "Presenta una deglución completa",
    "Presenta una deglución no atípica",
    "Presenta un buen cierre de comisuras al usar cuchara",
    "Tiene una participación de ambos labios al usar cuchara",
    "Toma líquidos de un vaso o taza entrenadora con pipeta suave sin pérdida de líquido",
    "Toma líquidos de un vaso o taza entrenadora con pipeta dura sin pérdida de líquido",
  ]},
];

const VIDA_INDEPENDIENTE: Bloque[] = [
  { name: "Matemáticas", items: [
    "Clasificación de monedas y billetes.",
    "Conteo de caja chica semanal",
    "Elaboración de suma para obtener un total.",
    "Elaboración y comprensión de la resta.",
    "Conteo de ganancia mensual de producción.",
  ]},
  { name: "Lectura", items: [
    "Reforzar la atención y expresión verbal",
    "Desarrollar la comprensión lectora y fomentar la reflexión de la lectura",
    "Fortalecer la comprensión auditiva y expresión de ideas",
    "Identificar personaje principal de la historia",
    "Cierre de la rutina del programa de lectura",
  ]},
  { name: "Lenguaje", items: [
    "Describir características físicas en sí mismos y en otras personas, usando adjetivos calificativos (color, tamaño, dimensiones), con o sin apoyo gráfico.",
    "Usar cualidades para describir la personalidad de sus familiares y amigos, con o sin apoyo gráfico.",
    "Identificar las diferentes emociones de las personas según situaciones de la vida cotidiana, con o sin apoyo gráfico.",
    "Describir lugares de manera estática, usando en las estructuras gramaticales: artículos, sustantivos, verbos y adjetivos, con o sin apoyo gráfico.",
    "Describir lugares de manera dinámica, usando en las estructuras gramaticales el verbo como prioridad, con o sin apoyo gráfico.",
  ]},
  { name: "Habilidades sociales", items: [
    "Desarrollar la habilidad de controlar sus emociones",
    "Aprender a tolerar la frustración en tiempos difíciles",
    "Ubicar situaciones de abuso (físico, psicológico, social)",
    "Trabajar en equipo con diferentes roles y ritmos de trabajo",
    "Hablar en público compartiendo sus vivencias y experiencias personales.",
  ]},
  { name: "Vida práctica", items: [
    "Cuadrilla de trabajo con poca supervisión.",
    "Elaboración de recetas sencillas, siguiendo indicaciones.",
    "Cuidado de su presentación personal",
    "Autonomía para las actividades diarias como calentar o preparar su lunch",
    "Protocolo para usar cubiertos y cuidar limpieza de su aspecto",
  ]},
  { name: "Gigi Fit", items: [
    "Ejercicios de peso corporal",
    "Entrenamientos de resistencia",
    "Actividades de equilibrio",
    "Entrenamientos en circuito",
    "Ejercicio de estiramientos",
  ]},
  { name: "Baile", items: [
    "Acondicionamiento físico.",
    "Movilidad.",
    "Coordinación.",
    "Conocimiento y manejo del ritmo.",
    "Memorización y socialización a través de la música.",
  ]},
  { name: "Nutrición", items: [
    "Interpretar información nutrimental",
    "Comprensión de micro y macronutrientes",
    "Vida sana a largo plazo",
    "Balance energético",
    "Plato equilibrado",
  ]},
];

const PREESCRITURA: Bloque[] = [
  { name: "Objetivos de preescritura", items: [
    "Puedo mantener una buena postura y control de mis movimientos al estar en las actividades de escritura.",
    "Sujeto el instrumento de escritura correctamente (entre el pulgar y los dedos).",
    "Realizo trazos o garabatos siguiendo con la mirada los movimientos de mi mano.",
    "Realizo con destreza actividades grafo-motrices.",
    "Puedo copiar de un molde diversas líneas y grafismos.",
  ]},
];

/**
 * Gateo y caminata: el formato es una lista corrida de 15 hitos, pero el programa
 * tiene 6 niveles y los hitos SON esa progresión. Van repartidos, un bloque único
 * por nivel, respetando la redacción exacta del Excel.
 *
 * ⚠️ El reparto es una PROPUESTA, pendiente de que lo confirme el terapeuta que
 * firma el formato: el Excel lista los hitos en un orden que no calza con el de los
 * niveles, así que la asignación es criterio clínico, no una lectura del archivo.
 */
const GATEO: Record<number, Bloque> = {
  1: { name: "Control cefálico total", items: ["Control cefálico"] },
  2: { name: "Cambio de decúbito", items: ["Patrón de arrastre"] },
  3: { name: "Sentado por sí solo sin caer", items: ["Sentado sin apoyo"] },
  4: { name: "Gateo", items: [
    "Cambio de posición, 4 puntos a hincado",
    "Patrón de gateo independiente",
    "Gateo en diferentes niveles (escaleras, colchón, etc.)",
    "Sube escaleras gateando",
  ]},
  5: { name: "Bipedestación", items: [
    "Transición gateo a bipedestación",
    "Se pone de pie momentaneamente sin apoyarse en nada",
  ]},
  6: { name: "Marcha", items: [
    "Comienza el patrón de marcha",
    "Sube escaleras apoyándose en ambas manos",
    "Camina solo (cae frecuentemente)",
    "Camina solo (cae rara vez)",
    "Camina hacia atrás",
    "Corre (con rigidez)",
  ]},
};

const SOURCES: Source[] = [
  // ---- BLOQUES: Progress tracker (código en col A, texto en col B) ----
  { program: "Matemáticas", file: "Progress_Mate.xlsx", sheet: "N1", levelOrder: 1, format: "progress" },
  { program: "Matemáticas", file: "Progress_Mate.xlsx", sheet: "N2", levelOrder: 2, format: "progress" },
  { program: "Matemáticas", file: "Progress_Mate.xlsx", sheet: "N3", levelOrder: 3, format: "progress" },
  { program: "Lectura", file: "Progress_Lecto.xlsx", sheet: "N1 Progreso Anual", levelOrder: 2, format: "progress" },
  { program: "Lectura", file: "Progress_Lecto.xlsx", sheet: "N2 Progreso Anual", levelOrder: 3, format: "progress" },
  { program: "Lectura", file: "Progress_Lecto.xlsx", sheet: "N3 Porgreso Anual", levelOrder: 4, format: "progress" }, // typo del Excel
  { program: "Lectura", file: "Formato de evaluación_Prerrequisitos.xlsx", sheet: "Prerrequisitos Progreso Anual", levelOrder: 1, format: "progress" },
  {
    program: "Cocina",
    file: "Seguimiento de Progreso  (programa cocina).xlsx",
    sheet: "Rodrigo",
    levelOrder: 1,
    format: "progress",
    intBlocks: true,
    note: 'Hoja de un alumno usada como muestra: el formato es el mismo para todos. En papel las progresiones van 2/3/4 y los incisos se saltan letras; aquí se recorren desde 1 y a/b/c.',
  },

  // ---- AREAS: col B = texto, col C = área ----
  { program: "Lenguaje individual o en pareja", file: "Evaluación nivel prelingüistico lenguaje.xlsx", sheet: "Pre-ligüístico", levelOrder: 0, format: "areas" },
  { program: "Lenguaje individual o en pareja", file: "Evaluación nivel básico lenguaje.xlsx", sheet: "Básico", levelOrder: 1, format: "areas" },
  { program: "Lenguaje individual o en pareja", file: "Evaluación nivel intermedio lenguaje.xlsx", sheet: "Intermedio", levelOrder: 2, format: "areas" },
  { program: "Lenguaje individual o en pareja", file: "Evaluación nivel avanzado lenguaje.xlsx", sheet: "Avanzado", levelOrder: 3, format: "areas" },

  // ---- BLOQUES declarados a mano ----
  {
    program: "Terapia ocupacional",
    file: "EVALUACIÓN TERAPIA OCUPACIONAL.xlsx",
    sheet: "TEMPLETE",
    levelOrder: 1,
    format: "bloques",
    // A mano y NO por estilo: "Manejo de cubiertos" no comparte el formato de los
    // otros cinco encabezados, así que detectarlo por estilo se lo tragaría como tema.
    blockNames: [
      "Funciones de mano (pinza gruesa)",
      "Funciones de mano (pinza fina)",
      "Discriminación de formas, tamaños y cantidades",
      "Funciones cognitivas",
      "Destrezas manipulativas AVDH",
      "Manejo de cubiertos",
    ],
  },
  {
    program: "Lenguaje, música y gestos",
    file: "Evaluación LMYG.xlsx",
    sheet: "Hoja1",
    levelOrder: 1,
    format: "bloques",
    blockNames: [
      "Desarrollo del lenguaje",
      "Desarrollo social",
      "Discusión y Retroalimentación del Padre/Cuidador",
    ],
  },

  // ---- FILAS: col A = bloque, col B = tema ----
  {
    program: "Terapia física",
    file: "Evaluación grupo TFisica.xlsx",
    sheet: "Sofía Ayala",
    levelOrder: 1,
    format: "filas",
    note: "Hoja de una alumna usada como muestra: el formato es el mismo para las tres.",
  },

  // ---- PLANOS: lista corrida a un bloque único ----
  { program: "Habilidades sociales", file: "Evaluación hab. sociales inicial (sept-dic 20).xlsx", sheet: "Hoja1", levelOrder: 1, format: "planos", blockName: "Objetivos" },
  { program: "Habilidades sociales", file: "Evaluación hab. sociales intermedio (sept-dic 20).xlsx", sheet: "Hoja1", levelOrder: 2, format: "planos", blockName: "Objetivos" },
  { program: "Habilidades sociales", file: "Evaluación hab. sociales avanzado 1 (sept-dic 20).xlsx", sheet: "Hoja1", levelOrder: 3, format: "planos", blockName: "Objetivos" },
  { program: "Habilidades sociales", file: "Evaluación hab. sociales avanzado 2 (sept-dic 20).xlsx", sheet: "Hoja1", levelOrder: 4, format: "planos", blockName: "Objetivos" },
  { program: "Sensorial", file: "Evaluación sensorial final.xlsx", sheet: "Hoja1", levelOrder: 1, format: "planos", blockName: "Objetivos" },
  { program: "Danza representativa", file: "Formato de Evaluación Danza.xlsx", sheet: "Hoja1", levelOrder: 1, format: "planos", blockName: "Objetivos / Aspecto" },
  { program: "Brinco, salto y corro", file: "Formato de evaluación Brinco, salto y corro.xlsx", sheet: "Hoja1", levelOrder: 1, format: "planos", blockName: "Hitos de crecimiento" },

  // ---- Gateo: hitos repartidos entre sus 6 niveles (ver GATEO) ----
  ...Object.entries(GATEO).map(([order, bloque]): Source => ({
    program: "Gateo y caminata",
    levelOrder: Number(order),
    format: "literal",
    literal: [bloque],
    note: "Hitos de 'Formato de evaluación Gateo y caminata.xlsx'. ⚠️ El reparto por nivel es propuesta: falta que lo confirme el terapeuta.",
  })),

  // ---- LITERAL: transcritos de .docx ----
  { program: "Terapia orofacial", levelOrder: 1, format: "literal", literal: OROFACIAL, note: "Transcrito de 'Evaluación Programa orofacial.docx'." },
  { program: "Vida independiente", levelOrder: 1, format: "literal", literal: VIDA_INDEPENDIENTE, note: "Transcrito de 'Evaluación Vida independiente.docx'." },
  { program: "Escritura", levelOrder: 1, format: "literal", literal: PREESCRITURA, note: "Transcrito de 'Objetivos de evaluación_Escritura.docx'. Solo cubre Pre-escritura; los niveles 2–4 siguen sin formato." },
];

/** Filas que NO son temas ni bloques aunque caigan dentro de un bloque. */
const SKIP = /^(puntaje total|pasa de nivel|tabla valores|promedio|initial rating|highest rating|total score|copyright|instrucciones|clave del puntaje|progresiones|calificaciones|nombre del|sesión|fecha|registro de progreso|purposeful|ciclo|año|resumen|editado|trabajamos muchas habilidades|consulta el libro|direcciones|ingresa la fecha|proposito de las progresiones|propósito de las progresiones)/i;

/** Encabezados de los formatos en papel: nunca son objetivos. */
const SKIP_HOJA = /^(nombre|programa|l[ií]der|terapeuta|maestro|ciclo|fecha|edad|observaciones|firma|notas?|valoraci[óo]n|objetivos?|hitos de crecimiento|evaluaci[óo]n|no lo logra|en proceso|con ayuda|adquirido|constantemente|a veces|no observado|inicio|final|áreas del desarrollo|areas del desarrollo|si en la mayor[íi]a|escala|\d\s*(ausente|inicia|asistido|presente)|·)/i;

const LETTER = /^[a-zñ]$/i;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const isObjetivo = (t: string) => t.length >= 8 && !SKIP.test(t) && !SKIP_HOJA.test(t);

const readRows = (ws: XLSX.WorkSheet): unknown[][] =>
  XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });

/**
 * `progress`: col A = código, col B = texto. Bloque = "1.2" (o entero si
 * `intBlocks`); tema = una letra, o col A vacía con una frase en B.
 */
function extractProgress(ws: XLSX.WorkSheet, intBlocks = false): Bloque[] {
  const bloques: Bloque[] = [];
  let current: Bloque | null = null;

  for (const row of readRows(ws)) {
    const a = row?.[0];
    const bText = clean(row?.[1]);

    const isBlock = intBlocks
      ? typeof a === "number" && Number.isInteger(a)
      : (typeof a === "number" && Number.isFinite(a) && !Number.isInteger(a)) ||
        (typeof a === "string" && /^\d+\.\d+/.test(a.trim()));
    if (isBlock && bText && !SKIP.test(bText)) {
      current = { name: bText, items: [] };
      bloques.push(current);
      continue;
    }

    if (!current) continue;

    const aStr = clean(a);
    if (LETTER.test(aStr) && bText && !SKIP.test(bText)) {
      current.items.push(bText);
      continue;
    }
    const aEmpty = a == null || String(a).trim() === "";
    if (aEmpty && bText.length >= 8 && !SKIP.test(bText)) current.items.push(bText);
  }
  return bloques.filter((x) => x.items.length > 0);
}

/** `planos`: lista corrida en col A → un bloque único. */
function extractPlanos(ws: XLSX.WorkSheet, blockName: string): Bloque[] {
  const items = readRows(ws)
    .map((r) => clean(r?.[0]))
    .filter(isObjetivo);
  return items.length ? [{ name: blockName, items }] : [];
}

/**
 * `bloques`: col A mezcla encabezados y temas. Los encabezados se declaran a mano
 * porque el Excel no los marca de forma fiable. Si alguno no aparece, se avisa:
 * un nombre mal escrito colgaría sus temas del bloque anterior sin que se note.
 */
function extractBloques(ws: XLSX.WorkSheet, blockNames: string[]): { bloques: Bloque[]; missing: string[] } {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-záéíóúñ0-9]/gi, "");
  const wanted = new Map(blockNames.map((n) => [norm(n), n]));
  const found = new Set<string>();
  const bloques: Bloque[] = [];
  let current: Bloque | null = null;

  for (const row of readRows(ws)) {
    const text = clean(row?.[0]);
    if (!text) continue;
    const hit = wanted.get(norm(text));
    if (hit) {
      found.add(norm(text));
      current = { name: hit, items: [] };
      bloques.push(current);
      continue;
    }
    if (current && isObjetivo(text)) current.items.push(text);
  }
  const missing = blockNames.filter((n) => !found.has(norm(n)));
  return { bloques: bloques.filter((x) => x.items.length > 0), missing };
}

/** `areas`: col B = texto, col C = nombre del área (solo en su primera fila). */
function extractAreas(ws: XLSX.WorkSheet): Bloque[] {
  const bloques: Bloque[] = [];
  let current: Bloque | null = null;

  for (const row of readRows(ws)) {
    const text = clean(row?.[1]);
    const area = clean(row?.[2]);
    if (area) {
      current = { name: area, items: [] };
      bloques.push(current);
    }
    if (current && isObjetivo(text)) current.items.push(text);
  }
  return bloques.filter((x) => x.items.length > 0);
}

/** `filas`: col A = nombre del bloque (solo en su primera fila), col B = tema. */
function extractFilas(ws: XLSX.WorkSheet): Bloque[] {
  const bloques: Bloque[] = [];
  let current: Bloque | null = null;

  for (const row of readRows(ws)) {
    const name = clean(row?.[0]);
    const text = clean(row?.[1]);
    if (name && !SKIP_HOJA.test(name)) {
      current = { name, items: [] };
      bloques.push(current);
    }
    if (current && isObjetivo(text)) current.items.push(text);
  }
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

  const warnings: string[] = [];

  for (const src of SOURCES) {
    const program = await prisma.program.findFirst({
      where: { name: src.program },
      select: { id: true },
    });
    if (!program) {
      warnings.push(`Programa no encontrado: ${src.program} (¿corriste db:seed-programas?)`);
      continue;
    }
    const level = await prisma.programLevel.findFirst({
      where: { programId: program.id, order: src.levelOrder },
      select: { id: true, name: true },
    });
    if (!level) {
      warnings.push(`${src.program}: no existe el nivel de orden ${src.levelOrder} (¿corriste db:seed-niveles?)`);
      continue;
    }

    // --- Extraer ---
    let bloques: Bloque[] = [];
    if (src.format === "literal") {
      bloques = src.literal ?? [];
    } else {
      const filePath = path.join(dir, src.file!);
      if (!fs.existsSync(filePath)) {
        warnings.push(`Falta el archivo: ${src.file}`);
        continue;
      }
      const wb = XLSX.readFile(filePath);
      const wsName = wb.SheetNames.find((n) => n.trim() === src.sheet!.trim());
      if (!wsName) {
        warnings.push(`${src.file}: no existe la hoja "${src.sheet}"`);
        continue;
      }
      const ws = wb.Sheets[wsName];
      switch (src.format) {
        case "progress":
          bloques = extractProgress(ws, src.intBlocks);
          break;
        case "planos":
          bloques = extractPlanos(ws, src.blockName ?? "Objetivos");
          break;
        case "bloques": {
          const r = extractBloques(ws, src.blockNames ?? []);
          bloques = r.bloques;
          for (const m of r.missing) {
            warnings.push(`${src.program}: el bloque declarado "${m}" no aparece en ${src.file}. Sus temas se habrán ido al bloque anterior — revisa el nombre.`);
          }
          break;
        }
        case "areas":
          bloques = extractAreas(ws);
          break;
        case "filas":
          bloques = extractFilas(ws);
          break;
      }
    }

    if (bloques.length === 0) {
      warnings.push(`${src.program} · ${level.name}: no se extrajo NINGÚN bloque (${src.file ?? "literal"}).`);
      continue;
    }

    const origen = src.file ? `${src.file} → ${src.sheet}` : "transcrito de .docx";
    report.push(`\n## ${src.program} · ${level.name}  (${bloques.length} bloques)  [${origen}]`);
    if (src.note) report.push(`   nota: ${src.note}`);
    console.log(`\n📋 ${src.program} · ${level.name}: ${bloques.length} bloques`);

    for (let bi = 0; bi < bloques.length; bi++) {
      const bloque = bloques[bi];
      const blockCode = `${src.levelOrder}.${bi + 1}`;
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

  if (warnings.length) {
    report.push("\n\n⚠️ AVISOS");
    for (const w of warnings) report.push(`  • ${w}`);
    console.warn(`\n⚠️  ${warnings.length} aviso(s):`);
    for (const w of warnings) console.warn(`   • ${w}`);
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
