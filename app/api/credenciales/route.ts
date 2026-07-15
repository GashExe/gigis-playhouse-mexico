import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Escapa un valor para CSV (comillas, comas, saltos de línea). */
function csvCell(value: string): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Descarga la lista de credenciales de los alumnos (usuario + contraseña inicial).
 * Solo la directora puede generarla. Contiene contraseñas en texto: es confidencial.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (me.role !== "DIRECTORA") {
    return new Response("No autorizado", { status: 403 });
  }

  const alumnos = await prisma.user.findMany({
    where: { role: "ALUMNO" },
    orderBy: { name: "asc" },
    select: {
      username: true,
      name: true,
      initialPassword: true,
      student: {
        select: { matricula: true, guardianName: true, guardianPhone: true },
      },
    },
  });

  const header = ["Matricula", "Nombre", "Usuario", "Contrasena", "Tutor", "Telefono"];
  const lines = [header.map(csvCell).join(",")];
  for (const a of alumnos) {
    lines.push(
      [
        a.student?.matricula ?? a.username,
        a.name,
        a.username,
        a.initialPassword ?? "",
        a.student?.guardianName ?? "",
        a.student?.guardianPhone ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM para que Excel abra los acentos correctamente.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="credenciales_alumnos_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
