import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Mete a la lista de Danza representativa que mandó la coordinación al ciclo vigente.
 *
 * Uso:
 *   npm run db:inscribir-danza -- [--commit]
 *
 * DRY-RUN por defecto, como los demás importadores: imprime a quién inscribiría y
 * por qué, y solo escribe con --commit. Quien ya esté inscrito se ignora.
 *
 * Danza no tiene grupos (es un bloque del programa entero), así que la inscripción
 * va sin grupo y el cupo del grupo no entra en juego. Lo que sí se revisa —igual
 * que lo revisa la pantalla de dirección— es la edad y el empalme de horario, y se
 * deja anotado en la inscripción cuando se pasa por encima de un reparo.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

const PROGRAMA = "Danza representativa";

/**
 * La lista tal como llegó. La matrícula es la que manda para emparejar; el nombre
 * va al lado para poder leer la lista y para los pocos que aún no tienen matrícula,
 * que se buscan por nombre completo.
 */
const LISTA: { nombre: string; matricula?: string }[] = [
  { nombre: "Ana María Pérez Barba", matricula: "2026111" },
  { nombre: "Ángel Rodríguez Franco", matricula: "2026124" },
  { nombre: "Camila De Silva Villarreal", matricula: "2026031" },
  { nombre: "David Corzo González", matricula: "2026025" },
  { nombre: "Diego Barrón Martínez" }, // sin matrícula todavía
  { nombre: "Isaac Gutiérrez Centeno", matricula: "2026048" },
  { nombre: "Ismael Rodríguez Granada Vázquez", matricula: "2026043" },
  { nombre: "Karla De Ávila Ramírez", matricula: "2026028" },
  { nombre: "Mateo De La Llata Simroth", matricula: "2026030" },
  { nombre: "Naomi Pero González", matricula: "2026113" },
  { nombre: "Rodrigo Jiménez Medina", matricula: "2026059" },
  { nombre: "Sofía Ayala Terrones", matricula: "2026012" },
  { nombre: "Sofía Rivera Aguilar", matricula: "2026122" },
  { nombre: "Valeria Martínez Jiménez", matricula: "2026081" },
];

const commit = process.argv.includes("--commit");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Edad cumplida a día de hoy (mismo criterio que lib/utils → ageFrom). */
const edadDe = (d: Date | null) =>
  d === null ? null : Math.floor((Date.now() - d.getTime()) / 31557600000);

/** ¿Se encima este horario con aquel? Mismo día y las horas se traslapan. */
type Slot = { weekday: number; startTime: string; endTime: string };
const seEncima = (a: Slot, b: Slot) =>
  a.weekday === b.weekday && a.startTime < b.endTime && b.startTime < a.endTime;

async function main() {
  const cycle = await prisma.cycle.findFirst({ where: { active: true } });
  if (!cycle) throw new Error("No hay ciclo vigente.");

  const program = await prisma.program.findFirst({
    where: { name: PROGRAMA },
    select: {
      id: true,
      name: true,
      ageMin: true,
      ageMax: true,
      levels: { orderBy: { order: "asc" }, select: { id: true, name: true } },
      groups: { where: { active: true }, select: { id: true } },
      scheduleSlots: { select: { weekday: true, startTime: true, endTime: true } },
      cycles: { where: { id: cycle.id }, select: { id: true } },
    },
  });
  if (!program) throw new Error(`No existe el programa «${PROGRAMA}».`);
  if (program.cycles.length === 0)
    throw new Error(`«${PROGRAMA}» no está en la oferta de ${cycle.label}.`);
  if (program.groups.length > 0)
    throw new Error("El programa ya tiene grupos: hay que decidir a cuál va cada quien.");

  console.log(`${program.name} — ${cycle.label}${commit ? "" : "   (DRY-RUN, no escribe nada)"}`);
  console.log(
    `Horario: ${program.scheduleSlots.map((s) => `${DIAS[s.weekday]} ${s.startTime}-${s.endTime}`).join(", ")}`,
  );
  console.log(`Edad del programa: ${program.ageMin ?? "—"} a ${program.ageMax ?? "—"}\n`);

  let nuevas = 0;
  let yaEstaban = 0;
  const sinEmparejar: string[] = [];

  for (const fila of LISTA) {
    // Por matrícula, que es única; sin ella, por nombre completo normalizado.
    const student = fila.matricula
      ? await prisma.student.findUnique({
          where: { matricula: fila.matricula },
          select: SELECT_ALUMNO,
        })
      : (
          await prisma.student.findMany({ select: SELECT_ALUMNO })
        ).find((s) => norm(`${s.firstName} ${s.lastName}`) === norm(fila.nombre)) ?? null;

    if (!student) {
      sinEmparejar.push(fila.nombre);
      console.log(`  ? ${fila.nombre} — no está en el padrón, hay que darlo de alta`);
      continue;
    }

    const ya = await prisma.enrollment.findUnique({
      where: {
        studentId_programId_cycleId: {
          studentId: student.id,
          programId: program.id,
          cycleId: cycle.id,
        },
      },
      select: { status: true },
    });
    if (ya) {
      yaEstaban++;
      console.log(`  = ${student.firstName} ${student.lastName} — ya inscrito (${ya.status})`);
      continue;
    }

    // Los mismos reparos que enseña la pantalla de dirección. No frenan —la lista
    // la mandó la coordinación— pero quedan escritos en la inscripción.
    const edad = edadDe(student.birthDate);
    const reparos: string[] = [];
    if (edad !== null && program.ageMin !== null && edad < program.ageMin)
      reparos.push(`tiene ${edad} y el programa pide desde ${program.ageMin}`);
    if (edad !== null && program.ageMax !== null && edad > program.ageMax)
      reparos.push(`tiene ${edad} y el programa llega a ${program.ageMax}`);

    for (const e of student.enrollments) {
      const suyos = e.group?.slots.length ? e.group.slots : e.program.scheduleSlots;
      const choque = suyos.find((s) => program.scheduleSlots.some((p) => seEncima(s, p)));
      if (choque)
        reparos.push(
          `se empalma con ${e.program.name} (${DIAS[choque.weekday]} ${choque.startTime}-${choque.endTime})`,
        );
    }

    const salvedad =
      reparos.length > 0
        ? `Inscrito en la lista de Danza que mandó la coordinación (${reparos.join("; ")}; autorizado por dirección).`
        : null;

    nuevas++;
    console.log(
      `  + ${student.firstName} ${student.lastName} (${student.matricula ?? "sin matrícula"}, ${edad ?? "?"} años)` +
        (reparos.length ? `\n      ojo: ${reparos.join("; ")}` : ""),
    );

    if (commit) {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          programId: program.id,
          cycleId: cycle.id,
          notes: salvedad,
        },
      });
      // Si estaba formada esperando lugar, ya no espera nada (igual que lib/enroll).
      await prisma.waitlistRequest.updateMany({
        where: {
          studentId: student.id,
          programId: program.id,
          cycleId: cycle.id,
          status: "EN_ESPERA",
        },
        data: { status: "ACEPTADA", decidedAt: new Date() },
      });
      await ubicarNivel(student.id, program.id, cycle.id);
    }
  }

  console.log(
    `\n${nuevas} inscripciones ${commit ? "creadas" : "por crear"}, ${yaEstaban} ya estaban` +
      (sinEmparejar.length ? `, ${sinEmparejar.length} sin emparejar` : "") +
      ".",
  );
  if (!commit) console.log("Nada se escribió. Para aplicarlo: npm run db:inscribir-danza -- --commit");
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const SELECT_ALUMNO = {
  id: true,
  firstName: true,
  lastName: true,
  matricula: true,
  birthDate: true,
  enrollments: {
    where: { status: "ACTIVA" as const },
    select: {
      program: {
        select: {
          name: true,
          scheduleSlots: { select: { weekday: true, startTime: true, endTime: true } },
        },
      },
      group: {
        select: { slots: { select: { weekday: true, startTime: true, endTime: true } } },
      },
    },
  },
} as const;

/**
 * Misma regla que `ensurePlacementOnEnroll` (lib/placement.ts), reescrita aquí
 * porque aquella es "server-only" y no se puede importar desde un script.
 */
async function ubicarNivel(studentId: string, programId: string, cycleId: string) {
  const ya = await prisma.levelRecord.findFirst({ where: { studentId, programId, cycleId } });
  if (ya) return;
  const niveles = await prisma.programLevel.findMany({
    where: { programId },
    orderBy: { order: "asc" },
  });
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

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
