import "server-only";
import { prisma } from "@/lib/prisma";
import type { Coordination, Role, StudentStatus } from "@/lib/generated/prisma/client";
import { ageFrom } from "@/lib/utils";
import { effectiveSlots } from "@/lib/enrollment-rules";
import { buildAttendanceSheets, fromDateKey } from "@/lib/schedule";

/**
 * Números de arriba del panel. `cycleId` acota lo que es DEL CICLO y no de la casa:
 * las inscripciones activas se contaban de todos los ciclos juntos, así que el número
 * crecía para siempre y no decía nada de lo que está corriendo hoy.
 */
export async function getDashboardStats(cycleId?: string) {
  const [
    activeStudents,
    totalStudents,
    activePrograms,
    activeEnrollments,
    evaluationsThisMonth,
    recentEvaluations,
    programsWithCounts,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVO" } }),
    prisma.student.count(),
    prisma.program.count({ where: { active: true } }),
    prisma.enrollment.count({
      where: { status: "ACTIVA", ...(cycleId ? { cycleId } : {}) },
    }),
    prisma.evaluation.count({
      where: {
        date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.evaluation.findMany({
      take: 6,
      orderBy: { date: "desc" },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        program: { select: { name: true, color: true } },
        evaluator: { select: { name: true } },
      },
    }),
    prisma.program.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        _count: {
          select: {
            enrollments: { where: { status: "ACTIVA", ...(cycleId ? { cycleId } : {}) } },
          },
        },
      },
      orderBy: { enrollments: { _count: "desc" } },
    }),
  ]);

  return {
    activeStudents,
    totalStudents,
    activePrograms,
    activeEnrollments,
    evaluationsThisMonth,
    recentEvaluations,
    programsWithCounts,
  };
}

/**
 * Cuántas terapeutas ya cerraron sus calificaciones FINALES del ciclo.
 *
 * "Ya cerró" es todo o nada: le puso calificación final a cada participante inscrito
 * en cada programa que tiene a su cargo. Media captura no es un cierre — es justo lo
 * que dirección necesita perseguir, así que contarla como hecha escondería el trabajo
 * que falta.
 *
 * En el denominador solo van las que TIENEN a quién calificar: una terapeuta con un
 * programa sin nadie inscrito no debe salir como pendiente para siempre.
 */
export async function getFinalGradingProgress(cycleId: string) {
  const [programs, enrollments, graded] = await Promise.all([
    prisma.program.findMany({
      where: { active: true, teacherId: { not: null }, cycles: { some: { id: cycleId } } },
      select: { id: true, teacherId: true, teacher: { select: { id: true, name: true } } },
    }),
    prisma.enrollment.findMany({
      where: { cycleId, status: "ACTIVA" },
      select: { studentId: true, programId: true },
    }),
    // Solo las que ya tienen nota final: las demás no dicen nada aquí.
    prisma.levelRecord.findMany({
      where: { cycleId, finalScore: { not: null } },
      select: { studentId: true, programId: true },
    }),
  ]);

  const teacherOf = new Map(programs.map((p) => [p.id, p.teacher!]));
  const calificado = new Set(graded.map((g) => `${g.studentId}:${g.programId}`));

  // Por terapeuta: cuántos le tocan y cuántos lleva.
  const total = new Map<string, { name: string; pendientes: number }>();
  for (const e of enrollments) {
    const teacher = teacherOf.get(e.programId);
    if (!teacher) continue; // programa sin terapeuta a cargo: no es de nadie
    const fila = total.get(teacher.id) ?? { name: teacher.name, pendientes: 0 };
    if (!calificado.has(`${e.studentId}:${e.programId}`)) fila.pendientes++;
    total.set(teacher.id, fila);
  }

  const conPendientes = [...total.values()].filter((t) => t.pendientes > 0).length;
  return {
    /** Terapeutas que ya cerraron todo lo suyo. */
    done: total.size - conPendientes,
    /** Terapeutas con algo que calificar en el ciclo. */
    total: total.size,
  };
}

export async function listStudents(query?: string, status?: StudentStatus) {
  const q = query?.trim();
  return prisma.student.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            // insensitive: que buscar en minúsculas o mayúsculas dé lo mismo.
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { guardianName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { enrollments: { where: { status: "ACTIVA" } }, evaluations: true } },
    },
  });
}

/**
 * Cuántos participantes hay por estado, respetando la búsqueda activa. Alimenta los
 * contadores de los filtros: el conteo debe ser el de lo que el filtro mostraría, no
 * el total del padrón.
 */
export async function countStudentsByStatus(query?: string) {
  const q = query?.trim();
  const rows = await prisma.student.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { guardianName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
  });
  const counts = { ACTIVO: 0, INACTIVO: 0, EGRESADO: 0 } as Record<StudentStatus, number>;
  for (const r of rows) counts[r.status] = r._count._all;
  return { ...counts, TOTAL: counts.ACTIVO + counts.INACTIVO + counts.EGRESADO };
}

export async function getStudent(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      account: { select: { username: true, initialPassword: true, active: true } },
      health: true,
      enrollments: {
        include: { program: true },
        orderBy: { startDate: "desc" },
      },
    },
  });
}

/** Datos para el formulario de primer ingreso del tutor (prefill + estado de onboarding). */
export async function getOnboardingData(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      gender: true,
      guardianName: true,
      guardianPhone: true,
      guardianEmail: true,
      address: true,
      onboardingCompletedAt: true,
      privacyAcceptedAt: true,
      rulesAcceptedAt: true,
      consentVersion: true,
      health: true,
    },
  });
}

/** Datos propios del alumno para su espacio (solo su expediente y programas activos).
 *  Con el ciclo activo, trae el nivel donde está ubicado en cada programa para poder
 *  mostrar el horario de SU nivel (los programas por niveles separan horario). */
export async function getStudentSpace(studentId: string, activeCycleId?: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: {
      firstName: true,
      lastName: true,
      matricula: true,
      onboardingCompletedAt: true,
      consentVersion: true,
      // Nivel del alumno por programa en el ciclo activo: mapea programId → nivel.
      levelRecords: activeCycleId
        ? {
            where: { cycleId: activeCycleId },
            select: { programId: true, programLevelId: true },
          }
        : false,
      enrollments: {
        where: { status: "ACTIVA" },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          program: {
            select: {
              id: true,
              name: true,
              color: true,
              area: true,
              teacher: { select: { name: true } },
              scheduleSlots: {
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                select: {
                  weekday: true,
                  startTime: true,
                  endTime: true,
                  programLevelId: true,
                },
              },
            },
          },
        },
      },
      // Las anotaciones visibles ya no salen de aquí: viven en la bandeja de
      // mensajes (listFamilyMessages), junto con los avisos de la dirección.
      attendance: {
        orderBy: { session: { date: "desc" } },
        take: 12,
        select: {
          id: true,
          status: true,
          note: true,
          session: {
            select: { date: true, program: { select: { name: true, color: true } } },
          },
        },
      },
    },
  });
}

/**
 * Programas, opcionalmente solo los ofertados en un ciclo. Los contadores de
 * inscripciones también se acotan al ciclo: "cuántos alumnos tiene Cocina" solo
 * significa algo dentro de un periodo.
 */
export async function listPrograms(cycleId?: string) {
  return prisma.program.findMany({
    where: cycleId ? { cycles: { some: { id: cycleId } } } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      teacher: { select: { id: true, name: true } },
      cycles: { select: { id: true } },
      levels: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true },
      },
      scheduleSlots: {
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          weekday: true,
          startTime: true,
          endTime: true,
          programLevelId: true,
        },
      },
      _count: {
        select: {
          enrollments: {
            where: { status: "ACTIVA", ...(cycleId ? { cycleId } : {}) },
          },
          evaluations: true,
        },
      },
    },
  });
}

/** Personal disponible para poner a cargo de un programa (quien puede calificarlo). */
export async function listTeachers() {
  return prisma.user.findMany({
    where: { role: { in: ["DIRECTORA", "COORDINADOR", "TERAPEUTA"] }, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Programas a los que se puede inscribir. Se acota a la oferta de un ciclo: inscribir
 * a uno fuera de ella lo rechaza addEnrollment, así que ofrecerlo sería un fallo
 * silencioso (el usuario elige y no pasa nada).
 */
export async function listActivePrograms(cycleId?: string) {
  return prisma.program.findMany({
    where: {
      active: true,
      ...(cycleId ? { cycles: { some: { id: cycleId } } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, area: true, ageMin: true, ageMax: true },
  });
}

/**
 * Cuánta actividad tiene cada ciclo (inscripciones + ubicaciones de nivel). Sirve para
 * elegir un origen útil por defecto en el asistente de cambio de ciclo: proponer un
 * ciclo vacío como origen deja la pantalla sin nada que palomear.
 */
export async function getCycleActivity(): Promise<Map<string, number>> {
  const [enrolls, records] = await Promise.all([
    prisma.enrollment.groupBy({ by: ["cycleId"], _count: { _all: true } }),
    prisma.levelRecord.groupBy({ by: ["cycleId"], _count: { _all: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const e of enrolls) counts.set(e.cycleId, (counts.get(e.cycleId) ?? 0) + e._count._all);
  for (const r of records) counts.set(r.cycleId, (counts.get(r.cycleId) ?? 0) + r._count._all);
  return counts;
}

/**
 * Datos para el asistente de cambio de ciclo: quiénes participaron en el ciclo origen
 * (por inscripción o por ubicación de nivel), con sus programas y el nivel donde
 * quedaron, y si sus programas están en la oferta del ciclo destino (a esos se copia).
 * Marca a quién ya se le copió (ya tiene inscripción en el destino).
 */
export async function getCycleContinuity(fromCycleId: string, toCycleId: string) {
  const [enrolls, records, targetPrograms, targetEnrolls] = await Promise.all([
    prisma.enrollment.findMany({
      where: { cycleId: fromCycleId },
      select: {
        student: { select: { id: true, firstName: true, lastName: true, status: true } },
        program: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.levelRecord.findMany({
      where: { cycleId: fromCycleId },
      select: {
        student: { select: { id: true, firstName: true, lastName: true, status: true } },
        program: { select: { id: true, name: true, color: true } },
        level: { select: { id: true, name: true, order: true } },
      },
    }),
    prisma.program.findMany({
      where: { cycles: { some: { id: toCycleId } } },
      select: { id: true },
    }),
    prisma.enrollment.findMany({
      where: { cycleId: toCycleId },
      select: { studentId: true },
    }),
  ]);

  const targetOffer = new Set(targetPrograms.map((p) => p.id));
  const alreadyInTarget = new Set(targetEnrolls.map((e) => e.studentId));

  // Niveles de cada programa, para saber cuál sigue después del que traen.
  const levels = await prisma.programLevel.findMany({
    orderBy: [{ programId: "asc" }, { order: "asc" }],
    select: { id: true, name: true, order: true, programId: true },
  });
  const nextLevelOf = new Map<string, { id: string; name: string }>();
  for (const l of levels) {
    const next = levels.find((n) => n.programId === l.programId && n.order > l.order);
    if (next) nextLevelOf.set(l.id, { id: next.id, name: next.name });
  }

  type Prog = {
    id: string;
    name: string;
    color: string | null;
    levelName: string | null;
    /// Nombre del nivel que sigue, si lo hay: sin esto no se puede ofrecer "subir".
    nextLevelName: string | null;
    inTargetOffer: boolean;
  };
  type Row = {
    id: string;
    name: string;
    status: string;
    alreadyInTarget: boolean;
    programs: Map<string, Prog>;
  };
  const byStudent = new Map<string, Row>();

  function ensure(student: { id: string; firstName: string; lastName: string; status: string }) {
    let row = byStudent.get(student.id);
    if (!row) {
      row = {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        status: student.status,
        alreadyInTarget: alreadyInTarget.has(student.id),
        programs: new Map(),
      };
      byStudent.set(student.id, row);
    }
    return row;
  }

  for (const e of enrolls) {
    const row = ensure(e.student);
    if (!row.programs.has(e.program.id)) {
      row.programs.set(e.program.id, {
        id: e.program.id,
        name: e.program.name,
        color: e.program.color,
        levelName: null,
        nextLevelName: null,
        inTargetOffer: targetOffer.has(e.program.id),
      });
    }
  }
  for (const r of records) {
    const row = ensure(r.student);
    const existing = row.programs.get(r.program.id);
    const next = nextLevelOf.get(r.level.id)?.name ?? null;
    if (existing) {
      existing.levelName = r.level.name; // la ubicación de nivel gana como "dónde quedó"
      existing.nextLevelName = next;
    } else {
      row.programs.set(r.program.id, {
        id: r.program.id,
        name: r.program.name,
        color: r.program.color,
        levelName: r.level.name,
        nextLevelName: next,
        inTargetOffer: targetOffer.has(r.program.id),
      });
    }
  }

  const students = [...byStudent.values()]
    .map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      alreadyInTarget: r.alreadyInTarget,
      programs: [...r.programs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { copyableCount: targetOffer.size, students };
}

/** Ciclos por temporada, del más reciente al más antiguo, con el tamaño de su oferta. */
export async function listCycles() {
  // La temporada es alfabéticamente cronológica: ENE_JUN < JUL_AGO < SEP_DIC.
  return prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { season: "asc" }],
    include: { _count: { select: { programs: true } } },
  });
}

/** Ciclo vigente para registrar (marcado activo); si no hay, el más reciente. */
export async function getActiveCycle() {
  const active = await prisma.cycle.findFirst({
    where: { active: true },
    orderBy: [{ year: "desc" }, { season: "asc" }],
  });
  return active ?? prisma.cycle.findFirst({ orderBy: [{ year: "desc" }, { season: "desc" }] });
}

/** Ubicaciones de nivel de un alumno en un ciclo (una por programa). */
export async function getStudentLevels(studentId: string, cycleId: string) {
  return prisma.levelRecord.findMany({
    where: { studentId, cycleId },
    include: {
      program: { select: { id: true, name: true, color: true, area: true } },
      level: { select: { id: true, name: true, order: true } },
    },
    orderBy: { program: { name: "asc" } },
  });
}

/**
 * Línea de tiempo del participante: su historia entre ciclos, programa por programa.
 * Para cada ciclo dice en qué nivel estuvo, con qué calificación empezó y cerró, y si
 * subió de nivel respecto al ciclo anterior. El dato ya vive en LevelRecord; esto solo
 * lo cuenta como historia (ordenado del ciclo más reciente al más antiguo).
 */
export async function getStudentTimeline(studentId: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId },
    select: {
      id: true,
      placement: true,
      gradedAt: true,
      initialScore: true,
      finalScore: true,
      program: { select: { id: true, name: true, color: true } },
      level: { select: { id: true, name: true, order: true } },
      cycle: { select: { id: true, label: true, year: true, season: true } },
    },
  });
  if (records.length === 0) return [];

  // Orden cronológico del ciclo: año + temporada (ENE_JUN < JUL_AGO < SEP_DIC).
  const cycleRank = (year: number, season: string) =>
    year * 10 + (season === "ENE_JUN" ? 1 : season === "JUL_AGO" ? 2 : 3);

  type Entry = {
    recordId: string;
    cycle: { id: string; label: string };
    levelName: string;
    levelOrder: number;
    placement: string;
    initialScore: number | null;
    finalScore: number | null;
    gradedAt: Date;
    leveledUp: boolean;
    rank: number;
  };

  // Agrupa por programa.
  const byProgram = new Map<
    string,
    { program: { id: string; name: string; color: string | null }; entries: Entry[] }
  >();

  for (const r of records) {
    let group = byProgram.get(r.program.id);
    if (!group) {
      group = { program: { id: r.program.id, name: r.program.name, color: r.program.color }, entries: [] };
      byProgram.set(r.program.id, group);
    }
    group.entries.push({
      recordId: r.id,
      cycle: { id: r.cycle.id, label: r.cycle.label },
      levelName: r.level.name,
      levelOrder: r.level.order,
      placement: r.placement,
      initialScore: r.initialScore,
      finalScore: r.finalScore,
      gradedAt: r.gradedAt,
      leveledUp: false,
      rank: cycleRank(r.cycle.year, r.cycle.season),
    });
  }

  // Ordena cada programa de más reciente a más antiguo y marca cuándo subió de nivel.
  const groups = [...byProgram.values()].map((g) => {
    g.entries.sort((a, b) => b.rank - a.rank);
    // Recorre de viejo a nuevo para detectar el salto de nivel respecto al anterior.
    for (let i = g.entries.length - 1; i >= 0; i--) {
      const older = g.entries[i + 1];
      if (older && g.entries[i].levelOrder > older.levelOrder) {
        g.entries[i].leveledUp = true;
      }
    }
    return g;
  });

  // Programas con historia más reciente primero.
  groups.sort((a, b) => (b.entries[0]?.rank ?? 0) - (a.entries[0]?.rank ?? 0));
  return groups;
}

/**
 * Historial COMPLETO de calificaciones de un alumno, ciclo por ciclo: en cada ciclo,
 * su nivel en cada programa, con qué calificación empezó y con cuál cerró, y la fecha
 * del registro. Es el mismo dato de LevelRecord que el "proceso", pero abierto a TODOS
 * los ciclos (no solo el activo). Con `programId` se acota a una asignatura. Ordenado
 * del ciclo más reciente al más antiguo.
 */
export async function getStudentGradeHistory(studentId: string, programId?: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId, ...(programId ? { programId } : {}) },
    select: {
      id: true,
      placement: true,
      gradedAt: true,
      note: true,
      initialScore: true,
      finalScore: true,
      program: { select: { id: true, name: true, color: true } },
      cycle: { select: { id: true, label: true, year: true, season: true } },
      level: { select: { id: true, name: true, order: true, description: true } },
    },
  });
  if (records.length === 0) return [];

  const cycleRank = (year: number, season: string) =>
    year * 10 + (season === "ENE_JUN" ? 1 : season === "JUL_AGO" ? 2 : 3);

  type Entry = {
    recordId: string;
    cycle: { id: string; label: string };
    levelName: string;
    levelDescription: string | null;
    placement: string;
    gradedAt: Date;
    note: string | null;
    initialScore: number | null;
    finalScore: number | null;
    rank: number;
  };

  const byProgram = new Map<
    string,
    { program: { id: string; name: string; color: string | null }; entries: Entry[] }
  >();

  for (const r of records) {
    let group = byProgram.get(r.program.id);
    if (!group) {
      group = {
        program: { id: r.program.id, name: r.program.name, color: r.program.color },
        entries: [],
      };
      byProgram.set(r.program.id, group);
    }
    group.entries.push({
      recordId: r.id,
      cycle: { id: r.cycle.id, label: r.cycle.label },
      levelName: r.level.name,
      levelDescription: r.level.description,
      placement: r.placement,
      gradedAt: r.gradedAt,
      note: r.note,
      initialScore: r.initialScore,
      finalScore: r.finalScore,
      rank: cycleRank(r.cycle.year, r.cycle.season),
    });
  }

  return [...byProgram.values()]
    .map((g) => ({ program: g.program, entries: g.entries.sort((a, b) => b.rank - a.rank) }))
    .sort((a, b) => a.program.name.localeCompare(b.program.name));
}

/** Datos básicos de un programa (para la vista de calificación). */
export async function getProgramBasics(programId: string) {
  return prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, name: true, color: true },
  });
}

/**
 * Datos para calificar: en qué nivel está ubicado el alumno en ese programa/ciclo y
 * qué calificación (inicial y final, 1–4) lleva registrada. Devuelve null si todavía
 * no está ubicado en un nivel: primero se ubica, luego se califica.
 */
export async function getGradingData(studentId: string, programId: string, cycleId: string) {
  const record = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: {
      initialScore: true,
      finalScore: true,
      note: true,
      placement: true,
      gradedAt: true,
      level: { select: { id: true, name: true, order: true, description: true } },
    },
  });
  if (!record) return null;
  return record;
}

/** Programas que tienen niveles definidos, con su lista de niveles ordenada. */
export async function listProgramsWithLevels() {
  return prisma.program.findMany({
    where: { levels: { some: {} } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      area: true,
      teacherId: true, // para acotar a la terapeuta a los programas a su cargo
      coordination: true, // y a la coordinación a los de la suya
      levels: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, description: true } },
    },
  });
}

/**
 * Programas para el calendario del equipo: activos, de la oferta del ciclo y con
 * su horario estructurado. Se puede acotar a los de una terapeuta (teacherId) o a
 * los de una coordinación —incluyendo siempre los que no tienen ninguna asignada,
 * para que un campo vacío no deje un programa sin quien lo vea.
 */
export async function listCalendarPrograms(
  cycleId?: string,
  teacherId?: string,
  coordination?: Coordination | null,
) {
  return prisma.program.findMany({
    where: {
      active: true,
      ...(cycleId ? { cycles: { some: { id: cycleId } } } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(coordination ? { OR: [{ coordination }, { coordination: null }] } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      area: true,
      teacher: { select: { id: true, name: true } },
      scheduleSlots: {
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        select: {
          weekday: true,
          startTime: true,
          endTime: true,
          programLevelId: true,
          level: { select: { name: true } },
        },
      },
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVA", ...(cycleId ? { cycleId } : {}) } },
        },
      },
    },
  });
}

/**
 * Todo lo que necesita el panel de una clase en una fecha: el programa, su grupo
 * del ciclo, la sesión de ese día (bitácora + asistencia) y las anotaciones
 * recientes sobre alumnos de este programa.
 */
export async function getClassPanel(programId: string, dateKey: string, cycleId?: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const [program, enrollments, session, notes] = await Promise.all([
    prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        schedule: true,
        teacher: { select: { name: true } },
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: {
            weekday: true,
            startTime: true,
            endTime: true,
            programLevelId: true,
            level: { select: { name: true } },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: { programId, status: "ACTIVA", ...(cycleId ? { cycleId } : {}) },
      orderBy: { student: { firstName: "asc" } },
      select: {
        student: { select: { id: true, firstName: true, lastName: true, matricula: true } },
      },
    }),
    prisma.classSession.findUnique({
      where: { programId_date: { programId, date } },
      select: {
        notes: true,
        canceled: true,
        cancelReason: true,
        attendance: {
          select: { studentId: true, status: true, note: true },
        },
      },
    }),
    prisma.studentNote.findMany({
      where: { programId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        body: true,
        visibleToFamily: true,
        createdAt: true,
        authorId: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        author: { select: { name: true } },
      },
    }),
  ]);
  return { program, students: enrollments.map((e) => e.student), session, notes };
}

/**
 * Oferta del ciclo tal como la ve una familia: actividades con horario, cupo
 * ocupado y las reservas/inscripciones que ese alumno ya tiene, para saber qué
 * puede apartar todavía.
 *
 * Cada actividad viene ya juzgada con las reglas de inscripción, para que la
 * pantalla no ofrezca lo que la acción va a rechazar:
 *   • `ageOk`   — cumple el rango de edad (si no, ni se le enseña a la familia).
 *   • `dropped` — dirección lo dio de baja de esta actividad en el ciclo.
 *   • `allowFamilyEnroll` — si está apagado, el grupo lo arma dirección.
 * Y `load`, que es del participante y no de la actividad: cuántas lleva de las que
 * permite el ciclo.
 *
 * El EMPALME no viene resuelto de aquí: la familia arma su selección palomeando, así
 * que el choque depende de lo que lleve palomeado en ese momento y no de lo que ya
 * tiene inscrito. Por eso va el `slots` de cada actividad —ya recortado al nivel que
 * le toca— y el empalme lo calcula la pantalla contra la selección viva, con las
 * mismas funciones de `lib/schedule` que usa el servidor al recibir el envío.
 *
 * `submittedAt` es la firma: en cuanto la familia manda su selección, el listado se
 * congela (se le advierte antes de mandarla). `enrollmentOpen` es la llave de la
 * dirección sobre toda la ventanilla.
 */
export async function getFamilyOffer(studentId: string, cycleId: string) {
  const [student, cycle, programs, reservations, enrollments, submission] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { birthDate: true },
    }),
    prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { maxEnrollments: true, enrollmentOpen: true },
    }),
    prisma.program.findMany({
      where: { active: true, cycles: { some: { id: cycleId } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        ageMin: true,
        ageMax: true,
        studentCapacity: true,
        allowFamilyEnroll: true,
        teacher: { select: { name: true } },
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: { weekday: true, startTime: true, endTime: true, programLevelId: true },
        },
        _count: {
          select: { enrollments: { where: { status: "ACTIVA", cycleId } } },
        },
      },
    }),
    prisma.reservation.findMany({
      where: { studentId, cycleId },
      select: { id: true, programId: true, status: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      where: { studentId, cycleId, status: "ACTIVA" },
      select: { programId: true },
    }),
    prisma.enrollmentSubmission.findUnique({
      where: { studentId_cycleId: { studentId, cycleId } },
      select: { submittedAt: true, programCount: true },
    }),
  ]);

  const enrolledProgramIds = new Set(enrollments.map((e) => e.programId));
  // Horario que de verdad le toca en cada actividad (el de su nivel, cuando el
  // programa parte el horario por niveles). Es lo que la pantalla necesita para
  // juzgar los empalmes de la selección sin volver a preguntarle al servidor.
  const slotsOf = await effectiveSlots(studentId, cycleId, programs);
  const dropped = new Set(
    reservations.filter((r) => r.status === "RECHAZADA").map((r) => r.programId),
  );
  const age = ageFrom(student?.birthDate);
  // La carga sale de lo que ya trajimos: `enrollments` son justo las ACTIVA del
  // ciclo, así que el tope no cuesta ninguna consulta más.
  const max = cycle?.maxEnrollments ?? null;

  return {
    birthDate: student?.birthDate ?? null,
    enrollmentOpen: cycle?.enrollmentOpen ?? true,
    submittedAt: submission?.submittedAt ?? null,
    load: {
      current: enrollments.length,
      max,
      full: max != null && enrollments.length >= max,
    },
    programs: programs.map((p) => ({
      ...p,
      ageOk: meetsAgeRequirement(age, p.ageMin, p.ageMax),
      dropped: dropped.has(p.id),
      slots: slotsOf.get(p.id) ?? [],
    })),
    reservations,
    enrolledProgramIds,
  };
}

/**
 * ¿El participante cumple el requisito de edad de un programa? Si el programa no
 * pide edad, o no conocemos la fecha de nacimiento, no se bloquea (el requisito
 * lo termina de revisar dirección al aprobar).
 */
export function meetsAgeRequirement(
  age: number | null,
  ageMin: number | null,
  ageMax: number | null,
): boolean {
  if (age == null) return true;
  if (ageMin != null && age < ageMin) return false;
  if (ageMax != null && age > ageMax) return false;
  return true;
}

/**
 * Últimos lugares apartados por las familias (para la tarjeta del panel de
 * dirección). Ya no hay nada que aprobar: es un enterado de quién se inscribió
 * solo, con el cupo del programa a la vista.
 *
 * `decidedById` vacío es justo eso: lo movió la familia y nadie del equipo. Las
 * altas y bajas que decide dirección quedan en la misma tabla, pero firmadas, y
 * aquí no pintan nada.
 */
export async function listRecentFamilyReservations(limit = 8) {
  const recent = await prisma.reservation.findMany({
    where: { status: "APROBADA", decidedById: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      cycleId: true,
      student: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
      program: {
        select: { id: true, name: true, color: true, studentCapacity: true },
      },
    },
  });
  // Cupo ocupado por programa+ciclo, para ver de un vistazo qué tan lleno quedó.
  const seats = await Promise.all(
    recent.map((r) =>
      prisma.enrollment.count({
        where: { programId: r.program.id, cycleId: r.cycleId, status: "ACTIVA" },
      }),
    ),
  );
  return recent.map((r, i) => ({ ...r, occupied: seats[i] }));
}

/**
 * Alumnos con AUSENCIAS SEGUIDAS (3+) en un programa, mirando las últimas
 * sesiones registradas. Las sesiones donde no se les marcó nada no rompen la
 * racha (una lista sin pasar no es una asistencia). Si se da teacherId, se
 * acota a los programas de esa terapeuta.
 */
export async function getAbsenceAlerts(teacherId?: string) {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sessions = await prisma.classSession.findMany({
    where: {
      date: { gte: since },
      canceled: false,
      ...(teacherId ? { program: { teacherId } } : {}),
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      program: { select: { id: true, name: true, color: true } },
      attendance: {
        select: {
          status: true,
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Recorre por alumno+programa de la sesión más reciente hacia atrás.
  type Alert = {
    student: { id: string; firstName: string; lastName: string };
    program: { id: string; name: string; color: string | null };
    streak: number;
  };
  const streaks = new Map<string, Alert & { broken: boolean }>();
  for (const session of sessions) {
    for (const a of session.attendance) {
      const key = `${a.student.id}:${session.program.id}`;
      let entry = streaks.get(key);
      if (!entry) {
        entry = { student: a.student, program: session.program, streak: 0, broken: false };
        streaks.set(key, entry);
      }
      if (entry.broken) continue;
      if (a.status === "AUSENTE") entry.streak += 1;
      else entry.broken = true; // asistió (o justificó): la racha termina aquí
    }
  }
  return [...streaks.values()]
    .filter((e) => e.streak >= 3)
    .sort((a, b) => b.streak - a.streak)
    .map(({ student, program, streak }) => ({ student, program, streak }));
}

/** Sesiones de un programa (bitácoras) con resumen de asistencia, recientes primero. */
export async function listProgramSessions(programId: string) {
  return prisma.classSession.findMany({
    where: { programId },
    orderBy: { date: "desc" },
    take: 60,
    select: {
      id: true,
      date: true,
      notes: true,
      canceled: true,
      cancelReason: true,
      attendance: { select: { status: true } },
    },
  });
}

/** Anuncios que le tocan a un alumno: los generales (si está activo) y los dirigidos a él. */
export async function listAnnouncementsFor(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { status: true },
  });
  return prisma.announcement.findMany({
    where: {
      OR: [
        ...(student?.status === "ACTIVO" ? [{ toAllActive: true }] : []),
        { recipients: { some: { studentId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
}

export type FamilyMessage = {
  id: string;
  /** De dónde viene: la dirección o la terapeuta de un programa. */
  kind: "AVISO" | "ANOTACION";
  title: string | null;
  body: string;
  createdAt: Date;
  /** Quién firma. Los avisos van firmados por la casa, no por quien los escribió. */
  author: string;
  program: { name: string; color: string | null } | null;
};

/**
 * TODOS los mensajes que le han llegado a una familia, en una sola bandeja: los
 * avisos de la dirección y las anotaciones que el equipo marcó como visibles.
 *
 * Van juntos porque para la familia son lo mismo —cosas que Gigi's le dijo— y
 * tenerlos en dos listas obligaba a revisar dos lugares para saber si hay algo
 * nuevo. Se mezclan en memoria: son dos consultas acotadas, no vale la pena una
 * tabla de por medio.
 */
export async function listFamilyMessages(
  studentId: string,
  opts?: { take?: number },
): Promise<FamilyMessage[]> {
  const take = opts?.take ?? 100;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { status: true },
  });
  const [announcements, notes] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        OR: [
          ...(student?.status === "ACTIVO" ? [{ toAllActive: true }] : []),
          { recipients: { some: { studentId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
    prisma.studentNote.findMany({
      where: { studentId, visibleToFamily: true },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
        program: { select: { name: true, color: true } },
      },
    }),
  ]);

  const mensajes: FamilyMessage[] = [
    ...announcements.map((a) => ({
      id: `aviso-${a.id}`,
      kind: "AVISO" as const,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      // Para la familia el remitente es la casa, no la persona que lo escribió.
      author: "Dirección Gigi's",
      program: null,
    })),
    ...notes.map((n) => ({
      id: `nota-${n.id}`,
      kind: "ANOTACION" as const,
      title: null,
      body: n.body,
      createdAt: n.createdAt,
      author: n.author?.name ?? "Equipo Gigi's",
      program: n.program,
    })),
  ];
  return mensajes
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}

/** Próximas clases suspendidas de los programas donde el alumno está inscrito. */
export async function listUpcomingSuspensionsFor(studentId: string) {
  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  return prisma.classSession.findMany({
    where: {
      canceled: true,
      date: { gte: todayUTC },
      program: {
        enrollments: { some: { studentId, status: "ACTIVA" } },
      },
    },
    orderBy: { date: "asc" },
    take: 6,
    select: {
      id: true,
      date: true,
      cancelReason: true,
      program: { select: { name: true, color: true } },
    },
  });
}

/** Todos los anuncios publicados, para administrarlos en /avisos. */
export async function listAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      toAllActive: true,
      createdAt: true,
      author: { select: { name: true } },
      recipients: {
        select: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
}

/** Sesiones suspendidas en un rango de fechas (para tachar clases en el calendario). */
export async function listCanceledSessions(fromKey: string, toKey: string) {
  return prisma.classSession.findMany({
    where: {
      canceled: true,
      date: {
        gte: new Date(`${fromKey}T00:00:00.000Z`),
        lte: new Date(`${toKey}T00:00:00.000Z`),
      },
    },
    select: { programId: true, date: true, cancelReason: true },
  });
}

/**
 * Eventos internos de la semana (juntas, capacitaciones, visitas…). Solo para el
 * equipo: esta consulta no debe alimentar ninguna pantalla de familias.
 */
export async function listCalendarEvents(fromKey: string, toKey: string) {
  return prisma.calendarEvent.findMany({
    where: {
      date: {
        gte: new Date(`${fromKey}T00:00:00.000Z`),
        lte: new Date(`${toKey}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      notes: true,
      color: true,
      author: { select: { name: true } },
    },
  });
}

/**
 * Bitácora de cambios (auditoría), de lo más reciente a lo más antiguo. Solo la
 * consulta la dirección. Si se pasa studentId, se acota a ese participante (para
 * mostrar su actividad dentro del expediente).
 */
export async function listAuditLog(opts?: { studentId?: string; take?: number }) {
  return prisma.auditLog.findMany({
    where: opts?.studentId ? { studentId: opts.studentId } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 150,
    select: {
      id: true,
      action: true,
      summary: true,
      actorName: true,
      actorRole: true,
      createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    // Solo cuentas del equipo. Las cuentas de alumno se administran desde
    // el módulo de estudiantes (son cientos y tienen otro flujo).
    where: { role: { not: "ALUMNO" } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      coordination: true,
      active: true,
      createdAt: true,
      // Contraseña inicial de la cuenta, para poder entregarla. Confidencial: la
      // pantalla solo se la pasa al componente cuando quien mira es la directora.
      initialPassword: true,
      _count: { select: { evaluations: true } },
    },
  });
}

// ── Donativos ───────────────────────────────────────────────────────────────

/** Medianoche UTC del día de hoy: base para comparar contra fechas @db.Date. */
function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** ¿La prórroga sigue vigente? (válida hasta `graceUntil` inclusive) */
function graceIsValid(status: string, graceUntil: Date | null) {
  return status === "GRACIA" && graceUntil != null && graceUntil >= todayUTC();
}

/** ¿El aporte cuenta como cumplido (no bloquea)? */
function contributionSatisfied(
  c: { status: string; graceUntil: Date | null } | undefined | null,
) {
  if (!c) return false;
  return c.status === "CUMPLIDO" || graceIsValid(c.status, c.graceUntil);
}

/**
 * ¿Ya llegó la fecha límite? La restricción de una campaña obligatoria NO arranca
 * al crearla: solo empieza cuando llega su fecha límite. Sin fecha límite no hay
 * momento en que bloquee (queda como recordatorio pendiente).
 */
function deadlineReached(dueDate: Date | null) {
  return dueDate != null && todayUTC() >= dueDate;
}

/**
 * Campañas OBLIGATORIAS que HOY restringen apartar clases: activas, con su fecha
 * límite ya cumplida, sin prórroga vigente y sin haber cumplido. Vacío = puede
 * inscribir. Antes de la fecha límite no bloquean (solo corre el countdown).
 */
export async function familyDonationHold(studentId: string) {
  const campaigns = await prisma.donationCampaign.findMany({
    where: { active: true, mandatory: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      goalLabel: true,
      goalAmount: true,
      dueDate: true,
      contributions: {
        where: { studentId },
        select: { status: true, graceUntil: true },
      },
    },
  });
  return campaigns
    .filter(
      (c) => deadlineReached(c.dueDate) && !contributionSatisfied(c.contributions[0]),
    )
    .map(({ contributions, ...c }) => c);
}

/**
 * Lista de asistencia para imprimir: un BLOQUE POR HORARIO del día, porque la
 * sesión de clase es única por programa+fecha y no sabe de horas — la hora sale
 * del horario del programa (ScheduleSlot), no de la sesión.
 *
 * Cuando el horario es propio de un nivel, al bloque solo van los alumnos ubicados
 * en ese nivel: la lista de las 10:00 no debe traer al grupo de las 12:00.
 *
 * Si ese día no toca clase devuelve un bloque sin hora: la casa reprograma, y
 * negarse a dar la hoja porque el horario dice otra cosa la volvería inservible.
 */
export async function getAttendanceSheet(
  programId: string,
  dateKey: string,
  cycleId: string,
) {
  const [program, cycle, enrollments, records] = await Promise.all([
    prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        teacher: { select: { name: true } },
        levels: { select: { id: true } },
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: {
            weekday: true,
            startTime: true,
            endTime: true,
            programLevelId: true,
            level: { select: { name: true } },
          },
        },
      },
    }),
    prisma.cycle.findUnique({ where: { id: cycleId }, select: { label: true } }),
    prisma.enrollment.findMany({
      where: { programId, cycleId, status: "ACTIVA" },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      select: {
        student: { select: { id: true, firstName: true, lastName: true, matricula: true } },
      },
    }),
    prisma.levelRecord.findMany({
      where: { programId, cycleId },
      select: {
        studentId: true,
        programLevelId: true,
        level: { select: { name: true } },
      },
    }),
  ]);
  if (!program || !cycle) return null;

  const date = fromDateKey(dateKey);
  const nivelDe = new Map(
    records.map((r) => [r.studentId, { id: r.programLevelId, name: r.level.name }]),
  );
  const alumnos = enrollments.map((e) => ({
    ...e.student,
    levelId: nivelDe.get(e.student.id)?.id ?? null,
    levelName: nivelDe.get(e.student.id)?.name ?? null,
  }));

  const daySlots = program.scheduleSlots.filter((s) => s.weekday === date.getDay());

  return {
    program,
    cycle,
    date,
    hasLevels: program.levels.length > 0,
    // Si el día no toca clase se dice, para que quien imprima sepa por qué sale una
    // sola hoja sin hora.
    isClassDay: daySlots.length > 0,
    // El reparto en hojas (una por horario, y por nivel cuando el horario es de un
    // nivel) vive en lib/schedule: es la única parte con reglas.
    sheets: buildAttendanceSheets(
      daySlots.map((s) => ({ ...s, levelName: s.level?.name ?? null })),
      alumnos,
    ),
  };
}

/**
 * El grupo entero de una actividad en un ciclo: nivel, calificación (inicial y
 * final, 1–4), avance y asistencia de cada quien. Es lo que la terapeuta necesita
 * ver de un jalón para saber cómo va su grupo.
 *
 * Dos decisiones de cuenta que conviene tener claras:
 *
 *  • El DENOMINADOR de la asistencia son las clases donde SÍ se le marcó algo, no
 *    el total de sesiones. Una lista que no se pasó no genera registro, y contarla
 *    como falta le inventaría ausencias a quien sí fue (mismo criterio que ya usan
 *    las alertas de ausencia). Por eso se devuelven los dos números.
 *  • El RETARDO cuenta como que asistió (llegó, tarde). El JUSTIFICADO no cuenta
 *    ni como asistencia ni como falta: va en su propia columna.
 *
 * Las clases "del ciclo" salen de la ventana de fechas del ciclo. Si el ciclo no
 * las tiene puestas se cuentan todas las del programa y se avisa (`ventanaAbierta`),
 * porque si no el reporte saldría en ceros para los ciclos viejos.
 */
export async function getProgramAcademicReport(programId: string, cycleId: string) {
  const [program, cycle] = await Promise.all([
    prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        teacher: { select: { name: true } },
      },
    }),
    prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, label: true, startDate: true, endDate: true },
    }),
  ]);
  if (!program || !cycle) return null;

  const ventanaAbierta = cycle.startDate == null && cycle.endDate == null;
  const [enrollments, records, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { programId, cycleId, status: "ACTIVA" },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricula: true,
            birthDate: true,
          },
        },
      },
    }),
    prisma.levelRecord.findMany({
      where: { programId, cycleId },
      select: {
        studentId: true,
        placement: true,
        initialScore: true,
        finalScore: true,
        note: true,
        level: { select: { name: true, order: true } },
      },
    }),
    prisma.classSession.findMany({
      where: {
        programId,
        canceled: false,
        ...(cycle.startDate ? { date: { gte: cycle.startDate } } : {}),
        ...(cycle.endDate ? { date: { lte: cycle.endDate } } : {}),
      },
      select: { id: true },
    }),
  ]);

  const studentIds = enrollments.map((e) => e.student.id);
  const sessionIds = sessions.map((s) => s.id);
  // Todos los contadores de asistencia en UNA consulta: una por alumno volvería
  // lentísimo un grupo grande.
  const marcas =
    sessionIds.length > 0 && studentIds.length > 0
      ? await prisma.attendanceRecord.groupBy({
          by: ["studentId", "status"],
          where: { sessionId: { in: sessionIds }, studentId: { in: studentIds } },
          _count: { _all: true },
        })
      : [];

  const conteo = new Map<string, Record<string, number>>();
  for (const m of marcas) {
    const row = conteo.get(m.studentId) ?? {};
    row[m.status] = m._count._all;
    conteo.set(m.studentId, row);
  }
  const recordDe = new Map(records.map((r) => [r.studentId, r]));

  const participants = enrollments.map(({ student }) => {
    const r = recordDe.get(student.id);
    const c = conteo.get(student.id) ?? {};
    const presentes = c.PRESENTE ?? 0;
    const retardos = c.RETARDO ?? 0;
    const ausentes = c.AUSENTE ?? 0;
    const justificadas = c.JUSTIFICADO ?? 0;
    const marcadas = presentes + retardos + ausentes + justificadas;
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      matricula: student.matricula,
      age: ageFrom(student.birthDate),
      levelName: r?.level.name ?? null,
      levelOrder: r?.level.order ?? null,
      placement: r?.placement ?? null,
      note: r?.note ?? null,
      initialScore: r?.initialScore ?? null,
      finalScore: r?.finalScore ?? null,
      avance:
        r?.initialScore != null && r?.finalScore != null
          ? r.finalScore - r.initialScore
          : null,
      presentes,
      retardos,
      ausentes,
      justificadas,
      marcadas,
      // Asistió = estuvo, aunque llegara tarde. Sin lista pasada no hay porcentaje.
      asistenciaPct: marcadas > 0 ? Math.round(((presentes + retardos) / marcadas) * 100) : null,
    };
  });

  const promedio = (nums: (number | null)[]) => {
    const vals = nums.filter((n): n is number => n != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    program,
    cycle,
    ventanaAbierta,
    totalSessions: sessions.length,
    participants,
    totals: {
      total: participants.length,
      promedioInicial: promedio(participants.map((p) => p.initialScore)),
      promedioFinal: promedio(participants.map((p) => p.finalScore)),
      promedioAvance: promedio(participants.map((p) => p.avance)),
      asistenciaPromedio: promedio(participants.map((p) => p.asistenciaPct)),
    },
  };
}

/**
 * Programas del ciclo con el cupo lleno. Un solo groupBy cruzado en memoria: sin
 * esto habría que contar programa por programa.
 */
export async function listFullPrograms(cycleId: string) {
  const [programs, counts] = await Promise.all([
    prisma.program.findMany({
      where: { active: true, cycles: { some: { id: cycleId } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        studentCapacity: true,
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: { weekday: true, startTime: true, endTime: true, programLevelId: true },
        },
      },
    }),
    prisma.enrollment.groupBy({
      by: ["programId"],
      where: { cycleId, status: "ACTIVA" },
      _count: { _all: true },
    }),
  ]);
  const ocupados = new Map(counts.map((c) => [c.programId, c._count._all]));
  const esperando = await prisma.waitlistRequest.groupBy({
    by: ["programId"],
    where: { cycleId, status: "EN_ESPERA" },
    _count: { _all: true },
  });
  const enEspera = new Map(esperando.map((c) => [c.programId, c._count._all]));

  return programs
    .map((p) => ({
      ...p,
      occupied: ocupados.get(p.id) ?? 0,
      waiting: enEspera.get(p.id) ?? 0,
    }))
    .filter((p) => p.occupied >= p.studentCapacity);
}

// ── Organigrama ─────────────────────────────────────────────────────────────

export type OrgNodeView = {
  id: string;
  name: string;
  title: string | null;
  notes: string | null;
  parentId: string | null;
  order: number;
  /** Cuenta ligada, si la caja es alguien de la plataforma. */
  user: {
    id: string;
    name: string;
    role: Role;
    coordination: Coordination | null;
    active: boolean;
  } | null;
  /** Programas a su cargo, cuando la caja es una cuenta con grupos. */
  programs: { id: string; name: string; color: string | null }[];
  children: OrgNodeView[];
};

/**
 * El organigrama como árbol. Se arma a mano (hay gente sin cuenta: patronato,
 * voluntariado), pero las cajas ligadas a una cuenta muestran su rol y sus
 * programas al día, para que no haya que actualizarlos por separado.
 */
export async function getOrgChart(): Promise<OrgNodeView[]> {
  const [nodes, cycle] = await Promise.all([
    prisma.orgNode.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        notes: true,
        parentId: true,
        order: true,
        user: {
          select: { id: true, name: true, role: true, coordination: true, active: true },
        },
      },
    }),
    getActiveCycle(),
  ]);
  if (nodes.length === 0) return [];

  // Programas a cargo de cada cuenta ligada, en el ciclo vigente.
  const userIds = nodes.map((n) => n.user?.id).filter((id): id is string => !!id);
  const programs =
    userIds.length > 0
      ? await prisma.program.findMany({
          where: {
            teacherId: { in: userIds },
            active: true,
            ...(cycle ? { cycles: { some: { id: cycle.id } } } : {}),
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true, teacherId: true },
        })
      : [];
  const porTerapeuta = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const p of programs) {
    if (!p.teacherId) continue;
    const list = porTerapeuta.get(p.teacherId) ?? [];
    list.push({ id: p.id, name: p.name, color: p.color });
    porTerapeuta.set(p.teacherId, list);
  }

  const view = new Map<string, OrgNodeView>(
    nodes.map((n) => [
      n.id,
      { ...n, programs: n.user ? porTerapeuta.get(n.user.id) ?? [] : [], children: [] },
    ]),
  );
  const raices: OrgNodeView[] = [];
  for (const n of view.values()) {
    // Un padre que ya no existe no debe desaparecer a su gente: sube a la raíz.
    const padre = n.parentId ? view.get(n.parentId) : undefined;
    if (padre) padre.children.push(n);
    else raices.push(n);
  }
  return raices;
}

/** Las cajas en lista plana, para el selector de "depende de". */
export async function listOrgNodes() {
  return prisma.orgNode.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, title: true, parentId: true },
  });
}

// ── Lista de espera ─────────────────────────────────────────────────────────

/**
 * El tablero de lista de espera como lo ve una familia: TODAS las actividades del
 * ciclo, sin esconder ninguna. A diferencia de la reja de inscripción —donde lo
 * que no puede inscribir no se le enseña— aquí ve hasta lo que no es para su edad:
 * formarse es pedir, y quien juzga es coordinación (aunque fuera de su edad ya no
 * puede pedir: es requisito de la actividad, no un lugar que se libere).
 *
 * A la familia NO se le da su número de fila: el lugar se mueve solo conforme la
 * gente entra y sale, así que enseñárselo promete un turno que nadie le prometió.
 * El orden de llegada lo sigue viendo coordinación en su tablero.
 */
export async function getFamilyWaitlistBoard(studentId: string, cycleId: string) {
  const [student, cycle, programs, enrollments, requests] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { birthDate: true } }),
    prisma.cycle.findUnique({ where: { id: cycleId }, select: { maxEnrollments: true } }),
    prisma.program.findMany({
      where: { active: true, cycles: { some: { id: cycleId } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        area: true,
        ageMin: true,
        ageMax: true,
        studentCapacity: true,
        allowFamilyEnroll: true,
        teacher: { select: { name: true } },
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: { weekday: true, startTime: true, endTime: true, programLevelId: true },
        },
        _count: { select: { enrollments: { where: { status: "ACTIVA", cycleId } } } },
      },
    }),
    prisma.enrollment.findMany({
      where: { studentId, cycleId, status: "ACTIVA" },
      select: { programId: true },
    }),
    prisma.waitlistRequest.findMany({
      where: { studentId, cycleId },
      select: { programId: true, status: true, requestedAt: true, decisionNote: true },
    }),
  ]);

  const enrolledIds = new Set(enrollments.map((e) => e.programId));
  const myRequest = new Map(requests.map((r) => [r.programId, r]));
  const age = ageFrom(student?.birthDate);
  const max = cycle?.maxEnrollments ?? null;

  return {
    load: {
      current: enrollments.length,
      max,
      full: max != null && enrollments.length >= max,
    },
    programs: programs.map((p) => ({
      ...p,
      occupied: p._count.enrollments,
      enrolled: enrolledIds.has(p.id),
      ageOk: meetsAgeRequirement(age, p.ageMin, p.ageMax),
      myRequest: myRequest.get(p.id) ?? null,
    })),
  };
}

/**
 * Las solicitudes pendientes agrupadas por actividad, en orden de llegada, con los
 * reparos que coordinación necesita ver antes de aceptar.
 *
 * Cuatro consultas fijas, sin importar cuántas solicitudes haya: la fila puede ser
 * larga y una consulta por solicitud la volvería lentísima.
 */
export async function listWaitlistByProgram(
  cycleId: string,
  coordination?: Coordination | null,
) {
  const requests = await prisma.waitlistRequest.findMany({
    where: {
      cycleId,
      status: "EN_ESPERA",
      // La coordinación con área asignada solo resuelve lo suyo (y lo que no tiene
      // coordinación puesta, que es de todas).
      ...(coordination
        ? { program: { OR: [{ coordination }, { coordination: null }] } }
        : {}),
    },
    orderBy: { requestedAt: "asc" },
    select: {
      id: true,
      requestedAt: true,
      message: true,
      student: {
        select: { id: true, firstName: true, lastName: true, matricula: true, birthDate: true },
      },
      program: {
        select: {
          id: true,
          name: true,
          color: true,
          area: true,
          ageMin: true,
          ageMax: true,
          studentCapacity: true,
          allowFamilyEnroll: true,
        },
      },
    },
  });
  if (requests.length === 0) return [];

  const studentIds = [...new Set(requests.map((r) => r.student.id))];
  const programIds = [...new Set(requests.map((r) => r.program.id))];
  const [cupos, cargas, cycle] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["programId"],
      where: { cycleId, status: "ACTIVA", programId: { in: programIds } },
      _count: { _all: true },
    }),
    prisma.enrollment.groupBy({
      by: ["studentId"],
      where: { cycleId, status: "ACTIVA", studentId: { in: studentIds } },
      _count: { _all: true },
    }),
    prisma.cycle.findUnique({ where: { id: cycleId }, select: { maxEnrollments: true } }),
  ]);
  const ocupados = new Map(cupos.map((c) => [c.programId, c._count._all]));
  const carga = new Map(cargas.map((c) => [c.studentId, c._count._all]));
  const max = cycle?.maxEnrollments ?? null;

  // Agrupa por programa conservando el orden de llegada dentro de cada uno.
  const byProgram = new Map<
    string,
    {
      program: (typeof requests)[number]["program"];
      occupied: number;
      requests: {
        id: string;
        requestedAt: Date;
        message: string | null;
        student: (typeof requests)[number]["student"];
        age: number | null;
        ageOk: boolean;
        load: { current: number; max: number | null; full: boolean };
      }[];
    }
  >();
  for (const r of requests) {
    let group = byProgram.get(r.program.id);
    if (!group) {
      group = {
        program: r.program,
        occupied: ocupados.get(r.program.id) ?? 0,
        requests: [],
      };
      byProgram.set(r.program.id, group);
    }
    const current = carga.get(r.student.id) ?? 0;
    const age = ageFrom(r.student.birthDate);
    group.requests.push({
      id: r.id,
      requestedAt: r.requestedAt,
      message: r.message,
      student: r.student,
      age,
      ageOk: meetsAgeRequirement(age, r.program.ageMin, r.program.ageMax),
      load: { current, max, full: max != null && current >= max },
    });
  }
  return [...byProgram.values()].sort((a, b) =>
    a.program.name.localeCompare(b.program.name, "es"),
  );
}

// ── Reportes ────────────────────────────────────────────────────────────────

/** Rango de edad al que cae una edad en años (para las gráficas del reporte). */
export const AGE_BUCKETS = ["0–2", "3–5", "6–12", "13–17", "18+"] as const;
function ageBucket(age: number | null): string {
  if (age == null) return "Sin dato";
  if (age <= 2) return "0–2";
  if (age <= 5) return "3–5";
  if (age <= 12) return "6–12";
  if (age <= 17) return "13–17";
  return "18+";
}

/**
 * Reporte general de un programa en un ciclo: los participantes inscritos con su
 * edad y sexo, el estado de su donativo, y los totales/distribuciones para graficar.
 * "Al corriente" = sin ninguna campaña OBLIGATORIA vencida sin cumplir.
 */
export async function getProgramCycleReport(programId: string, cycleId: string) {
  const [program, cycle, enrollments, campaigns] = await Promise.all([
    prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, name: true, color: true, area: true },
    }),
    prisma.cycle.findUnique({ where: { id: cycleId }, select: { id: true, label: true } }),
    prisma.enrollment.findMany({
      where: { programId, cycleId, status: "ACTIVA" },
      orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricula: true,
            birthDate: true,
            gender: true,
            guardianName: true,
            guardianPhone: true,
            donations: {
              select: { campaignId: true, status: true, graceUntil: true },
            },
          },
        },
      },
    }),
    prisma.donationCampaign.findMany({
      where: { active: true },
      select: { id: true, mandatory: true, dueDate: true },
    }),
  ]);
  if (!program || !cycle) return null;

  const participants = enrollments.map(({ student: s }) => {
    const byCampaign = new Map(s.donations.map((d) => [d.campaignId, d]));
    const cumplidas = campaigns.filter((c) =>
      contributionSatisfied(byCampaign.get(c.id)),
    ).length;
    // Pendiente si alguna campaña obligatoria ya venció y no la cumplió (ni prórroga).
    const pendienteObligatorio = campaigns.some(
      (c) =>
        c.mandatory && deadlineReached(c.dueDate) && !contributionSatisfied(byCampaign.get(c.id)),
    );
    const age = ageFrom(s.birthDate);
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      matricula: s.matricula,
      birthDate: s.birthDate,
      gender: s.gender,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      age,
      ageBucket: ageBucket(age),
      donationsCumplidas: cumplidas,
      donationsTotal: campaigns.length,
      alCorriente: !pendienteObligatorio,
    };
  });

  const byGender = { FEMENINO: 0, MASCULINO: 0, OTRO: 0, "Sin dato": 0 };
  const byAge: Record<string, number> = {
    "0–2": 0,
    "3–5": 0,
    "6–12": 0,
    "13–17": 0,
    "18+": 0,
    "Sin dato": 0,
  };
  let alCorriente = 0;
  for (const p of participants) {
    byGender[p.gender ?? "Sin dato"] += 1;
    byAge[p.ageBucket] += 1;
    if (p.alCorriente) alCorriente += 1;
  }

  return {
    program,
    cycle,
    participants,
    totals: {
      total: participants.length,
      byGender,
      byAge,
      alCorriente,
      pendientes: participants.length - alCorriente,
    },
  };
}

/**
 * Campañas activas para el espacio de la familia: cada una con el estado de esta
 * familia. Incluye obligatorias y voluntarias; `blocking` marca las que hoy le
 * impiden apartar clases.
 */
export async function listFamilyCampaigns(studentId: string) {
  const campaigns = await prisma.donationCampaign.findMany({
    where: { active: true },
    orderBy: [{ mandatory: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      goalLabel: true,
      goalAmount: true,
      mandatory: true,
      dueDate: true,
      contributions: {
        where: { studentId },
        select: { status: true, amount: true, note: true, graceUntil: true },
      },
    },
  });
  return campaigns.map(({ contributions, ...c }) => {
    const mine = contributions[0] ?? null;
    const satisfied = contributionSatisfied(mine);
    const reached = deadlineReached(c.dueDate);
    return {
      ...c,
      status: mine?.status ?? "PENDIENTE",
      amount: mine?.amount ?? null,
      note: mine?.note ?? null,
      graceUntil: mine?.graceUntil ?? null,
      graceValid: mine ? graceIsValid(mine.status, mine.graceUntil) : false,
      satisfied,
      deadlineReached: reached,
      // Ya bloquea: obligatoria, con la fecha límite cumplida y sin cumplir.
      blocking: c.mandatory && !satisfied && reached,
      // Cuenta regresiva en curso: obligatoria pendiente con fecha límite futura.
      countingDown: c.mandatory && !satisfied && c.dueDate != null && !reached,
    };
  });
}

/** Campañas de donativos con su avance (para el panel de la dirección). */
export async function listCampaigns() {
  const [campaigns, totalFamilies] = await Promise.all([
    prisma.donationCampaign.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        goalLabel: true,
        goalAmount: true,
        mandatory: true,
        active: true,
        dueDate: true,
        createdAt: true,
        contributions: { select: { status: true, graceUntil: true } },
      },
    }),
    prisma.student.count({ where: { status: "ACTIVO" } }),
  ]);
  return campaigns.map(({ contributions, ...c }) => {
    const cumplidas = contributions.filter((x) => x.status === "CUMPLIDO").length;
    const gracia = contributions.filter((x) =>
      graceIsValid(x.status, x.graceUntil),
    ).length;
    return { ...c, totalFamilies, cumplidas, gracia };
  });
}

/**
 * Una campaña con el estado de CADA familia activa (aunque aún no tenga registro).
 * Es la vista donde la dirección marca cumplido, registra el donativo o da prórroga.
 */
export async function getCampaign(id: string) {
  const campaign = await prisma.donationCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      goalLabel: true,
      goalAmount: true,
      mandatory: true,
      active: true,
      dueDate: true,
      createdAt: true,
    },
  });
  if (!campaign) return null;

  const students = await prisma.student.findMany({
    where: { status: "ACTIVO" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricula: true,
      donations: {
        where: { campaignId: id },
        select: { status: true, amount: true, note: true, graceUntil: true },
      },
    },
  });

  const families = students.map(({ donations, ...s }) => {
    const mine = donations[0] ?? null;
    return {
      ...s,
      status: mine?.status ?? "PENDIENTE",
      amount: mine?.amount ?? null,
      note: mine?.note ?? null,
      graceUntil: mine?.graceUntil ?? null,
      graceValid: mine ? graceIsValid(mine.status, mine.graceUntil) : false,
      satisfied: contributionSatisfied(mine),
    };
  });

  return { campaign, families };
}

/**
 * El "proceso" del niño que ve la familia: por cada programa inscrito en el ciclo, en
 * qué nivel va y qué calificación le puso la terapeuta al empezar y al cerrar el ciclo
 * (1–4). Mientras no haya calificación final, la familia ve solo con qué empezó.
 */
export async function getFamilyProgress(studentId: string, cycleId: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId, cycleId },
    orderBy: { program: { name: "asc" } },
    select: {
      placement: true,
      initialScore: true,
      finalScore: true,
      program: { select: { id: true, name: true, color: true, area: true } },
      level: { select: { id: true, name: true, order: true } },
    },
  });

  return records.map((r) => ({
    program: r.program,
    placement: r.placement,
    levelName: r.level.name,
    initialScore: r.initialScore,
    finalScore: r.finalScore,
  }));
}

// ── Oficios ─────────────────────────────────────────────────────────────────

const ZONA_LABEL: Record<string, string> = {
  DIRECCION: "Dirección",
  OPERACION: "Operación",
};

/** Etiqueta legible de una zona de oficios. */
export function zonaLabel(zona: string) {
  return ZONA_LABEL[zona] ?? zona;
}

/** Número de oficio con el formato de la casa (ej. "1655/GMP/D/2026"). La zona
 *  cambia la letra: Dirección = D, Operación = O. Con folio null aún no se asignó. */
export function oficioNumero(zona: string, folio: number | null, year: number) {
  const code = zona === "OPERACION" ? "O" : "D";
  return folio == null ? `—/GMP/${code}/${year}` : `${folio}/GMP/${code}/${year}`;
}

/** Lista de oficios: primero los borradores (por editar), luego los aprobados. */
export async function listOficios() {
  return prisma.oficio.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      zona: true,
      folio: true,
      year: true,
      status: true,
      destinatario: true,
      updatedAt: true,
      approvedAt: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });
}

/** Un oficio con todo su contenido, para el editor / la vista de impresión. */
export async function getOficio(id: string) {
  return prisma.oficio.findUnique({
    where: { id },
    select: {
      id: true,
      zona: true,
      folio: true,
      year: true,
      status: true,
      lugarFecha: true,
      destinatario: true,
      cuerpo: true,
      firmante: true,
      approvedAt: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });
}

/** El folio que TOMARÁ un oficio de esta zona/año al aprobarse (mayor emitido + 1). */
export async function nextOficioFolio(zona: string, year: number) {
  const last = await prisma.oficio.findFirst({
    where: { zona: zona as "DIRECCION" | "OPERACION", year, folio: { not: null } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  return (last?.folio ?? 0) + 1;
}
