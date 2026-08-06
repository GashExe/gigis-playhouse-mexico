import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit, type AuditAction } from "@/lib/audit";
import { clearStaffDrop } from "@/lib/enrollment-rules";
import { ensurePlacementOnEnroll } from "@/lib/placement";

/**
 * El acto de inscribir, sin puerta.
 *
 * Las reglas de QUIÉN puede inscribirse a qué viven en `lib/enrollment-rules`; lo
 * que hay aquí es lo que pasa una vez que ya se decidió que sí. Lo comparten las
 * tres entradas —la familia desde Mi espacio, dirección desde el expediente y
 * coordinación al aceptar una lista de espera— para que inscribir signifique lo
 * mismo se entre por donde se entre. Cuando esto vivía dentro de cada acción, cada
 * una recordaba un pedazo distinto (una ubicaba el nivel, otra no).
 */

/** Cupo ocupado de un programa en un ciclo (inscripciones activas). */
export async function occupiedSeats(programId: string, cycleId: string): Promise<number> {
  return prisma.enrollment.count({
    where: { programId, cycleId, status: "ACTIVA" },
  });
}

export async function enrollStudent(input: {
  studentId: string;
  programId: string;
  cycleId: string;
  /** Nota de la inscripción. Solo se guarda si la inscripción nace aquí. */
  notes?: string | null;
  audit: { action?: AuditAction; summary: string; entityType?: string; entityId?: string };
}): Promise<void> {
  const { studentId, programId, cycleId } = input;

  // Puede existir una inscripción vieja pausada/finalizada de ese mismo ciclo.
  await prisma.enrollment.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId } },
    update: { status: "ACTIVA", endDate: null },
    create: { studentId, programId, cycleId, notes: input.notes ?? null },
  });

  // Si dirección la tenía cerrada, inscribir la reabre: la familia recupera el
  // control de esta actividad en Mi espacio.
  await clearStaffDrop(studentId, programId, cycleId);

  // Y si estaba formada esperando lugar, ya no espera nada. Va aquí y no en cada
  // acción para que no queden solicitudes fantasma de quien ya está dentro.
  await prisma.waitlistRequest.updateMany({
    where: { studentId, programId, cycleId, status: "EN_ESPERA" },
    data: { status: "ACEPTADA", decidedAt: new Date() },
  });

  await logAudit({
    action: input.audit.action ?? "inscripcion.alta",
    summary: input.audit.summary,
    entityType: input.audit.entityType ?? "Enrollment",
    entityId: input.audit.entityId ?? programId,
    studentId,
  });

  // Ubicación automática de nivel: recupera su nivel del historial o lo coloca en
  // el más bajo si es nuevo en el programa.
  await ensurePlacementOnEnroll(studentId, programId, cycleId);
}
