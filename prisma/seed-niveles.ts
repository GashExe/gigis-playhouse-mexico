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
  "Lenguaje individual o en pareja": [
    ["Nivel básico"],
    ["Nivel intermedio"],
    ["Nivel avanzado"],
  ],
  "Lenguaje, música y gestos": [["Nivel prelingüístico"]],
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
    for (let i = 0; i < niveles.length; i++) {
      const [name, description] = niveles[i];
      await prisma.programLevel.upsert({
        where: { programId_order: { programId: program.id, order: i + 1 } },
        update: { name, description: description ?? null },
        create: { programId: program.id, order: i + 1, name, description: description ?? null },
      });
      creados++;
    }
    console.log(`   • ${programName}: ${niveles.length} niveles`);
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
