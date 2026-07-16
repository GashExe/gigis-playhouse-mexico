import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Siembra los NIVELES propios de cada programa (según "Descripción de programas")
 * y los CICLOS por temporada del año en curso.
 *
 * Uso: npm run db:seed-niveles
 *
 * Idempotente: usa upsert por (programa, orden) y por (temporada, año), así que
 * re-ejecutarlo NO borra ni duplica niveles, y no afecta las ubicaciones ya
 * registradas (LevelRecord). Solo programas con niveles definidos en el manual
 * reciben niveles; los demás quedan sin lista de niveles.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

// Nivel: [nombre, descripción?]
type Nivel = [string, string?];

/**
 * Orden del PRIMER nivel de un programa. Por defecto 1; Lenguaje arranca en 0
 * porque el prelingüístico es el nivel de entrada. Importa que sea exacto: el
 * upsert va por (programa, orden), así que un offset mal puesto RENOMBRA niveles
 * existentes y reasigna en silencio a los alumnos ya ubicados en ellos.
 */
const ORDEN_INICIAL: Record<string, number> = {
  "Lenguaje individual o en pareja": 0,
};

/** Niveles por nombre EXACTO de programa (deben coincidir con seed-programas.ts). */
const NIVELES_POR_PROGRAMA: Record<string, Nivel[]> = {
  Lectura: [
    ["Prerrequisitos"],
    ["Nivel inicial", "Salto a la lectura"],
    ["Nivel intermedio", "Ser un lector"],
    ["Nivel avanzado", "Leer para aprender"],
  ],
  Escritura: [
    ["Pre-escritura", "Trazos básicos"],
    ["Nivel inicial", "Trazo de letras"],
    ["Nivel intermedio"],
    ["Nivel avanzado", "Progreso de la escritura"],
  ],
  Matemáticas: [
    ["Nivel inicial", "Sentido numérico y conteo"],
    ["Nivel intermedio", "Adición y sustracción"],
    ["Nivel avanzado", "Multiplicación y división"],
  ],
  // Empieza en 0: el prelingüístico es el nivel de entrada, con el que se ubica al
  // participante antes de colocarlo en básico. Los otros tres conservan su orden
  // 1/2/3 de siempre, así que las ubicaciones ya registradas no se mueven.
  "Lenguaje individual o en pareja": [
    ["Nivel prelingüístico", "Nivel de entrada: ubica al participante"],
    ["Nivel básico"],
    ["Nivel intermedio"],
    ["Nivel avanzado"],
  ],
  // Su único nivel se llamaba "Nivel prelingüístico", pero ese nivel es de Lenguaje
  // individual (tiene su propio formato). LMYG es un programa aparte, sin progresión.
  "Lenguaje, música y gestos": [["Nivel único"]],
  "Habilidades sociales": [
    ["Inicial", "3 a 7 años"],
    ["Intermedio", "7 a 12 años"],
    ["Avanzado 1", "13 años en adelante"],
    ["Avanzado 2", "13 años en adelante"],
  ],
  "Gateo y caminata": [
    ["Nivel 1", "Control cefálico total"],
    ["Nivel 2", "Cambio de decúbito"],
    ["Nivel 3", "Sentado por sí solo sin caer"],
    ["Nivel 4", "Gateo"],
    ["Nivel 5", "Bipedestación"],
    ["Nivel 6", "Marcha"],
  ],

  // --- Programas de formato PLANO: un solo nivel ---
  // Su formato de evaluación es una lista única de objetivos, sin progresión por
  // niveles. El nivel existe solo porque los bloques cuelgan de uno (EvalItem
  // exige bloque, y el bloque exige nivel).
  "Brinco, salto y corro": [["Nivel único"]],
  "Terapia orofacial": [["Nivel único"]],
  "Vida independiente": [["Nivel único"]],
  "Terapia ocupacional": [["Nivel único"]],
  Sensorial: [["Nivel único"]],
  "Danza representativa": [["Nivel único"]],
  "Terapia física": [["Nivel único"]],

  // El formato de Cocina se titula "NIVEL 2" y no existe un nivel 1: la
  // numeración del papel arranca en 2. Se recorre para que empiece en 1.
  Cocina: [["Nivel 1", "Antes rotulado \"NIVEL 2\" en el formato en papel"]],
};

/** Ciclos por temporada del año en curso. */
const YEAR = 2026;
type Season = "ENE_JUN" | "JUL_AGO" | "SEP_DIC";
const CICLOS: { season: Season; label: string; active: boolean }[] = [
  { season: "ENE_JUN", label: `Ene–Jun ${YEAR}`, active: true },
  { season: "JUL_AGO", label: `Jul–Ago ${YEAR}`, active: false },
  { season: "SEP_DIC", label: `Sep–Dic ${YEAR}`, active: false },
];

async function main() {
  // --- Niveles por programa ---
  let creados = 0;
  const sinPrograma: string[] = [];

  for (const [programName, niveles] of Object.entries(NIVELES_POR_PROGRAMA)) {
    const program = await prisma.program.findFirst({ where: { name: programName } });
    if (!program) {
      sinPrograma.push(programName);
      continue;
    }
    const base = ORDEN_INICIAL[programName] ?? 1;
    for (let i = 0; i < niveles.length; i++) {
      const [name, description] = niveles[i];
      const order = base + i;
      await prisma.programLevel.upsert({
        where: { programId_order: { programId: program.id, order } },
        update: { name, description: description ?? null },
        create: { programId: program.id, order, name, description: description ?? null },
      });
      creados++;
    }
    const rango = base === 1 ? "" : ` (órdenes ${base}–${base + niveles.length - 1})`;
    console.log(`   • ${programName}: ${niveles.length} niveles${rango}`);
  }

  if (sinPrograma.length) {
    console.warn(`⚠️  Programas no encontrados (¿corriste db:seed-programas?): ${sinPrograma.join(", ")}`);
  }
  console.log(`✅ Niveles sembrados/actualizados: ${creados}`);

  // --- Ciclos ---
  for (const c of CICLOS) {
    await prisma.cycle.upsert({
      where: { season_year: { season: c.season, year: YEAR } },
      update: { label: c.label, active: c.active },
      create: { season: c.season, year: YEAR, label: c.label, active: c.active },
    });
  }
  console.log(`✅ Ciclos ${YEAR}: ${CICLOS.map((c) => c.label + (c.active ? " (activo)" : "")).join(", ")}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
