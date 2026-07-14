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

export async function listPrograms() {
  return prisma.program.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVA" } },
          evaluations: true,
        },
      },
    },
  });
}

export async function listActivePrograms() {
  return prisma.program.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, area: true },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { evaluations: true } },
    },
  });
}
