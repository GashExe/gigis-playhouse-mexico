import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Los programas que da una terapeuta: los que tiene a cargo, los que da junto con
 * la titular (coTeachers) y aquellos donde da al menos un grupo.
 *
 * Un programa tiene UNA terapeuta a cargo, pero varias lo dan: en Lectura la de
 * Prerrequisitos no es la misma que la de los demás niveles. Quien da un grupo
 * necesita ver el programa, pasar lista y calificar ahí igual que la titular; por
 * eso toda pregunta de "¿es suyo este programa?" pasa por aquí y no por teacherId.
 */
export function teachesProgram(userId: string): Prisma.ProgramWhereInput {
  return {
    OR: [
      { teacherId: userId },
      { coTeachers: { some: { id: userId } } },
      { groups: { some: { teacherId: userId, active: true } } },
    ],
  };
}

/** Lo mismo, con el programa ya cargado junto con sus grupos. */
export function teaches(
  userId: string,
  program: {
    teacherId: string | null;
    coTeachers?: { id: string }[];
    groups?: { teacherId: string | null; active?: boolean }[];
  },
): boolean {
  return (
    program.teacherId === userId ||
    (program.coTeachers ?? []).some((t) => t.id === userId) ||
    (program.groups ?? []).some((g) => g.teacherId === userId && g.active !== false)
  );
}

/**
 * Quiénes dan un programa, en una línea: "Mariana Martinez y Adrián Carrillo".
 * null cuando no hay nadie asignado.
 */
export function teacherNames(
  teacher: { name: string } | null | undefined,
  coTeachers: { name: string }[] = [],
): string | null {
  const names = [teacher, ...coTeachers].filter((t) => t != null).map((t) => t.name);
  if (names.length === 0) return null;
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
