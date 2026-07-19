import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Búsqueda global rápida (la que alimenta el atajo ⌘/Ctrl+K). Solo personal.
 * Encuentra participantes (nombre, tutor, matrícula) y programas (nombre, área) y
 * devuelve a dónde llevan: el alumno a su expediente, el programa a su panel.
 */
export async function GET(request: Request) {
  // Cualquier miembro del equipo puede buscar; un ALUMNO se va a su espacio.
  await requireStaff();

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ students: [], programs: [] });
  }

  const [students, programs] = await Promise.all([
    prisma.student.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { guardianName: { contains: q, mode: "insensitive" } },
          { matricula: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
      take: 8,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricula: true,
        status: true,
      },
    }),
    prisma.program.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { area: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 6,
      select: { id: true, name: true, area: true, color: true, active: true },
    }),
  ]);

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      matricula: s.matricula,
      status: s.status,
      href: `/estudiantes/${s.id}`,
    })),
    programs: programs.map((p) => ({
      id: p.id,
      name: p.name,
      area: p.area,
      color: p.color,
      active: p.active,
      href: `/calendario/${p.id}`,
    })),
  });
}
