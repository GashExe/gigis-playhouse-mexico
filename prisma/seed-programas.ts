import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Reemplaza los programas de ejemplo por los programas REALES de Gigi's Playhouse
 * México (según "Descripción de programas 2026"). Cada programa es una actividad
 * con rango de edad, cupo, etc. Horario, tipo, maestro y cupos quedan editables
 * desde el panel.
 *
 * Uso: npx tsx prisma/seed-programas.ts
 *
 * ⚠️ Borra TODOS los programas actuales (y sus inscripciones de prueba) antes de
 * crear los reales. Los alumnos importados no tienen inscripciones, así que solo
 * afecta datos de ejemplo.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

type P = {
  name: string;
  area: string;
  type?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  studentCapacity?: number;
  description: string;
  color: string;
};

const PALETTE = [
  "#E4572E", "#2E86AB", "#8AA624", "#C05299", "#F2A541",
  "#3E7C59", "#6C63FF", "#0EAD9C", "#D7263D", "#B5651D",
  "#1B9AAA", "#EF476F", "#118AB2", "#9B5DE5",
];

const PROGRAMAS: P[] = [
  {
    name: "Gateo y caminata",
    area: "Terapia física / Motricidad",
    ageMin: 0,
    ageMax: null,
    description:
      "Primer programa de terapia física que trabaja la motricidad gruesa para el desarrollo de los más pequeños. Inicia desde los primeros días de nacidos hasta que logran la marcha (5 pasos de manera independiente).",
    color: PALETTE[0],
  },
  {
    name: "Brinco, salto y corro",
    area: "Terapia física / Motricidad",
    ageMin: 3,
    ageMax: 6,
    description:
      "Segunda etapa de terapia física, después de la marcha. Se busca perfeccionar la marcha hasta lograr pararse en un pie, brincar, caminar en línea recta, etc. A la par se trabaja el seguimiento de instrucciones y la atención. Ingresan una vez que tienen la marcha (aprox. 3 a 6 años).",
    color: PALETTE[1],
  },
  {
    name: "Lenguaje individual o en pareja",
    area: "Lenguaje y Comunicación",
    type: "Individual o en pareja",
    ageMin: 3,
    ageMax: null,
    description:
      "Contempla el aspecto de la comunicación, vital para el desempeño de los participantes en su entorno familiar, escolar y social. Toma como base la intención comunicativa, la codificación oral del lenguaje (articulación) y la comprensión del mismo.",
    color: PALETTE[2],
  },
  {
    name: "Lenguaje, música y gestos",
    area: "Lenguaje y Comunicación",
    type: "Grupal (ingresan los papás)",
    ageMin: 0,
    ageMax: 3,
    description:
      "Primera etapa de lenguaje con los más pequeños, donde se desarrolla intención comunicativa: contacto visual, responder a su nombre, balbuceo, gestos e inicio de onomatopeyas. Grupal (0–3 años). Se agenda evaluación previa.",
    color: PALETTE[3],
  },
  {
    name: "Terapia orofacial",
    area: "Terapia orofacial",
    ageMin: 0,
    ageMax: null,
    description:
      "Fortalece los músculos de la cara para atender dificultades en la alimentación, deglución, protrusión lingual, emisión de lenguaje y otras habilidades de la musculatura facial y orofaríngea. Atiende respiración bucal, dificultad en deglución/masticación, no tolerancia a texturas sólidas, bajo tono muscular de lengua, babeo y objetos constantes a la boca. De bebés (3 meses) hasta adultos.",
    color: PALETTE[4],
  },
  {
    name: "Habilidades sociales",
    area: "Habilidades sociales",
    type: "Grupal",
    ageMin: 3,
    ageMax: null,
    studentCapacity: 10,
    description:
      "Brinda a los participantes herramientas para una conducta adaptativa que favorece interactuar de forma adecuada con compañeros, familia y sociedad, junto con el reconocimiento de sus emociones y sus derechos. Grupal, de 6 a 10 participantes. De 3 años en adelante.",
    color: PALETTE[5],
  },
  {
    name: "Vida independiente",
    area: "Vida independiente y laboral",
    ageMin: 18,
    ageMax: null,
    description:
      "Desarrolla habilidades de independencia y laborales para jóvenes mayores de 18 años, trabajando aptitudes que les permitirán ejecutar un trabajo con responsabilidad y eficacia. Objetivos: aumentar las habilidades profesionales y organizativas; aumentar la independencia y la autoestima; referencia a posibles campos de empleo. Requiere ciertas habilidades previas; se agenda evaluación.",
    color: PALETTE[6],
  },
  {
    name: "Terapia ocupacional",
    area: "Terapia ocupacional",
    ageMin: 3,
    ageMax: null,
    description:
      "Diseñado para capacitar a los participantes con síndrome de Down en actividades de la vida diaria, mediante la habilitación o rehabilitación de habilidades motoras, cognitivas y sociales, o la modificación del entorno para reforzar su participación. Deben tener la marcha para ingresar; de 3 años en adelante.",
    color: PALETTE[7],
  },
  {
    name: "Sensorial",
    area: "Sensorial",
    ageMin: 0,
    ageMax: null,
    description:
      "Se enfoca en los canales de entrada y procesamiento de la información en la recepción de nuevos estímulos. Trabaja vista, gusto, oído, olfato, tacto, sistema vestibular y propiocepción para facilitar una percepción más real, explorar y manipular materiales y el entorno. Se trabaja en la sala multisensorial: ayuda al tono muscular y destrezas motoras, mejora el uso funcional del lenguaje, la socialización, el seguimiento de instrucciones y la memoria auditiva y visual. De 0 años en adelante, para participantes con necesidades sensoriales; se agenda evaluación.",
    color: PALETTE[8],
  },
  {
    name: "Danza representativa",
    area: "Arte y expresión",
    ageMin: 10,
    ageMax: null,
    description:
      "Trabaja la motricidad gruesa, la coordinación y la expresión corporal a través de la disciplina del baile, reforzando también el seguimiento de instrucciones. De 10 años en adelante.",
    color: PALETTE[9],
  },
  {
    name: "Cocina",
    area: "Vida diaria",
    ageMin: 12,
    ageMax: null,
    description:
      "Desarrolla habilidades para que los participantes elaboren de forma autónoma sus alimentos y manejen correctamente los utensilios, a través del seguimiento de instrucciones y la repetición de recetas sencillas. De 12 años en adelante.",
    color: PALETTE[10],
  },
  {
    name: "Lectura",
    area: "Académico",
    ageMin: 3,
    ageMax: null,
    description:
      "Guía que apoya a los participantes a adquirir y transmitir sus habilidades lectoras en la escuela, casa y comunidad. Basado en el método Troncoso. De 3 años en adelante.",
    color: PALETTE[11],
  },
  {
    name: "Escritura",
    area: "Académico",
    ageMin: 3,
    ageMax: null,
    description:
      "Trabaja actividades de coordinación fina, trazos, líneas y grafismos, así como escritura de letras, palabras y cartas según el nivel donde se ubican los participantes. De 3 años en adelante.",
    color: PALETTE[12],
  },
  {
    name: "Matemáticas",
    area: "Académico",
    ageMin: 3,
    ageMax: null,
    description:
      "Guía de apoyo que permite a los participantes transmitir sus habilidades matemáticas en la escuela, casa y comunidad. Dirigido a titulares de derecho de 3 años en adelante.",
    color: PALETTE[13],
  },
];

async function main() {
  const antes = await prisma.program.count();
  console.log(`Programas actuales: ${antes} (se eliminarán)`);

  // Borrar programas de ejemplo. Cascada elimina inscripciones de prueba.
  await prisma.program.deleteMany({});

  for (const p of PROGRAMAS) {
    await prisma.program.create({
      data: {
        name: p.name,
        description: p.description,
        area: p.area,
        type: p.type ?? null,
        color: p.color,
        ageMin: p.ageMin ?? null,
        ageMax: p.ageMax ?? null,
        studentCapacity: p.studentCapacity ?? 7,
      },
    });
  }

  const total = await prisma.program.count();
  console.log(`✅ Programas reales creados: ${total}`);
  for (const p of PROGRAMAS) {
    const edad =
      p.ageMin != null && p.ageMax != null
        ? `${p.ageMin}-${p.ageMax} años`
        : p.ageMin != null
          ? `${p.ageMin}+ años`
          : "todas las edades";
    console.log(`   • ${p.name} (${edad}, cupo ${p.studentCapacity ?? 7})`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
