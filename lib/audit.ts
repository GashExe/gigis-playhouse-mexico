import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Bitácora de cambios (auditoría). Registra quién movió qué —calificaciones,
 * inscripciones, ubicaciones de nivel y datos del participante— para dar
 * trazabilidad cuando hay varias manos en la plataforma. La consulta solo la
 * dirección (ver lib/queries → listAuditLog y la página /bitacora).
 *
 * Se llama desde las acciones que escriben datos. Nunca debe tumbar la operación
 * principal: si algo falla al registrar, se traga el error (mejor perder una línea
 * de bitácora que impedir guardar una calificación).
 */
export type AuditAction =
  | "calificacion.tema"
  | "nivel.ubicar"
  | "nivel.promover"
  | "nivel.quitar"
  | "inscripcion.alta"
  | "inscripcion.estado"
  | "inscripcion.baja"
  | "alumno.alta"
  | "alumno.editar"
  | "alumno.estado"
  | "alumno.baja"
  | "ciclo.continuidad"
  | "acceso.repone-contrasena"
  | "donativo.campana.alta"
  | "donativo.campana.editar"
  | "donativo.campana.estado"
  | "donativo.campana.baja"
  | "donativo.cumplido"
  | "donativo.gracia"
  | "donativo.reabrir"
  | "config.legal.editar";

type AuditInput = {
  action: AuditAction;
  summary: string;
  entityType?: string;
  entityId?: string;
  studentId?: string;
};

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.userId) return; // sin sesión no hay a quién atribuirlo
    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        actorName: session.name,
        actorRole: session.role,
        action: input.action,
        summary: input.summary,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        studentId: input.studentId ?? null,
      },
    });
  } catch (e) {
    console.error("No se pudo registrar en la bitácora:", e);
  }
}
