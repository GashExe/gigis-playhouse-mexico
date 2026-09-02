"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { coversProgramId, getCurrentUser, requireWriter } from "@/lib/dal";
import { getActiveCycle, familyDonationHold, meetsAgeRequirement } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { enrollStudent, occupiedSeats } from "@/lib/enroll";
import { groupOptionsForStudent, occupiedGroupSeats } from "@/lib/groups";
import { resolvePlacement } from "@/lib/placement";
import {
  checkEnrollmentLoad,
  findScheduleClash,
  isDroppedByStaff,
} from "@/lib/enrollment-rules";
import { ageFrom } from "@/lib/utils";

/**
 * Lista de espera. La familia se forma en las actividades que quiere —aunque
 * queden lugares, aunque no sea para su edad, aunque el grupo lo arme dirección— y
 * coordinación decide a quién le da lugar. Aceptar INSCRIBE en el mismo movimiento:
 * dejar "aceptado pero sin inscribir" sería un estado que alguien tendría que
 * recordar terminar a mano.
 *
 * El lugar en la fila es la hora en que pidió (`requestedAt`), no un número
 * guardado: una posición almacenada habría que renumerarla en cada cancelación y
 * se desincroniza a la primera escritura que falle.
 */

/** La familia se forma en una actividad del ciclo activo. */
export async function requestWaitlist(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const cycle = await getActiveCycle();
  if (!cycle) return;

  // Compuerta de donativos: la misma que para inscribir. Si formarse fuera libre,
  // aceptar desde la lista de espera inscribiría por la puerta de atrás a una
  // familia que tiene la inscripción en pausa.
  if ((await familyDonationHold(studentId)).length > 0) return;

  const program = await prisma.program.findFirst({
    where: { id: programId, active: true, cycles: { some: { id: cycle.id } } },
    select: { id: true, name: true, ageMin: true, ageMax: true },
  });
  if (!program) return;

  // EDAD: la lista de espera es una fila para entrar a la actividad, no una puerta
  // aparte. Si formarse fuera libre, la familia quedaría esperando un lugar que
  // nadie le puede dar, y coordinación tendría que decirle que no una por una.
  const alumno = await prisma.student.findUnique({
    where: { id: studentId },
    select: { birthDate: true },
  });
  if (!meetsAgeRequirement(ageFrom(alumno?.birthDate), program.ageMin, program.ageMax)) {
    return;
  }

  // Ya inscrito: no hay nada que esperar.
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, programId, cycleId: cycle.id, status: "ACTIVA" },
    select: { id: true },
  });
  if (enrolled) return;

  // Baja decidida por dirección. Formarse aquí sería la puerta trasera a la única
  // regla cuyo propósito entero es que la familia no vuelva a entrar sola.
  if (await isDroppedByStaff(studentId, programId, cycle.id)) return;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true },
  });
  if (!student) return;

  // `requestedAt` se refresca al volver a pedir: quien se salió de la fila vuelve
  // al final. Es la regla que se le puede explicar a un papá sin que suene injusta.
  await prisma.waitlistRequest.upsert({
    where: { studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id } },
    update: {
      status: "EN_ESPERA",
      message: String(formData.get("message") ?? "") || null,
      requestedAt: new Date(),
      decidedAt: null,
      decidedById: null,
      decisionNote: null,
    },
    create: {
      studentId,
      programId,
      cycleId: cycle.id,
      message: String(formData.get("message") ?? "") || null,
    },
  });

  await logAudit({
    action: "espera.solicitud",
    summary: `${student.firstName} ${student.lastName} pidió lugar en la lista de espera de ${program.name} (${cycle.label})`,
    entityType: "Program",
    entityId: program.id,
    studentId,
  });

  revalidatePath("/mi-espacio/lista-espera");
  revalidatePath("/lista-espera");
}

/** La familia se sale de la fila. Si insiste después, vuelve al final. */
export async function cancelWaitlist(programId: string) {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return;
  const studentId = user.studentId;
  const cycle = await getActiveCycle();
  if (!cycle) return;

  const { count } = await prisma.waitlistRequest.updateMany({
    where: { studentId, programId, cycleId: cycle.id, status: "EN_ESPERA" },
    data: { status: "CANCELADA", decidedAt: new Date() },
  });
  if (count === 0) return;

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { name: true },
  });
  await logAudit({
    action: "espera.cancela",
    summary: `La familia se salió de la lista de espera de ${program?.name ?? "una actividad"} (${cycle.label})`,
    entityType: "Program",
    entityId: programId,
    studentId,
  });

  revalidatePath("/mi-espacio/lista-espera");
  revalidatePath("/lista-espera");
}

export type WaitlistDecisionState =
  | {
      ok?: boolean;
      error?: string;
      /** Reparos que coordinación tiene que confirmar para inscribir de todos modos. */
      warnings?: string[];
    }
  | undefined;

/**
 * Coordinación le da lugar: lo inscribe en el mismo movimiento. Si hay reparos
 * (cupo lleno, tope de actividades, edad o empalme) se los enseña y espera la
 * confirmación, igual que la inscripción desde el expediente.
 */
export async function acceptWaitlist(
  requestId: string,
  _prev: WaitlistDecisionState,
  formData: FormData,
): Promise<WaitlistDecisionState> {
  const user = await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const force = String(formData.get("force") ?? "") === "1";
  // Una coordinación con área asignada resuelve solo lo de la suya.
  const request0 = await prisma.waitlistRequest.findUnique({
    where: { id: requestId },
    select: { programId: true },
  });
  if (request0 && !(await coversProgramId(user, request0.programId))) {
    return { error: "Esa actividad es de otra coordinación." };
  }

  const request = await prisma.waitlistRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      studentId: true,
      cycleId: true,
      student: { select: { firstName: true, lastName: true, birthDate: true } },
      cycle: { select: { label: true, maxEnrollments: true } },
      program: {
        select: {
          id: true,
          name: true,
          ageMin: true,
          ageMax: true,
          studentCapacity: true,
        },
      },
    },
  });
  if (!request) return { error: "Esa solicitud ya no existe." };
  // Dos coordinadores resolviendo la misma solicitud a la vez.
  if (request.status !== "EN_ESPERA") return { error: "Esa solicitud ya se resolvió." };

  const { studentId, cycleId, program } = request;
  const age = ageFrom(request.student.birthDate);

  // El grupo, cuando el programa los reparte. Si le cuadra más de uno, aceptar desde
  // aquí lo dejaría sin hora: no hay dónde preguntarle a la familia a cuál va. En ese
  // caso se manda al expediente, que es la puerta que sí sabe escoger grupo.
  const placement = await resolvePlacement(studentId, program.id, cycleId);
  const opciones = await groupOptionsForStudent(studentId, program.id, cycleId, {
    levelId: placement?.levelId ?? null,
    age,
  });
  const grupo = opciones.length === 1 ? opciones[0] : null;
  if (opciones.length > 1) {
    return {
      error: `${program.name} tiene más de un horario para ${request.student.firstName} (${opciones
        .map((g) => g.scheduleLabel)
        .join(" o ")}). Inscríbelo desde su expediente para escoger a cuál va.`,
    };
  }

  const ocupados = grupo
    ? await occupiedGroupSeats(grupo.id, cycleId)
    : await occupiedSeats(program.id, cycleId);
  const cupo = grupo ? grupo.capacity : program.studentCapacity;
  const load = await checkEnrollmentLoad(studentId, cycleId, {
    max: request.cycle.maxEnrollments,
    excludeProgramId: program.id,
  });
  const clash = await findScheduleClash(studentId, cycleId, program.id, grupo?.id ?? null);
  const ageOk = grupo
    ? meetsAgeRequirement(age, grupo.ageMin, grupo.ageMax)
    : meetsAgeRequirement(age, program.ageMin, program.ageMax);

  // La EDAD no es un reparo que se pueda autorizar desde aquí: la lista de espera
  // es la fila de entrada, y dejar pasar por ella a quien no cumple la edad sería
  // la puerta trasera de la regla. Si dirección de veras quiere meterlo, lo hace
  // desde el expediente, que es donde queda constancia de quién lo autorizó.
  if (!ageOk) {
    return {
      error: `${request.student.firstName} está fuera del rango de edad de ${program.name}. Si aun así hay que inscribirlo, hazlo desde su expediente.`,
    };
  }

  const warnings = [
    ocupados >= cupo &&
      `El cupo está lleno (${ocupados} de ${cupo})${grupo ? ` en ${grupo.scheduleLabel}` : ""}.`,
    load.full && `Ya lleva ${load.current} de ${load.max} actividades del ciclo.`,
    clash && `Se empalma con ${clash.programName} (${clash.label}).`,
  ].filter(Boolean) as string[];
  if (warnings.length > 0 && !force) return { warnings };

  const salvedad =
    warnings.length > 0 ? ` (con reparos; autorizado por ${user.name})` : "";
  await enrollStudent({
    studentId,
    programId: program.id,
    cycleId,
    programGroupId: grupo?.id ?? null,
    notes: "Inscrito desde la lista de espera",
    audit: {
      action: "espera.acepta",
      summary: `Le dio lugar en ${program.name} desde la lista de espera (${request.cycle.label})${salvedad}`,
      entityType: "Program",
      entityId: program.id,
    },
  });
  // `enrollStudent` ya cerró la solicitud; aquí solo queda de quién fue la decisión.
  await prisma.waitlistRequest.update({
    where: { id: requestId },
    data: {
      status: "ACEPTADA",
      decidedAt: new Date(),
      decidedById: user.id,
      decisionNote: String(formData.get("decisionNote") ?? "") || null,
    },
  });

  revalidatePath("/lista-espera");
  revalidatePath("/mi-espacio");
  revalidatePath("/mi-espacio/lista-espera");
  revalidatePath(`/estudiantes/${studentId}`);
  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Coordinación no le da lugar. NUNCA toca la `Reservation`: rechazar aquí no puede
 * significar "dirección lo dio de baja", que es lo que allá cerraría la actividad
 * para todo el ciclo.
 */
export async function rejectWaitlist(requestId: string, formData: FormData) {
  const user = await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const request = await prisma.waitlistRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      studentId: true,
      program: { select: { name: true, id: true } },
      cycle: { select: { label: true } },
    },
  });
  if (!request || request.status !== "EN_ESPERA") return;
  if (!(await coversProgramId(user, request.program.id))) return;

  await prisma.waitlistRequest.update({
    where: { id: requestId },
    data: {
      status: "RECHAZADA",
      decidedAt: new Date(),
      decidedById: user.id,
      decisionNote: String(formData.get("decisionNote") ?? "") || null,
    },
  });

  await logAudit({
    action: "espera.rechaza",
    summary: `No le dio lugar en ${request.program.name} desde la lista de espera (${request.cycle.label})`,
    entityType: "Program",
    entityId: request.program.id,
    studentId: request.studentId,
  });

  revalidatePath("/lista-espera");
  revalidatePath("/mi-espacio/lista-espera");
}
