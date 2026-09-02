import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Parte en GRUPOS los programas cuyo horario depende de la edad, y vacía los cupos.
 *
 * Uso:
 *   npm run db:grupos-por-edad -- [--commit]
 *
 * DRY-RUN por defecto, como los importadores.
 *
 * El grupo es la unidad que se llena: carga la hora, el rango de edad y los lugares.
 * Hasta ahora eso vivía en el programa, y no alcanzaba: Habilidades sociales tiene
 * tres niveles a tres horas distintas, y Lenguaje música y gestos tiene un solo nivel
 * con dos grupos entre los que la familia escoge.
 *
 * Todo lo de aquí lo confirmó la dirección el 2 de septiembre de 2026. Las clases
 * de grupo duran 45 minutos; Lenguaje, música y gestos es la excepción con 30.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});
const COMMIT = process.argv.includes("--commit");
const D = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const LUN = 1, MAR = 2, MIE = 3, JUE = 4;

type Grupo = {
  nivel: string | null; // nombre del nivel dueño; null = grupo del programa entero
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  cupo: number;
  weekday: number;
  startTime: string;
  endTime: string;
};

type Plan = {
  programa: string;
  /** Niveles finales, en orden. Se renombra el que ya existe y se crean los que falten. */
  niveles?: string[];
  /** Niveles a borrar (deben venir sin nadie ubicado). */
  borrarNiveles?: string[];
  /** Quitar los bloques generales del programa (los grupos ya cubren todo). */
  quitarBloques?: boolean;
  /** Ajustes al programa. */
  programa_ageMin?: number | null;
  programa_capacidad?: number;
  horarioTexto?: string;
  grupos: Grupo[];
};

const PLAN: Plan[] = [
  {
    programa: "Habilidades sociales",
    niveles: ["Inicial", "Intermedio", "Avanzado"],
    borrarNiveles: ["Avanzado 2"],
    quitarBloques: true,
    programa_capacidad: 8,
    horarioTexto:
      "Clases de 45 minutos; cada nivel tiene dos grupos y la familia escoge uno. " +
      "Inicial (3–7): lun 16:00 o mié 17:00 · Intermedio (8–12): lun 17:00 o mar 16:00 · " +
      "Avanzado (13+): lun 16:00 o mié 18:00.",
    grupos: [
      { nivel: "Inicial", name: "Grupo 1", ageMin: 3, ageMax: 7, cupo: 8, weekday: LUN, startTime: "18:00", endTime: "18:45" },
      { nivel: "Inicial", name: "Grupo 2", ageMin: 3, ageMax: 7, cupo: 8, weekday: MIE, startTime: "17:00", endTime: "17:45" },
      { nivel: "Intermedio", name: "Grupo 1", ageMin: 8, ageMax: 12, cupo: 8, weekday: LUN, startTime: "17:00", endTime: "17:45" },
      { nivel: "Intermedio", name: "Grupo 2", ageMin: 8, ageMax: 12, cupo: 8, weekday: MAR, startTime: "16:00", endTime: "16:45" },
      { nivel: "Avanzado", name: "Grupo 1", ageMin: 13, ageMax: null, cupo: 8, weekday: LUN, startTime: "16:00", endTime: "16:45" },
      { nivel: "Avanzado", name: "Grupo 2", ageMin: 13, ageMax: null, cupo: 8, weekday: MIE, startTime: "18:00", endTime: "18:45" },
    ],
  },
  {
    programa: "Cocina",
    niveles: ["Inicial", "Avanzado"],
    quitarBloques: true,
    programa_ageMin: 8, // el tope de 45 se queda
    horarioTexto:
      "Lunes, clases de 45 minutos. Inicial (8–12 años): 16:00 · Avanzado (13 en adelante): 17:00. " +
      "Líder: Alejandra González.",
    grupos: [
      { nivel: "Inicial", name: "Inicial", ageMin: 8, ageMax: 12, cupo: 7, weekday: LUN, startTime: "16:00", endTime: "16:45" },
      { nivel: "Avanzado", name: "Avanzado", ageMin: 13, ageMax: 45, cupo: 7, weekday: LUN, startTime: "17:00", endTime: "17:45" },
    ],
  },
  {
    programa: "Terapia ocupacional",
    niveles: ["Inicial", "Intermedio", "Avanzado"],
    quitarBloques: true,
    horarioTexto:
      "Lunes, clases de 45 minutos. Inicial (3–7): 16:00 · Intermedio (8–12): 17:00 · Avanzado (13+): 18:00.",
    grupos: [
      { nivel: "Inicial", name: "Inicial", ageMin: 3, ageMax: 7, cupo: 7, weekday: LUN, startTime: "16:00", endTime: "16:45" },
      { nivel: "Intermedio", name: "Intermedio", ageMin: 8, ageMax: 12, cupo: 7, weekday: LUN, startTime: "17:00", endTime: "17:45" },
      { nivel: "Avanzado", name: "Avanzado", ageMin: 13, ageMax: null, cupo: 7, weekday: LUN, startTime: "18:00", endTime: "18:45" },
    ],
  },
  {
    // Los bloques grandes SE QUEDAN: son las tutorías individuales de los otros tres
    // niveles. Solo Prerrequisitos es clase de grupo con hora fija.
    programa: "Lectura",
    horarioTexto:
      "Tutorías individuales dentro de los bloques: lun 9:00–12:30 y 16:00–19:00 · mar 10:00–11:00 y 16:00–19:00 · " +
      "mié 10:00–11:00 y 16:00–19:00 · jue 10:00–11:00 y 16:00–19:00 · vie 16:00–18:00. " +
      "Prerrequisitos es en grupo, 45 minutos: lun 16:00 o jue 17:00 (se escoge uno).",
    grupos: [
      { nivel: "Prerrequisitos", name: "Grupo 1", ageMin: 3, ageMax: 7, cupo: 7, weekday: LUN, startTime: "16:00", endTime: "16:45" },
      { nivel: "Prerrequisitos", name: "Grupo 2", ageMin: 3, ageMax: 7, cupo: 7, weekday: JUE, startTime: "17:00", endTime: "17:45" },
    ],
  },
  {
    programa: "Escritura",
    horarioTexto:
      "Tutorías individuales dentro de los bloques: lun 10:00–11:15 y 17:00–19:00 · mar 11:00–12:00 y 16:00–18:00 · " +
      "mié 9:40–12:15 y 16:00–19:00 · jue 10:00–12:00 y 17:00–19:00 · vie 16:00–17:00. " +
      "Preescritura es en grupo, 45 minutos: lun 17:00 o jue 18:00 (se escoge uno).",
    grupos: [
      { nivel: "Pre-escritura", name: "Grupo 1", ageMin: 3, ageMax: 7, cupo: 7, weekday: LUN, startTime: "17:00", endTime: "17:45" },
      { nivel: "Pre-escritura", name: "Grupo 2", ageMin: 3, ageMax: 7, cupo: 7, weekday: JUE, startTime: "18:00", endTime: "18:45" },
    ],
  },
  {
    // La excepción de los 45 minutos: aquí son 30, porque son bebés y entran los papás.
    programa: "Lenguaje, música y gestos",
    quitarBloques: true,
    horarioTexto:
      "Jueves, 30 minutos, entran los papás. Grupo 1: 10:30 · Grupo 2: 17:00 (se escoge uno). Terapeuta: Nadia Díaz.",
    grupos: [
      { nivel: "Nivel único", name: "Grupo 1", ageMin: 0, ageMax: 3, cupo: 7, weekday: JUE, startTime: "10:30", endTime: "11:00" },
      { nivel: "Nivel único", name: "Grupo 2", ageMin: 0, ageMax: 3, cupo: 7, weekday: JUE, startTime: "17:00", endTime: "17:30" },
    ],
  },
];

async function main() {
  console.log(COMMIT ? "=== GRUPOS POR EDAD (--commit) ===\n" : "=== GRUPOS POR EDAD (DRY-RUN) ===\n");
  let totalLugares = 0;

  for (const plan of PLAN) {
    const p = await prisma.program.findFirst({
      where: { name: plan.programa },
      include: { levels: { orderBy: { order: "asc" }, include: { _count: { select: { records: true } } } }, scheduleSlots: true },
    });
    if (!p) throw new Error(`No encontré el programa «${plan.programa}»`);
    console.log(`■ ${p.name}`);

    if (plan.borrarNiveles?.length) {
      for (const nombre of plan.borrarNiveles) {
        const l = p.levels.find((x) => x.name === nombre);
        if (!l) { console.log(`   nivel «${nombre}»: ya no está`); continue; }
        if (l._count.records > 0) throw new Error(`«${nombre}» tiene ${l._count.records} ubicados: no lo borro`);
        console.log(`   borra nivel «${nombre}» (sin nadie ubicado)`);
        if (COMMIT) await prisma.programLevel.delete({ where: { id: l.id } });
      }
    }

    if (plan.niveles) {
      const vivos = p.levels.filter((l) => !plan.borrarNiveles?.includes(l.name));
      for (const [i, nombre] of plan.niveles.entries()) {
        const orden = i + 1;
        const actual = vivos[i];
        if (actual && actual.name !== nombre) console.log(`   nivel ${orden}: «${actual.name}» → «${nombre}»`);
        else if (!actual) console.log(`   nivel ${orden}: crea «${nombre}»`);
        if (COMMIT) {
          if (actual) await prisma.programLevel.update({ where: { id: actual.id }, data: { name: nombre, order: orden } });
          else await prisma.programLevel.create({ data: { programId: p.id, name: nombre, order: orden } });
        }
      }
    }

    if (plan.quitarBloques) {
      const bloques = p.scheduleSlots.filter((s) => !s.programGroupId);
      if (bloques.length) {
        console.log(`   quita ${bloques.length} horario(s) generales: ${bloques.map((s) => `${D[s.weekday]} ${s.startTime}–${s.endTime}`).join(" · ")}`);
        if (COMMIT) await prisma.scheduleSlot.deleteMany({ where: { id: { in: bloques.map((s) => s.id) } } });
      }
    }

    if (plan.programa_ageMin !== undefined || plan.programa_capacidad !== undefined || plan.horarioTexto) {
      if (plan.programa_ageMin !== undefined) console.log(`   edad mínima del programa: ${p.ageMin} → ${plan.programa_ageMin}`);
      if (plan.programa_capacidad !== undefined) console.log(`   cupo del programa: ${p.studentCapacity} → ${plan.programa_capacidad}`);
      if (COMMIT) {
        await prisma.program.update({
          where: { id: p.id },
          data: {
            ...(plan.programa_ageMin !== undefined ? { ageMin: plan.programa_ageMin } : {}),
            ...(plan.programa_capacidad !== undefined ? { studentCapacity: plan.programa_capacidad } : {}),
            ...(plan.horarioTexto ? { schedule: plan.horarioTexto } : {}),
          },
        });
      }
    }

    // Los grupos, ya con los niveles en su nombre final.
    const niveles = COMMIT
      ? await prisma.programLevel.findMany({ where: { programId: p.id } })
      : [...p.levels, ...(plan.niveles ?? []).map((n) => ({ id: `(nuevo:${n})`, name: n }))];

    for (const g of plan.grupos) {
      const nivel = g.nivel ? niveles.find((l) => l.name === g.nivel) : null;
      if (g.nivel && !nivel) throw new Error(`No encontré el nivel «${g.nivel}» en ${p.name}`);
      const edad = g.ageMin != null && g.ageMax != null ? `${g.ageMin}–${g.ageMax}` : g.ageMin != null ? `${g.ageMin}+` : "sin tope";
      console.log(`   grupo ${g.nivel ? `${g.nivel} / ` : ""}${g.name}: ${D[g.weekday]} ${g.startTime}–${g.endTime}, ${edad} años, ${g.cupo} lugares`);
      totalLugares += g.cupo;
      if (COMMIT) {
        const creado = await prisma.programGroup.create({
          data: {
            programId: p.id,
            programLevelId: nivel?.id ?? null,
            name: g.name,
            ageMin: g.ageMin,
            ageMax: g.ageMax,
            studentCapacity: g.cupo,
          },
        });
        await prisma.scheduleSlot.create({
          data: {
            programId: p.id,
            programLevelId: nivel?.id ?? null,
            programGroupId: creado.id,
            weekday: g.weekday,
            startTime: g.startTime,
            endTime: g.endTime,
          },
        });
      }
    }
    console.log("");
  }

  const inscripciones = await prisma.enrollment.count();
  const ubicaciones = await prisma.levelRecord.count();
  console.log(`Vaciar cupos: borra ${inscripciones} inscripciones y CONSERVA ${ubicaciones} ubicaciones de nivel.`);
  console.log(`(así, al reinscribirse, a cada quien se le recupera solo el nivel donde ya estaba)`);
  console.log(`\nTotal de lugares en grupos: ${totalLugares}`);

  // La ventanilla se cierra mientras dura el cambio: vaciar los cupos deja el ciclo
  // sin nadie inscrito, y con la ventanilla abierta una familia podría meterse a un
  // programa cuyos grupos todavía no saben contar sus lugares. La directora la vuelve
  // a abrir desde Configuración cuando esté todo listo.
  const ciclo = await prisma.cycle.findFirst({ where: { active: true } });
  if (ciclo?.enrollmentOpen) console.log(`\nCierra la ventanilla de inscripción de ${ciclo.label} (la directora la reabre desde Configuración).`);

  if (!COMMIT) { console.log("\nDRY-RUN: no se escribió nada. Corre con --commit."); return; }
  await prisma.enrollment.deleteMany({});
  if (ciclo?.enrollmentOpen) await prisma.cycle.update({ where: { id: ciclo.id }, data: { enrollmentOpen: false } });
  console.log("\nListo.");
}

main().finally(() => prisma.$disconnect());
