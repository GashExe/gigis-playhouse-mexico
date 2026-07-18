"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireGraderForProgram } from "@/lib/dal";
import { isDateKey } from "@/lib/schedule";

/**
 * Acciones del panel de clase (calendario): asistencia, bitácora de la sesión y
 * anotaciones sobre los alumnos. Escriben quienes pueden calificar el programa:
 * dirección y coordinación en cualquiera; la maestra solo en los suyos.
 */

const STATUSES = ["PRESENTE", "AUSENTE", "JUSTIFICADO", "RETARDO"] as const;
type Status = (typeof STATUSES)[number];

/** La sesión se guarda como fecha pura (@db.Date): siempre desde la clave, en UTC. */
function sessionDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Busca o crea la sesión de clase de un programa en una fecha. */
async function upsertSession(programId: string, dateKey: string) {
  const date = sessionDate(dateKey);
  return prisma.classSession.upsert({
    where: { programId_date: { programId, date } },
    update: {},
    create: { programId, date },
    select: { id: true },
  });
}

/** Marca (o corrige) la asistencia de un alumno en la clase de una fecha. */
export async function setAttendance(
  programId: string,
  dateKey: string,
  studentId: string,
  status: string,
) {
  if (!isDateKey(dateKey)) return;
  if (!(STATUSES as readonly string[]).includes(status)) return;
  await requireGraderForProgram(programId);

  // Solo alumnos realmente inscritos al programa: evita colar asistencia ajena.
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, status: "ACTIVA" },
    select: { id: true },
  });
  if (!enrolled) return;

  const session = await upsertSession(programId, dateKey);
  await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
    update: { status: status as Status },
    create: { sessionId: session.id, studentId, status: status as Status },
  });
  revalidatePath(`/calendario/${programId}`);
}

/** Detalle breve sobre la asistencia de un alumno ese día (ej. "aviso de la mamá"). */
export async function setAttendanceNote(
  programId: string,
  dateKey: string,
  studentId: string,
  formData: FormData,
) {
  if (!isDateKey(dateKey)) return;
  await requireGraderForProgram(programId);
  const note = String(formData.get("note") ?? "").trim() || null;

  const session = await upsertSession(programId, dateKey);
  // Solo si ya hay asistencia marcada: una nota sin estado no significa nada.
  await prisma.attendanceRecord.updateMany({
    where: { sessionId: session.id, studentId },
    data: { note },
  });
  revalidatePath(`/calendario/${programId}`);
}

/** Guarda la bitácora de la clase (qué se trabajó, acuerdos, pendientes). */
export async function saveClassNotes(
  programId: string,
  dateKey: string,
  formData: FormData,
) {
  if (!isDateKey(dateKey)) return;
  await requireGraderForProgram(programId);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const date = sessionDate(dateKey);
  await prisma.classSession.upsert({
    where: { programId_date: { programId, date } },
    update: { notes },
    create: { programId, date, notes },
  });
  revalidatePath(`/calendario/${programId}`);
}

/**
 * Anotación sobre un alumno desde el panel de clase. Si va "visible para la
 * familia", aparece en Mi espacio del alumno; si no, queda interna del equipo.
 */
export async function addStudentNote(programId: string, formData: FormData) {
  const user = await requireGraderForProgram(programId);
  const studentId = String(formData.get("studentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!studentId || !body) return;
  const visibleToFamily = formData.get("visibleToFamily") === "on";

  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, status: "ACTIVA" },
    select: { id: true },
  });
  if (!enrolled) return;

  await prisma.studentNote.create({
    data: { studentId, programId, authorId: user.id, body, visibleToFamily },
  });
  revalidatePath(`/calendario/${programId}`);
  revalidatePath(`/estudiantes/${studentId}`);
}

/**
 * Borra una anotación. La maestra solo las suyas; dirección y coordinación
 * cualquiera (por si hay que retirar algo que la familia no debería ver).
 */
export async function deleteStudentNote(noteId: string) {
  const user = await getCurrentUser();
  if (user.role === "ALUMNO") return;
  const note = await prisma.studentNote.findUnique({
    where: { id: noteId },
    select: { authorId: true, programId: true, studentId: true },
  });
  if (!note) return;
  if (user.role === "MAESTRA" && note.authorId !== user.id) return;

  await prisma.studentNote.delete({ where: { id: noteId } });
  if (note.programId) revalidatePath(`/calendario/${note.programId}`);
  revalidatePath(`/estudiantes/${note.studentId}`);
}
