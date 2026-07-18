"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

/**
 * Anuncios de la dirección para las familias: a todos los participantes activos
 * o solo a los elegidos. Solo la directora publica y borra.
 */

export type AnnouncementFormState = { ok?: boolean; error?: string } | undefined;

export async function createAnnouncement(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const user = await requireRole("DIRECTORA");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  const recipientIds = formData
    .getAll("recipients")
    .map(String)
    .filter(Boolean);

  if (!title || !body) return { error: "El anuncio necesita título y mensaje." };
  if (audience !== "all" && recipientIds.length === 0) {
    return { error: "Elige al menos un participante, o mándalo a todos los activos." };
  }

  await prisma.announcement.create({
    data: {
      authorId: user.id,
      title,
      body,
      toAllActive: audience === "all",
      ...(audience === "all"
        ? {}
        : {
            recipients: {
              create: recipientIds.map((studentId) => ({ studentId })),
            },
          }),
    },
  });
  revalidatePath("/avisos");
  revalidatePath("/mi-espacio");
  return { ok: true };
}

export async function deleteAnnouncement(announcementId: string) {
  await requireRole("DIRECTORA");
  await prisma.announcement.delete({ where: { id: announcementId } });
  revalidatePath("/avisos");
  revalidatePath("/mi-espacio");
}
