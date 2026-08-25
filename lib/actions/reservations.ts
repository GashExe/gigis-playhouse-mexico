"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getActiveCycle, meetsAgeRequirement, familyDonationHold } from "@/lib/queries";
import { enrollStudent, occupiedSeats } from "@/lib/enroll";
import { effectiveSlots } from "@/lib/enrollment-rules";
import { findSlotClash, slotsLabel } from "@/lib/schedule";
import { logAudit } from "@/lib/audit";
import { ageFrom } from "@/lib/utils";

/**
 * La familia arma su inscripción del ciclo COMO UNA SOLA HOJA: palomea las
 * actividades que quiere, las despalomea si se arrepiente, y cuando está conforme
 * la manda. El envío es de una sola vez —se le advierte antes— y a partir de ahí el
 * listado se congela: lo que siga se habla con la dirección, que sí puede moverlo
 * desde el expediente.
 *
 * Antes cada actividad se inscribía sola en cuanto se apretaba su botón, y no había
 * manera de decir "ya terminé": la familia no podía corregirse y la casa no sabía si
 * lo que veía era la inscripción final o una a medias.
 *
 * Las reglas se vuelven a juzgar AQUÍ, sobre la selección entera. La pantalla ya las
 * aplica en vivo, pero es la pantalla: el empalme depende de lo que lleve palomeado,
 * así que revisarlo actividad por actividad al llegar dejaría pasar dos que chocan
 * entre sí. La `Reservation` sigue siendo la constancia de que fue la familia quien
 * apartó (y cuándo); la inscripción real es la `Enrollment`.
 */

export type EnrollmentSubmitState =
  | {
      ok?: boolean;
      error?: string;
      /** Lo que se quedó fuera y por qué (cupo que se llenó mientras decidía, etc.). */
      rejected?: string[];
    }
  | undefined;

/** Actividades del ciclo que la familia puede mover por su cuenta. */
const FAMILY_PROGRAM_SELECT = {
  id: true,
  name: true,
  studentCapacity: true,
  ageMin: true,
  ageMax: true,
  allowFamilyEnroll: true,
  scheduleSlots: {
    select: { weekday: true, startTime: true, endTime: true, programLevelId: true },
  },
} as const;

/**
 * La familia manda su selección de actividades del ciclo activo. Aplica la
 * diferencia contra lo que ya tenía: inscribe lo que palomeó de más y da de baja lo
 * que quitó. Al terminar deja la firma del envío, que es lo que cierra el listado.
 */
export async function submitEnrollmentSelection(
  programIds: string[],
): Promise<EnrollmentSubmitState> {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) return { error: "No es tu espacio." };
  const studentId = user.studentId;

  const cycle = await getActiveCycle();
  if (!cycle) return { error: "Todavía no hay un ciclo abierto." };

  // Ventanilla de la dirección. La pantalla ya no enseña el botón; esto cierra la
  // puerta de quien mande el formulario justo cuando se está cerrando.
  if (!cycle.enrollmentOpen) {
    return { error: "Las inscripciones están cerradas. Habla con la dirección." };
  }

  // Una sola vez por ciclo: es lo que se le advirtió antes de mandarla.
  const yaEnviada = await prisma.enrollmentSubmission.findUnique({
    where: { studentId_cycleId: { studentId, cycleId: cycle.id } },
    select: { id: true },
  });
  if (yaEnviada) {
    return {
      error:
        "Ya habías mandado tu inscripción de este ciclo. Para cambiarla, habla con la dirección.",
    };
  }

  // Compuerta de donativos: un donativo obligatorio sin cumplir (y sin prórroga)
  // pausa la inscripción completa.
  if ((await familyDonationHold(studentId)).length > 0) {
    return {
      error: "La inscripción está en pausa por un donativo obligatorio pendiente.",
    };
  }

  const [student, ofertados, actuales, reservations] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true, birthDate: true },
    }),
    prisma.program.findMany({
      where: { active: true, cycles: { some: { id: cycle.id } } },
      select: FAMILY_PROGRAM_SELECT,
    }),
    prisma.enrollment.findMany({
      where: { studentId, cycleId: cycle.id, status: "ACTIVA" },
      select: { id: true, programId: true },
    }),
    prisma.reservation.findMany({
      where: { studentId, cycleId: cycle.id, status: "RECHAZADA" },
      select: { programId: true },
    }),
  ]);
  if (!student) return { error: "No encontramos el expediente." };

  const programById = new Map(ofertados.map((p) => [p.id, p]));
  const inscritos = new Set(actuales.map((e) => e.programId));
  const dadosDeBajaPorDireccion = new Set(reservations.map((r) => r.programId));
  const age = ageFrom(student.birthDate);
  const rejected: string[] = [];

  // 1. La selección se acota a lo que la familia PUEDE mover. Lo que ya lleva de un
  //    grupo que arma dirección se queda dentro aunque no venga palomeado: no es de
  //    ella quitarlo.
  const pedidos = new Set(programIds.filter((id) => programById.has(id)));
  const seleccion = new Set<string>();
  for (const p of ofertados) {
    const yaLoLleva = inscritos.has(p.id);
    if (yaLoLleva && !p.allowFamilyEnroll) {
      seleccion.add(p.id); // grupo de dirección: intocable desde aquí
      continue;
    }
    if (!pedidos.has(p.id)) continue;
    if (yaLoLleva) {
      seleccion.add(p.id);
      continue;
    }
    // Altas nuevas: cada regla que no cumpla la deja fuera, con su razón.
    if (!p.allowFamilyEnroll) {
      rejected.push(`${p.name}: a esa actividad se entra por lista de la dirección.`);
      continue;
    }
    if (!meetsAgeRequirement(age, p.ageMin, p.ageMax)) {
      rejected.push(`${p.name}: está fuera del rango de edad.`);
      continue;
    }
    if (dadosDeBajaPorDireccion.has(p.id)) {
      rejected.push(`${p.name}: la dirección la dio de baja; háblalo con ella.`);
      continue;
    }
    seleccion.add(p.id);
  }

  // 2. Empalmes DENTRO de la selección: es la regla que solo se puede juzgar con la
  //    hoja completa en la mano. Se resuelve con el horario del nivel que le toca.
  const slotsOf = await effectiveSlots(studentId, cycle.id, ofertados);
  const aceptadas: string[] = [];
  for (const id of [...seleccion].sort((a, b) =>
    (programById.get(a)?.name ?? "").localeCompare(programById.get(b)?.name ?? "", "es"),
  )) {
    const mine = slotsOf.get(id) ?? [];
    // Un empalme siempre lo pierde la que llega después; las que ya lleva inscritas
    // van primero para que un choque nunca la saque de algo que ya tenía.
    const previas = aceptadas.filter((otro) => otro !== id);
    const choque = previas.find((otro) => findSlotClash(mine, slotsOf.get(otro) ?? []));
    if (choque && !inscritos.has(id)) {
      const label = slotsLabel(mine);
      rejected.push(
        `${programById.get(id)?.name}: se empalma con ${programById.get(choque)?.name}${label ? ` (${label})` : ""}.`,
      );
      continue;
    }
    aceptadas.push(id);
  }

  // 3. Tope de actividades del ciclo. Se recorta por nombre y lo que ya llevaba
  //    entra primero: quitarle algo que ya tenía por culpa del tope sería absurdo.
  let final = aceptadas;
  if (cycle.maxEnrollments != null && aceptadas.length > cycle.maxEnrollments) {
    const orden = [...aceptadas].sort((a, b) => {
      const ya = Number(inscritos.has(b)) - Number(inscritos.has(a));
      if (ya !== 0) return ya;
      return (programById.get(a)?.name ?? "").localeCompare(
        programById.get(b)?.name ?? "",
        "es",
      );
    });
    final = orden.slice(0, cycle.maxEnrollments);
    for (const id of orden.slice(cycle.maxEnrollments)) {
      rejected.push(
        `${programById.get(id)?.name}: pasa del tope de ${cycle.maxEnrollments} actividades del ciclo.`,
      );
    }
  }

  // 4. Cupo. Va hasta el final porque es lo único que puede cambiar mientras la
  //    familia decide: dos familias tomando el último lugar a la vez.
  const altas: string[] = [];
  for (const id of final) {
    if (inscritos.has(id)) continue;
    const program = programById.get(id)!;
    if ((await occupiedSeats(id, cycle.id)) >= program.studentCapacity) {
      rejected.push(`${program.name}: se llenó el cupo mientras armabas tu inscripción.`);
      continue;
    }
    altas.push(id);
  }
  const quedan = new Set([...final.filter((id) => inscritos.has(id)), ...altas]);
  const bajas = actuales.filter((e) => !quedan.has(e.programId));

  if (quedan.size === 0) {
    return {
      error:
        "No quedó ninguna actividad para inscribir. Revisa tu selección y vuelve a intentarlo.",
      rejected,
    };
  }

  // Altas: constancia de que fue la familia quien apartó, y la inscripción real.
  for (const programId of altas) {
    const program = programById.get(programId)!;
    await prisma.reservation.upsert({
      where: { studentId_programId_cycleId: { studentId, programId, cycleId: cycle.id } },
      update: { status: "APROBADA", decidedAt: new Date() },
      create: {
        studentId,
        programId,
        cycleId: cycle.id,
        status: "APROBADA",
        decidedAt: new Date(),
      },
    });
    await enrollStudent({
      studentId,
      programId,
      cycleId: cycle.id,
      notes: "Inscrito por la familia desde Mi espacio",
      audit: {
        summary: `${student.firstName} ${student.lastName} apartó lugar en ${program.name} (${cycle.label})`,
        entityType: "Program",
        entityId: programId,
      },
    });
  }

  // Bajas: la familia se arrepintió antes de mandar. NO se marca como baja de
  // dirección —esa marca es la que le cierra la actividad para todo el ciclo— sino
  // como reserva cancelada, que es exactamente lo que pasó.
  for (const e of bajas) {
    await prisma.enrollment.update({
      where: { id: e.id },
      data: { status: "FINALIZADA", endDate: new Date() },
    });
    await prisma.reservation.updateMany({
      where: { studentId, programId: e.programId, cycleId: cycle.id, status: "APROBADA" },
      data: { status: "CANCELADA", decidedAt: new Date() },
    });
  }

  // La firma. Si dos pestañas mandan a la vez, el @@unique deja pasar una sola.
  try {
    await prisma.enrollmentSubmission.create({
      data: { studentId, cycleId: cycle.id, programCount: quedan.size },
    });
  } catch {
    return { error: "Tu inscripción ya se había mandado." };
  }

  const nombres = [...quedan]
    .map((id) => programById.get(id)?.name ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
  await logAudit({
    action: "inscripcion.envio",
    summary: `${student.firstName} ${student.lastName} mandó su inscripción de ${cycle.label}: ${nombres.join(", ")}${bajas.length > 0 ? ` (quitó ${bajas.length})` : ""}`,
    entityType: "Cycle",
    entityId: cycle.id,
    studentId,
  });

  revalidatePath("/mi-espacio");
  revalidatePath("/mi-espacio/lista-espera");
  revalidatePath("/panel");
  revalidatePath(`/estudiantes/${studentId}`);
  return { ok: true, rejected };
}
