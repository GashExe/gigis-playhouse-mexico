"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { isDateKey } from "@/lib/schedule";

/**
 * Eventos del calendario interno (juntas, capacitaciones, visitas, eventos de
 * recaudación…). Los captura dirección o coordinación y los ve solo el equipo:
 * no salen nunca en Mi espacio.
 */

export type EventState = { ok?: boolean; error?: string } | undefined;

/** Fecha pura (@db.Date): siempre desde la clave, en UTC. */
function eventDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** "HH:MM" en 24h, o null si viene vacío. */
function hora(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

export async function saveCalendarEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const user = await requireRole("DIRECTORA", "COORDINADOR");

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const dateKey = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const startTime = hora(formData.get("startTime"));
  const endTime = hora(formData.get("endTime"));

  if (!title) return { error: "Ponle un nombre al evento." };
  if (!isDateKey(dateKey)) return { error: "Elige una fecha válida." };
  if (startTime && endTime && endTime <= startTime) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  const data = {
    title,
    date: eventDate(dateKey),
    startTime,
    endTime,
    notes,
    color,
  };

  if (id) {
    await prisma.calendarEvent.update({ where: { id }, data });
  } else {
    await prisma.calendarEvent.create({ data: { ...data, authorId: user.id } });
  }

  revalidatePath("/calendario");
  return { ok: true };
}

export async function deleteCalendarEvent(id: string) {
  await requireRole("DIRECTORA", "COORDINADOR");
  await prisma.calendarEvent.delete({ where: { id } });
  revalidatePath("/calendario");
}
