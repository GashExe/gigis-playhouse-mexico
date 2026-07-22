import "server-only";
import { prisma } from "@/lib/prisma";
import type { StudentStatus } from "@/lib/generated/prisma/client";
import { ageFrom } from "@/lib/utils";

export async function getDashboardStats() {
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
    prisma.enrollment.count({ where: { status: "ACTIVA" } }),
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
        _count: { select: { enrollments: { where: { status: "ACTIVA" } } } },
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
      // Lo que el equipo quiere que la familia sepa: solo lo marcado visible.
      studentNotes: {
        where: { visibleToFamily: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
          program: { select: { name: true, color: true } },
        },
      },
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

/** Personal disponible para asignar como maestro de un programa. */
export async function listTeachers() {
  return prisma.user.findMany({
    where: { role: { in: ["DIRECTORA", "MAESTRA"] }, active: true },
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
    select: { id: true, name: true, color: true, area: true },
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

/** Ciclos por temporada, del más reciente al más antiguo. */
export async function listCycles() {
  // La temporada es alfabéticamente cronológica: ENE_JUN < JUL_AGO < SEP_DIC.
  return prisma.cycle.findMany({ orderBy: [{ year: "desc" }, { season: "asc" }] });
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
 * Para cada ciclo dice en qué nivel estuvo, con qué % lo cerró y si subió de nivel
 * respecto al ciclo anterior. El dato ya vive en LevelRecord/ItemScore; esto solo lo
 * cuenta como historia (ordenado del ciclo más reciente al más antiguo).
 */
export async function getStudentTimeline(studentId: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId },
    select: {
      id: true,
      placement: true,
      gradedAt: true,
      program: { select: { id: true, name: true, color: true, passThreshold: true } },
      level: {
        select: {
          id: true,
          name: true,
          order: true,
          blocks: { select: { items: { select: { id: true } } } },
        },
      },
      cycle: { select: { id: true, label: true, year: true, season: true } },
    },
  });
  if (records.length === 0) return [];

  // Calificaciones del alumno en los temas de los niveles que aparecen, por ciclo.
  const itemIds = [
    ...new Set(records.flatMap((r) => r.level.blocks.flatMap((b) => b.items.map((i) => i.id)))),
  ];
  const scores = itemIds.length
    ? await prisma.itemScore.findMany({
        where: { studentId, itemId: { in: itemIds } },
        select: { itemId: true, cycleId: true, score: true },
      })
    : [];
  // Clave (ciclo:tema) → calificación, para calcular el % de un nivel en su ciclo.
  const scoreByKey = new Map(scores.map((s) => [`${s.cycleId}:${s.itemId}`, s.score]));

  // Orden cronológico del ciclo: año + temporada (ENE_JUN < JUL_AGO < SEP_DIC).
  const cycleRank = (year: number, season: string) =>
    year * 10 + (season === "ENE_JUN" ? 1 : season === "JUL_AGO" ? 2 : 3);

  type Entry = {
    recordId: string;
    cycle: { id: string; label: string };
    levelName: string;
    levelOrder: number;
    placement: string;
    percent: number;
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
    const items = r.level.blocks.flatMap((b) => b.items.map((i) => i.id));
    const percent =
      items.length === 0
        ? 0
        : Math.round(
            (items.reduce((acc, id) => {
              const s = scoreByKey.get(`${r.cycle.id}:${id}`);
              return acc + (s ? s / 4 : 0);
            }, 0) /
              items.length) *
              100,
          );

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
      percent,
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
 * su nivel en cada programa y el detalle bloque por bloque (con % y si lo logró),
 * más la fecha en que se calificó. Es el mismo dato de LevelRecord/ItemScore que el
 * "proceso", pero abierto a TODOS los ciclos (no solo el activo). Con `programId` se
 * acota a una asignatura. Ordenado del ciclo más reciente al más antiguo.
 */
export async function getStudentGradeHistory(studentId: string, programId?: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId, ...(programId ? { programId } : {}) },
    select: {
      id: true,
      placement: true,
      gradedAt: true,
      note: true,
      program: { select: { id: true, name: true, color: true, passThreshold: true } },
      cycle: { select: { id: true, label: true, year: true, season: true } },
      level: {
        select: {
          id: true,
          name: true,
          order: true,
          description: true,
          blocks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              items: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (records.length === 0) return [];

  const itemIds = [
    ...new Set(records.flatMap((r) => r.level.blocks.flatMap((b) => b.items.map((i) => i.id)))),
  ];
  const scores = itemIds.length
    ? await prisma.itemScore.findMany({
        where: { studentId, itemId: { in: itemIds } },
        select: { itemId: true, cycleId: true, score: true },
      })
    : [];
  const scoreByKey = new Map(scores.map((s) => [`${s.cycleId}:${s.itemId}`, s.score]));

  const cycleRank = (year: number, season: string) =>
    year * 10 + (season === "ENE_JUN" ? 1 : season === "JUL_AGO" ? 2 : 3);
  const pct = (cycleId: string, ids: string[]) =>
    ids.length === 0
      ? 0
      : Math.round(
          (ids.reduce((acc, id) => acc + (scoreByKey.get(`${cycleId}:${id}`) ?? 0) / 4, 0) /
            ids.length) *
            100,
        );

  type Entry = {
    recordId: string;
    cycle: { id: string; label: string };
    levelName: string;
    levelDescription: string | null;
    placement: string;
    gradedAt: Date;
    note: string | null;
    overall: number;
    rank: number;
    blocks: {
      id: string;
      code: string | null;
      name: string;
      percent: number;
      achieved: boolean;
      hasItems: boolean;
    }[];
  };

  const byProgram = new Map<
    string,
    { program: { id: string; name: string; color: string | null }; entries: Entry[] }
  >();

  for (const r of records) {
    const threshold = r.program.passThreshold;
    const blocks = r.level.blocks.map((b) => {
      const ids = b.items.map((i) => i.id);
      const percent = pct(r.cycle.id, ids);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        percent,
        achieved: ids.length > 0 && percent >= threshold,
        hasItems: ids.length > 0,
      };
    });
    const allIds = r.level.blocks.flatMap((b) => b.items.map((i) => i.id));

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
      overall: pct(r.cycle.id, allIds),
      rank: cycleRank(r.cycle.year, r.cycle.season),
      blocks,
    });
  }

  return [...byProgram.values()]
    .map((g) => ({ program: g.program, entries: g.entries.sort((a, b) => b.rank - a.rank) }))
    .sort((a, b) => a.program.name.localeCompare(b.program.name));
}

/**
 * Programas que YA tienen plantilla, con sus totales. Son los únicos de los que tiene
 * sentido copiar al crear un programa nuevo.
 */
export async function listTemplateSources() {
  const programs = await prisma.program.findMany({
    where: { levels: { some: { blocks: { some: {} } } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      levels: {
        select: { _count: { select: { blocks: true } }, blocks: { select: { _count: { select: { items: true } } } } },
      },
    },
  });
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    levels: p.levels.length,
    items: p.levels.reduce((a, l) => a + l.blocks.reduce((b, x) => b + x._count.items, 0), 0),
  }));
}

/** Plantilla completa de evaluación de un programa: niveles → bloques → temas. */
export async function getProgramTemplate(programId: string) {
  return prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      color: true,
      evalFormat: true,
      passThreshold: true,
      levels: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          description: true,
          blocks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              order: true,
              items: {
                orderBy: { order: "asc" },
                select: { id: true, code: true, text: true, order: true },
              },
            },
          },
        },
      },
    },
  });
}

/** Datos básicos de un programa (para la vista de calificación). */
export async function getProgramBasics(programId: string) {
  return prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, name: true, color: true, passThreshold: true, evalFormat: true },
  });
}

/**
 * Datos para calificar por bloques: el nivel en el que está ubicado el alumno en un
 * programa/ciclo, con sus bloques y temas, y la calificación (1–4) que ya tenga el
 * alumno en ese ciclo. Devuelve null si no está ubicado en un nivel todavía.
 */
export async function getGradingData(studentId: string, programId: string, cycleId: string) {
  const record = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: { level: { select: { id: true, name: true, order: true, description: true } } },
  });
  if (!record) return null;

  // El nivel que sigue, para ofrecer "subir de nivel" al desbloquear los bloques.
  const nextLevel = await prisma.programLevel.findFirst({
    where: { programId, order: { gt: record.level.order } },
    orderBy: { order: "asc" },
    select: { name: true },
  });

  const blocks = await prisma.evalBlock.findMany({
    where: { levelId: record.level.id },
    orderBy: { order: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      order: true,
      items: {
        orderBy: { order: "asc" },
        select: { id: true, code: true, text: true, order: true },
      },
    },
  });

  const itemIds = blocks.flatMap((b) => b.items.map((i) => i.id));
  const scores = itemIds.length
    ? await prisma.itemScore.findMany({
        where: { studentId, cycleId, itemId: { in: itemIds } },
        select: { itemId: true, score: true },
      })
    : [];
  const scoreByItem = new Map(scores.map((s) => [s.itemId, s.score]));

  return {
    level: record.level,
    nextLevelName: nextLevel?.name ?? null,
    blocks: blocks.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      items: b.items.map((i) => ({
        id: i.id,
        code: i.code,
        text: i.text,
        score: scoreByItem.get(i.id) ?? null,
      })),
    })),
  };
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
      teacherId: true, // para acotar a la maestra a los programas a su cargo
      levels: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, description: true } },
    },
  });
}

/**
 * Programas para el calendario del equipo: activos, de la oferta del ciclo y con
 * su horario estructurado. Si se pasa teacherId se acota a los de esa maestra.
 */
export async function listCalendarPrograms(cycleId?: string, teacherId?: string) {
  return prisma.program.findMany({
    where: {
      active: true,
      ...(cycleId ? { cycles: { some: { id: cycleId } } } : {}),
      ...(teacherId ? { teacherId } : {}),
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
        passThreshold: true,
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
 */
export async function getFamilyOffer(studentId: string, cycleId: string) {
  const [student, programs, reservations, enrollments] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { birthDate: true },
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
        teacher: { select: { name: true } },
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          select: { weekday: true, startTime: true, endTime: true },
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
  ]);
  return {
    birthDate: student?.birthDate ?? null,
    programs,
    reservations,
    enrolledProgramIds: new Set(enrollments.map((e) => e.programId)),
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
 */
export async function listRecentFamilyReservations(limit = 8) {
  const recent = await prisma.reservation.findMany({
    where: { status: "APROBADA" },
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
 * acota a los programas de esa maestra.
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
    where: { role: { in: ["DIRECTORA", "COORDINADOR", "MAESTRA"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
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
 * El "proceso" del niño que ve la familia: por cada programa inscrito en el ciclo,
 * en qué nivel va y qué tanto lleva avanzado bloque por bloque. Se calcula de las
 * calificaciones por tema (1–4) ya registradas; un bloque se muestra "logrado" al
 * llegar al umbral del programa.
 */
export async function getFamilyProgress(studentId: string, cycleId: string) {
  const records = await prisma.levelRecord.findMany({
    where: { studentId, cycleId },
    orderBy: { program: { name: "asc" } },
    select: {
      placement: true,
      program: {
        select: { id: true, name: true, color: true, area: true, passThreshold: true },
      },
      level: {
        select: {
          id: true,
          name: true,
          order: true,
          blocks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              items: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (records.length === 0) return [];

  const itemIds = [
    ...new Set(records.flatMap((r) => r.level.blocks.flatMap((b) => b.items.map((i) => i.id)))),
  ];
  const scores = itemIds.length
    ? await prisma.itemScore.findMany({
        where: { studentId, cycleId, itemId: { in: itemIds } },
        select: { itemId: true, score: true },
      })
    : [];
  const scoreByItem = new Map(scores.map((s) => [s.itemId, s.score]));

  const pct = (ids: string[]) =>
    ids.length === 0
      ? 0
      : Math.round(
          (ids.reduce((acc, id) => acc + (scoreByItem.get(id) ?? 0) / 4, 0) / ids.length) * 100,
        );

  return records.map((r) => {
    const threshold = r.program.passThreshold;
    const blocks = r.level.blocks.map((b) => {
      const ids = b.items.map((i) => i.id);
      const percent = pct(ids);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        percent,
        achieved: ids.length > 0 && percent >= threshold,
        hasItems: ids.length > 0,
      };
    });
    const allIds = r.level.blocks.flatMap((b) => b.items.map((i) => i.id));
    return {
      program: r.program,
      placement: r.placement,
      levelName: r.level.name,
      overall: pct(allIds),
      blocks,
    };
  });
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
