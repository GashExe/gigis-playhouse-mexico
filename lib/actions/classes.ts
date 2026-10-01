"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireClassManagerForProgram } from "@/lib/dal";
import { isDateKey } from "@/lib/schedule";
import { notificarFamilias, notificarFamiliasDePrograma, resumen } from "@/lib/push";

/**
 * Acciones del panel de clase (calendario): asistencia, bitácora de la sesión y
 * anotaciones sobre los alumnos. Escriben quienes llevan el programa: dirección,
 * coordinación y operación en cualquiera; la terapeuta solo en los suyos.
 */

const STATUSES = ["PRESENTE", "AUSENTE", "JUSTIFICADO", "RETARDO"] as const;
type Status = (typeof STATUSES)[number];

/** Hoy en Querétaro como clave AAAA-MM-DD (para no avisar de clases que ya pasaron). */
function hoyMx(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "lunes 5 de octubre" a partir de la clave de fecha. */
function diaLegible(dateKey: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date(`${dateKey}T12:00:00.000Z`))
    .replace(",", "");
}

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
  await requireClassManagerForProgram(programId);

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
  await requireClassManagerForProgram(programId);
  const note = String(formData.get("note") ?? "").trim() || null;

  const session = await upsertSession(programId, dateKey);
  // Solo si ya hay asistencia marcada: una nota sin estado no significa nada.
  await prisma.attendanceRecord.updateMany({
    where: { sessionId: session.id, studentId },
    data: { note },
  });
  revalidatePath(`/calendario/${programId}`);
}

/**
 * Suspende (o reactiva) la clase de una fecha, con el motivo que verá la
 * familia. La sesión suspendida sigue existiendo: guarda el motivo y la fecha.
 */
export async function setClassCanceled(
  programId: string,
  dateKey: string,
  canceled: boolean,
  formData: FormData,
) {
  if (!isDateKey(dateKey)) return;
  await requireClassManagerForProgram(programId);
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const date = sessionDate(dateKey);
  const antes = await prisma.classSession.findUnique({
    where: { programId_date: { programId, date } },
    select: { canceled: true },
  });
  const sesion = await prisma.classSession.upsert({
    where: { programId_date: { programId, date } },
    update: { canceled, cancelReason: canceled ? reason : null },
    create: { programId, date, canceled, cancelReason: canceled ? reason : null },
    select: { program: { select: { name: true } } },
  });

  // Aviso a las familias solo si de verdad cambió y la clase todavía no pasa:
  // suspender algo de la semana pasada (para ordenar el registro) no le sirve a nadie.
  const cambio = (antes?.canceled ?? false) !== canceled;
  if (cambio && dateKey >= hoyMx()) {
    const dia = diaLegible(dateKey);
    notificarFamiliasDePrograma(programId, {
      title: canceled
        ? `Se suspende ${sesion.program.name} el ${dia}`
        : `Sí hay clase de ${sesion.program.name} el ${dia}`,
      body: canceled
        ? reason
          ? resumen(reason)
          : "Esa clase no se da. Revisa Mi espacio para más detalles."
        : "La clase que estaba suspendida se vuelve a dar como siempre.",
      url: "/mi-espacio",
      tag: `clase-${programId}-${dateKey}`,
    });
  }
  revalidatePath(`/calendario/${programId}`);
  revalidatePath("/calendario");
  revalidatePath("/mi-espacio");
}

/** Guarda la bitácora de la clase (qué se trabajó, acuerdos, pendientes). */
export async function saveClassNotes(
  programId: string,
  dateKey: string,
  formData: FormData,
) {
  if (!isDateKey(dateKey)) return;
  await requireClassManagerForProgram(programId);
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
  const user = await requireClassManagerForProgram(programId);
  const studentId = String(formData.get("studentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!studentId || !body) return;
  const visibleToFamily = formData.get("visibleToFamily") === "on";

  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, status: "ACTIVA" },
    select: { id: true },
  });
  if (!enrolled) return;

  const nota = await prisma.studentNote.create({
    data: { studentId, programId, authorId: user.id, body, visibleToFamily },
    select: { id: true, program: { select: { name: true } } },
  });
  if (visibleToFamily) {
    notificarFamilias([studentId], {
      title: nota.program ? `Anotación de ${nota.program.name}` : "Nueva anotación de Gigi's",
      body: resumen(body),
      url: "/mi-espacio/mensajes",
      tag: `nota-${nota.id}`,
    });
  }
  revalidatePath(`/calendario/${programId}`);
  revalidatePath(`/estudiantes/${studentId}`);
  // La anotación visible es un mensaje para la familia: sin esto tardaba en
  // aparecerle en Mi espacio.
  if (visibleToFamily) {
    revalidatePath("/mi-espacio");
    revalidatePath("/mi-espacio/mensajes");
  }
}

/**
 * Borra una anotación. La terapeuta solo las suyas; dirección, coordinación y operación
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
  if (user.role === "TERAPEUTA" && note.authorId !== user.id) return;

  await prisma.studentNote.delete({ where: { id: noteId } });
  if (note.programId) revalidatePath(`/calendario/${note.programId}`);
  revalidatePath(`/estudiantes/${note.studentId}`);
  // Retirar algo que la familia no debería ver tiene que desaparecerlo de su
  // bandeja de inmediato, no cuando caduque la caché.
  revalidatePath("/mi-espacio");
  revalidatePath("/mi-espacio/mensajes");
}
