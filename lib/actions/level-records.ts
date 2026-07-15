"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

const PLACEMENTS = ["REGULAR", "PROBATORIO", "POSIBLE_GRADUADO"] as const;
type Placement = (typeof PLACEMENTS)[number];

/**
 * Registra/actualiza la UBICACIÓN de nivel de un alumno en un programa, para un
 * ciclo. Es la "calificación por programa" con historial por ciclo. El nivel debe
 * pertenecer al programa. Único por (alumno, programa, ciclo).
 */
export async function setLevelRecord(studentId: string, formData: FormData) {
  await verifySession();
  const programId = String(formData.get("programId") ?? "");
  const cycleId = String(formData.get("cycleId") ?? "");
  const programLevelId = String(formData.get("programLevelId") ?? "");
  const rawPlacement = String(formData.get("placement") ?? "REGULAR");
  const placement: Placement = (PLACEMENTS as readonly string[]).includes(rawPlacement)
    ? (rawPlacement as Placement)
    : "REGULAR";
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!programId || !cycleId || !programLevelId) return;

  // El nivel elegido debe ser de ese programa (evita mezclar niveles de otro).
  const level = await prisma.programLevel.findFirst({
    where: { id: programLevelId, programId },
    select: { id: true },
  });
  if (!level) return;

  await prisma.levelRecord.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    update: { programLevelId, placement, note, gradedAt: new Date() },
    create: { studentId, programId, cycleId, programLevelId, placement, note },
  });
  revalidatePath(`/estudiantes/${studentId}`);
}

/** Quita la ubicación de nivel de un alumno en ese programa/ciclo. */
export async function removeLevelRecord(recordId: string, studentId: string) {
  await verifySession();
  await prisma.levelRecord.delete({ where: { id: recordId } });
  revalidatePath(`/estudiantes/${studentId}`);
}
