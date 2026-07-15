import "server-only";
import { prisma } from "@/lib/prisma";

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

export async function listStudents(query?: string) {
  const q = query?.trim();
  return prisma.student.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { guardianName: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ status: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { enrollments: { where: { status: "ACTIVA" } }, evaluations: true } },
    },
  });
}

export async function getStudent(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      account: { select: { username: true, initialPassword: true, active: true } },
      enrollments: {
        include: { program: true },
        orderBy: { startDate: "desc" },
      },
      evaluations: {
        include: {
          program: { select: { name: true, color: true } },
          evaluator: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      },
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
    where: { role: { in: ["DIRECTORA", "MAESTRA"] } },
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
