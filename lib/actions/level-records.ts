"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireGraderForProgram } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

const PLACEMENTS = ["REGULAR", "PROBATORIO", "POSIBLE_GRADUADO"] as const;
type Placement = (typeof PLACEMENTS)[number];

/**
 * Registra/actualiza la UBICACIÓN de nivel de un alumno en un programa, para un ciclo.
 * Es el paso previo a calificar: sobre esta ubicación cuelgan la calificación inicial
 * y la final. El nivel debe pertenecer al programa. Único por (alumno, programa, ciclo).
 */
export async function setLevelRecord(studentId: string, formData: FormData) {
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;
  // La terapeuta solo puede ubicar/calificar en los programas a su cargo.
  await requireGraderForProgram(programId);
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
    select: { id: true, name: true, program: { select: { name: true } } },
  });
  if (!level) return;

  await prisma.levelRecord.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    update: { programLevelId, placement, note, gradedAt: new Date() },
    create: { studentId, programId, cycleId, programLevelId, placement, note },
  });
  await logAudit({
    action: "nivel.ubicar",
    summary: `Ubicó en «${level.name}» de ${level.program.name}`,
    entityType: "LevelRecord",
    entityId: programId,
    studentId,
  });
  revalidatePath(`/estudiantes/${studentId}`);
}

/**
 * Registra la calificación del ciclo que pone la terapeuta: la INICIAL (cómo llegó
 * el participante) o la FINAL (cómo cerró). Escala 1–4 — la regla de la casa es que
 * la calificación más alta es 4, nunca mayor. Un `score` nulo la borra (para deshacer
 * un dedazo sin tener que quitar la ubicación de nivel completa).
 *
 * Exige que el alumno YA esté ubicado en un nivel de ese programa en ese ciclo: la
 * calificación cuelga de esa ubicación, no vive suelta.
 */
export async function setProgramScore(args: {
  studentId: string;
  programId: string;
  cycleId: string;
  kind: "inicial" | "final";
  score: number | null;
}) {
  const { studentId, programId, cycleId, kind, score } = args;
  if (!studentId || !programId || !cycleId) return;
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 4)) return;
  await requireGraderForProgram(programId);

  const record = await prisma.levelRecord.findUnique({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    select: {
      id: true,
      initialScore: true,
      finalScore: true,
      level: { select: { name: true } },
      program: { select: { name: true } },
    },
  });
  if (!record) return;

  const previo = kind === "inicial" ? record.initialScore : record.finalScore;
  if (previo === score) return; // nada que registrar (evita ruido al repintar)

  await prisma.levelRecord.update({
    where: { id: record.id },
    data: {
      ...(kind === "inicial" ? { initialScore: score } : { finalScore: score }),
      gradedAt: new Date(),
    },
  });

  const cual = kind === "inicial" ? "inicial" : "final";
  await logAudit({
    action: `calificacion.${cual}`,
    summary:
      score === null
        ? `Borró la calificación ${cual} de ${record.program.name} (${record.level.name})`
        : previo === null
          ? `Calificación ${cual} de ${record.program.name}: ${score} (${record.level.name})`
          : `Cambió la calificación ${cual} de ${record.program.name} de ${previo} a ${score}`,
    entityType: "LevelRecord",
    entityId: programId,
    studentId,
  });

  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath(`/estudiantes/${studentId}/calificar/${programId}`);
  revalidatePath(`/calendario/${programId}`);
}

/** Quita la ubicación de nivel de un alumno en ese programa/ciclo. */
export async function removeLevelRecord(recordId: string, studentId: string) {
  const record = await prisma.levelRecord.findUnique({
    where: { id: recordId },
    select: { programId: true, program: { select: { name: true } }, level: { select: { name: true } } },
  });
  if (!record) return;
  await requireGraderForProgram(record.programId);
  await prisma.levelRecord.delete({ where: { id: recordId } });
  await logAudit({
    action: "nivel.quitar",
    summary: `Quitó la ubicación de nivel «${record.level.name}» en ${record.program.name}`,
    entityType: "LevelRecord",
    entityId: record.programId,
    studentId,
  });
  revalidatePath(`/estudiantes/${studentId}`);
}
