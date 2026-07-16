import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generatePassword, usernameFromName } from "@/lib/credentials";

/** Busca un usuario libre a partir de una base, agregando 2, 3, … si ya existe. */
async function uniqueUsername(base: string): Promise<string> {
  let username = base || "alumno";
  let n = 1;
  // Reintenta hasta encontrar uno libre.
  while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
    n++;
    username = `${base}${n}`;
  }
  return username;
}

/**
 * Crea la cuenta de acceso (role ALUMNO) de un participante si aún no la tiene:
 *   - usuario    = se genera del nombre + apellido (ej. "testprueba"); la unicidad
 *                  se resuelve agregando 2, 3, … si ya existe.
 *   - contraseña = autogenerada (ej. TesPru2026), guardada en texto para la directora
 *
 * La matrícula ya NO se usa como usuario de acceso (es solo un dato del expediente).
 *
 * Devuelve { username, password } al crearla, o null si el participante ya tenía cuenta.
 */
export async function ensureAlumnoAccount(
  student: { id: string; firstName: string; lastName: string },
): Promise<{ username: string; password: string } | null> {
  const already = await prisma.user.findFirst({
    where: { studentId: student.id },
    select: { id: true },
  });
  if (already) return null;

  const base = usernameFromName(student.firstName, student.lastName);
  const username = await uniqueUsername(base);

  const password = generatePassword(
    student.firstName,
    student.lastName.split(" ")[0] ?? "",
    new Date().getFullYear(),
  );
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: `${student.firstName} ${student.lastName}`,
      username,
      role: "ALUMNO",
      passwordHash,
      initialPassword: password,
      studentId: student.id,
    },
  });

  return { username, password };
}
