import "server-only";
import { prisma } from "@/lib/prisma";
import { ageFrom, meetsAgeRequirement } from "@/lib/utils";
import { slotsLabel, type Slot } from "@/lib/schedule";
import { resolvePlacement } from "@/lib/placement";

/**
 * El GRUPO: la unidad que de verdad se llena.
 *
 * Antes la edad, el cupo y el horario vivían en el programa, y eso no alcanzaba a
 * describir la casa. Habilidades sociales tiene tres niveles a tres horas distintas
 * y cada uno con dos grupos entre los que la familia escoge; Lenguaje, música y
 * gestos tiene UN nivel con dos grupos el jueves. Contar "7 lugares del programa"
 * en cualquiera de los dos casos da un número que no significa nada: el panel
 * llegó a marcar cinco programas pasados de cupo por eso.
 *
 * Aquí vive lo que hay que saber de un grupo antes de inscribir: a cuáles puede
 * entrar este participante y cuántos lugares le quedan a cada uno. Los programas
 * SIN grupos (las terapias grandes, que son bloques con sesiones individuales
 * rotando) siguen contándose por programa, como siempre.
 */

export type GroupOption = {
  id: string;
  name: string;
  levelId: string | null;
  levelName: string | null;
  ageMin: number | null;
  ageMax: number | null;
  capacity: number;
  occupied: number;
  /** Ya no le caben más. */
  full: boolean;
  /** Horario legible del grupo (ej. "Lun 16:00–16:45"). */
  scheduleLabel: string;
  slots: Slot[];
  /** La edad del participante cabe en este grupo. */
  ageOk: boolean;
};

const GROUP_SELECT = {
  id: true,
  name: true,
  ageMin: true,
  ageMax: true,
  studentCapacity: true,
  programLevelId: true,
  level: { select: { id: true, name: true, order: true } },
  slots: {
    select: { weekday: true, startTime: true, endTime: true, programLevelId: true, programGroupId: true },
  },
} as const;

/** Lugares ocupados de un grupo en un ciclo (inscripciones activas). */
export async function occupiedGroupSeats(programGroupId: string, cycleId: string): Promise<number> {
  return prisma.enrollment.count({
    where: { programGroupId, cycleId, status: "ACTIVA" },
  });
}

/** ¿Este programa reparte a su gente en grupos? */
export async function programHasGroups(programId: string): Promise<boolean> {
  return (await prisma.programGroup.count({ where: { programId, active: true } })) > 0;
}

/**
 * Los grupos de un programa con sus lugares ocupados, ya listos para pintar o
 * para juzgar. `age` en null (sin fecha de nacimiento) no descarta a nadie: es el
 * mismo criterio que ya usa la regla de edad del programa.
 */
export async function groupsOfProgram(
  programId: string,
  cycleId: string,
  age: number | null,
  programCapacity: number,
): Promise<GroupOption[]> {
  const groups = await prisma.programGroup.findMany({
    where: { programId, active: true },
    select: GROUP_SELECT,
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
  });
  if (groups.length === 0) return [];

  const counts = await prisma.enrollment.groupBy({
    by: ["programGroupId"],
    where: { cycleId, status: "ACTIVA", programGroupId: { in: groups.map((g) => g.id) } },
    _count: true,
  });
  const occupiedOf = new Map(counts.map((c) => [c.programGroupId, c._count]));

  return groups.map((g) => {
    const capacity = g.studentCapacity ?? programCapacity;
    const occupied = occupiedOf.get(g.id) ?? 0;
    return {
      id: g.id,
      name: g.name,
      levelId: g.level?.id ?? null,
      levelName: g.level?.name ?? null,
      ageMin: g.ageMin,
      ageMax: g.ageMax,
      capacity,
      occupied,
      full: occupied >= capacity,
      scheduleLabel: slotsLabel(g.slots),
      slots: g.slots,
      ageOk: meetsAgeRequirement(age, g.ageMin, g.ageMax),
    };
  });
}

/**
 * A qué grupos puede entrar este participante en este programa.
 *
 * Se filtra por edad —que es justo lo que el grupo vino a resolver— y, cuando el
 * programa tiene niveles, por el nivel donde quedó (o quedaría) ubicado: si está en
 * Intermedio no se le ofrece el grupo de Avanzado, aunque la edad le cuadre. Lo que
 * NO se filtra es el cupo lleno: se devuelve marcado, porque quien inscribe necesita
 * ver que existe y está lleno para poder mandarlo a la lista de espera.
 */
export async function groupOptionsForStudent(
  studentId: string,
  programId: string,
  cycleId: string,
  opts?: { levelId?: string | null; age?: number | null; programCapacity?: number },
): Promise<GroupOption[]> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { studentCapacity: true },
  });
  if (!program) return [];

  const age =
    opts?.age !== undefined
      ? opts.age
      : ageFrom(
          (
            await prisma.student.findUnique({
              where: { id: studentId },
              select: { birthDate: true },
            })
          )?.birthDate,
        );

  const all = await groupsOfProgram(
    programId,
    cycleId,
    age,
    opts?.programCapacity ?? program.studentCapacity,
  );
  if (all.length === 0) return [];

  const porEdad = all.filter((g) => g.ageOk);
  if (opts?.levelId === undefined) return porEdad;

  // Con nivel resuelto, solo los grupos de ese nivel (más los que no cuelgan de
  // ninguno, que valen para todo el programa).
  const delNivel = porEdad.filter((g) => g.levelId === null || g.levelId === opts.levelId);
  return delNivel.length > 0 ? delNivel : porEdad;
}

/**
 * Lo mismo que `groupOptionsForStudent` pero para varios programas de una vez, que
 * es lo que necesita la hoja de inscripción de la familia: ahí se pintan todas las
 * actividades del ciclo juntas. Solo se ubica al participante en los programas que
 * DE VERDAD tienen grupos; preguntarlo por los demás sería un viaje a la base para
 * nada (las terapias grandes son la mayoría y no reparten grupos).
 */
export async function groupOptionsForPrograms(
  studentId: string,
  cycleId: string,
  programs: { id: string; studentCapacity: number }[],
  age: number | null,
): Promise<Map<string, GroupOption[]>> {
  const conGrupos = await prisma.programGroup.groupBy({
    by: ["programId"],
    where: { programId: { in: programs.map((p) => p.id) }, active: true },
  });
  const ids = new Set(conGrupos.map((g) => g.programId));
  const out = new Map<string, GroupOption[]>();
  for (const p of programs) {
    if (!ids.has(p.id)) {
      out.set(p.id, []);
      continue;
    }
    const placement = await resolvePlacement(studentId, p.id, cycleId);
    out.set(
      p.id,
      await groupOptionsForStudent(studentId, p.id, cycleId, {
        levelId: placement?.levelId ?? null,
        age,
        programCapacity: p.studentCapacity,
      }),
    );
  }
  return out;
}

/** En qué grupo quedó ya inscrito (null si el programa no tiene grupos o no está inscrito). */
export async function enrolledGroupId(
  studentId: string,
  programId: string,
  cycleId: string,
): Promise<string | null> {
  const e = await prisma.enrollment.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: { programGroupId: true },
  });
  return e?.programGroupId ?? null;
}

/**
 * El grupo que le toca cuando no hay que preguntarle nada a nadie: si solo le
 * cuadra uno, ese. Con dos o más, null — la elección es de la familia (o de quien
 * inscribe), y adivinarla la metería en el horario equivocado.
 */
export function soleGroup(options: GroupOption[]): GroupOption | null {
  const libres = options.filter((g) => !g.full);
  return libres.length === 1 ? libres[0] : null;
}
