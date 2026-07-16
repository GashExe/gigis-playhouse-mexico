import "server-only";
import { prisma } from "@/lib/prisma";
import type { StudentStatus } from "@/lib/generated/prisma/client";

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

/** Datos propios del alumno para su espacio (solo su expediente y programas activos). */
export async function getStudentSpace(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: {
      firstName: true,
      lastName: true,
      matricula: true,
      onboardingCompletedAt: true,
      consentVersion: true,
      enrollments: {
        where: { status: "ACTIVA" },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          program: { select: { name: true, color: true, area: true } },
        },
      },
    },
  });
}

export async function listPrograms() {
  return prisma.program.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      teacher: { select: { id: true, name: true } },
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVA" } },
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

export async function listActivePrograms() {
  return prisma.program.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, area: true },
  });
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
      levels: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, description: true } },
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
