"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

function parseZona(value: FormDataEntryValue | null | undefined): "DIRECCION" | "OPERACION" {
  return String(value ?? "") === "OPERACION" ? "OPERACION" : "DIRECCION";
}

/**
 * Crea un oficio en borrador (sin folio) en la zona elegida y abre su editor. El
 * folio se asignará cuando la dirección lo apruebe, así que los borradores no
 * consumen número.
 */
export async function createOficio(formData: FormData) {
  const me = await requireRole("DIRECTORA", "COORDINADOR");
  const zona = parseZona(formData.get("zona"));
  const oficio = await prisma.oficio.create({
    data: { zona, year: new Date().getFullYear(), createdById: me.id },
  });
  redirect(`/oficios/${oficio.id}`);
}

/** Guarda el contenido del borrador. Un oficio aprobado ya no se edita. */
export async function saveOficio(
  id: string,
  data: {
    zona: string;
    lugarFecha: string;
    destinatario: string;
    cuerpo: string;
    firmante: string;
  },
) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const oficio = await prisma.oficio.findUnique({ where: { id }, select: { status: true } });
  if (!oficio || oficio.status === "APROBADO") return;

  await prisma.oficio.update({
    where: { id },
    data: {
      zona: parseZona(data.zona),
      lugarFecha: data.lugarFecha.trim() || null,
      destinatario: data.destinatario.trim() || null,
      cuerpo: data.cuerpo,
      firmante: data.firmante.trim() || null,
    },
  });
  revalidatePath(`/oficios/${id}`);
  revalidatePath("/oficios");
}

/**
 * Aprueba un oficio (solo la dirección — Eva). Le asigna el siguiente folio de su
 * zona/año (el mayor emitido + 1) dentro de una transacción para que dos
 * aprobaciones seguidas no tomen el mismo número, y habilita imprimir/descargar.
 */
export async function approveOficio(id: string) {
  const me = await requireRole("DIRECTORA");
  await prisma.$transaction(async (tx) => {
    const oficio = await tx.oficio.findUnique({
      where: { id },
      select: { status: true, zona: true, year: true },
    });
    if (!oficio || oficio.status === "APROBADO") return;
    const last = await tx.oficio.findFirst({
      where: { zona: oficio.zona, year: oficio.year, folio: { not: null } },
      orderBy: { folio: "desc" },
      select: { folio: true },
    });
    const folio = (last?.folio ?? 0) + 1;
    await tx.oficio.update({
      where: { id },
      data: { status: "APROBADO", folio, approvedById: me.id, approvedAt: new Date() },
    });
  });
  await logAudit({
    action: "oficio.aprobado",
    summary: "Aprobó y foleó un oficio",
    entityType: "Oficio",
    entityId: id,
  });
  revalidatePath(`/oficios/${id}`);
  revalidatePath("/oficios");
}

/** Elimina un borrador. Un oficio aprobado no se borra: conserva el folio emitido. */
export async function deleteOficio(id: string) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const oficio = await prisma.oficio.findUnique({ where: { id }, select: { status: true } });
  if (!oficio || oficio.status === "APROBADO") return;
  await prisma.oficio.delete({ where: { id } });
  redirect("/oficios");
}
