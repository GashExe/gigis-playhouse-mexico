"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/dal";
import { ProgramSchema, ProgramGroupSchema, ScheduleSlotsSchema } from "@/lib/validators";
import { getActiveCycle } from "@/lib/queries";

export type ProgramFormState =
  | { errors?: Record<string, string[]>; ok?: boolean }
  | undefined;

const PALETTE = [
  "#E4572E", "#2E86AB", "#8AA624", "#C05299", "#F2A541",
  "#3E7C59", "#6C63FF", "#D7263D", "#0EAD9C", "#B5651D",
];

/** Convierte un campo de texto a entero (o null si viene vacío/no numérico). */
function toInt(value: string | undefined): number | null {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) && value?.trim() ? Math.trunc(n) : null;
}

function parseProgramForm(formData: FormData) {
  return ProgramSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    color: formData.get("color") ?? "",
    schedule: formData.get("schedule") ?? "",
    type: formData.get("type") ?? "",
    ageMin: formData.get("ageMin") ?? "",
    ageMax: formData.get("ageMax") ?? "",
    studentCapacity: formData.get("studentCapacity") ?? "",
    collaboratorCapacity: formData.get("collaboratorCapacity") ?? "",
    teacherId: formData.get("teacherId") ?? "",
    // Casilla: el formulario manda un hidden "0" y, si está palomeada, además un
    // "1". Se lee la ÚLTIMA entrada porque `get()` devuelve la primera, y así
    // apagar la casilla sí llega al servidor.
    allowFamilyEnroll: String(formData.getAll("allowFamilyEnroll").at(-1) ?? "1"),
    coordination: formData.get("coordination") ?? "",
  });
}

/**
 * Lee el horario estructurado del formulario (campo oculto "slots" en JSON).
 * Si el JSON viene mal formado se ignora y no se toca el horario guardado:
 * mejor conservar lo que había que borrarlo por un fallo del cliente.
 */
function parseSlots(formData: FormData) {
  const raw = String(formData.get("slots") ?? "");
  if (!raw) return null;
  try {
    const parsed = ScheduleSlotsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Campos de actividad comunes a crear/editar. */
function activityData(d: ReturnType<typeof ProgramSchema.parse>) {
  return {
    schedule: d.schedule || null,
    type: d.type || null,
    ageMin: toInt(d.ageMin),
    ageMax: toInt(d.ageMax),
    studentCapacity: toInt(d.studentCapacity) ?? 7,
    collaboratorCapacity: toInt(d.collaboratorCapacity),
    allowFamilyEnroll: d.allowFamilyEnroll !== "0",
    coordination: d.coordination || null,
    teacherId: d.teacherId || null,
  };
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const count = await prisma.program.count();
  // Se oferta en el ciclo activo. Sin esto nacería fuera de todo ciclo y, como la
  // lista filtra por ciclo, el programa recién creado desaparecería de la pantalla.
  const cycle = await getActiveCycle();
  const program = await prisma.program.create({
    data: {
      name: d.name,
      description: d.description || null,
      area: d.area || null,
      color: d.color || PALETTE[count % PALETTE.length],
      ...activityData(d),
      ...(cycle ? { cycles: { connect: { id: cycle.id } } } : {}),
    },
  });

  const slots = parseSlots(formData);
  if (slots && slots.length > 0) {
    // Programa recién creado: aún no tiene niveles, así que el horario es de todo
    // el programa (sin nivel). Se ignora cualquier programLevelId que venga.
    await prisma.scheduleSlot.createMany({
      data: slots.map((s) => ({
        programId: program.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
  }


  revalidatePath("/programas");
  revalidatePath("/panel");
  return { ok: true };
}

export async function updateProgram(
  id: string,
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await prisma.program.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      area: d.area || null,
      color: d.color || null,
      ...activityData(d),
    },
  });

  // El horario estructurado se reemplaza completo: lo que quedó en el editor es
  // la verdad. null = el campo no vino o vino roto; en ese caso no se toca.
  const slots = parseSlots(formData);
  if (slots) {
    // El horario puede colgar de un nivel (programas por niveles) o del programa
    // completo (programLevelId null). Se valida que el nivel sea de ESTE programa;
    // cualquier id ajeno o inválido se degrada a horario de programa.
    const validLevelIds = new Set(
      (
        await prisma.programLevel.findMany({
          where: { programId: id },
          select: { id: true },
        })
      ).map((l) => l.id),
    );
    const rows = slots.map((s) => ({
      programId: id,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      programLevelId:
        s.programLevelId && validLevelIds.has(s.programLevelId) ? s.programLevelId : null,
    }));
    await prisma.$transaction([
      // SOLO el horario del programa. Las horas que pertenecen a un grupo se editan
      // en el grupo; borrarlas aquí dejaría a los seis grupos de Habilidades sociales
      // sin hora por haber guardado la descripción del programa.
      prisma.scheduleSlot.deleteMany({ where: { programId: id, programGroupId: null } }),
      ...(rows.length > 0 ? [prisma.scheduleSlot.createMany({ data: rows })] : []),
    ]);
  }

  revalidatePath("/programas");
  revalidatePath("/panel");
  revalidatePath("/calendario");
  return { ok: true };
}

// ── Grupos ──────────────────────────────────────────────────────────────────

export type GroupFormState =
  | { errors?: Record<string, string[]>; ok?: boolean; error?: string }
  | undefined;

/**
 * Crea o edita un grupo con su hora. El grupo es la unidad que se llena: carga la
 * edad y los lugares, y de él cuelga el horario.
 *
 * Su horario se reemplaza completo por la fila del formulario: un grupo ES una hora.
 */
export async function saveProgramGroup(
  programId: string,
  groupId: string | null,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const parsed = ProgramGroupSchema.safeParse({
    name: formData.get("name"),
    programLevelId: formData.get("programLevelId") ?? "",
    ageMin: formData.get("ageMin") ?? "",
    ageMax: formData.get("ageMax") ?? "",
    studentCapacity: formData.get("studentCapacity") ?? "",
    weekday: formData.get("weekday") ?? "",
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  if (d.endTime <= d.startTime) {
    return { errors: { endTime: ["La clase tiene que terminar después de empezar."] } };
  }

  // El nivel tiene que ser de ESTE programa: un id ajeno dejaría el grupo colgando
  // de un nivel de otra actividad.
  const levelId = d.programLevelId
    ? (
        await prisma.programLevel.findFirst({
          where: { id: d.programLevelId, programId },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const data = {
    programId,
    programLevelId: levelId,
    name: d.name,
    ageMin: toInt(d.ageMin),
    ageMax: toInt(d.ageMax),
    studentCapacity: toInt(d.studentCapacity),
  };
  const slot = {
    programId,
    programLevelId: levelId,
    weekday: Number(d.weekday),
    startTime: d.startTime,
    endTime: d.endTime,
  };

  if (groupId) {
    await prisma.$transaction([
      prisma.programGroup.update({ where: { id: groupId }, data }),
      prisma.scheduleSlot.deleteMany({ where: { programGroupId: groupId } }),
      prisma.scheduleSlot.create({ data: { ...slot, programGroupId: groupId } }),
    ]);
  } else {
    const created = await prisma.programGroup.create({ data });
    await prisma.scheduleSlot.create({ data: { ...slot, programGroupId: created.id } });
  }

  revalidatePath("/programas");
  revalidatePath("/calendario");
  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Borra un grupo. Si tiene gente inscrita NO se borra: las inscripciones quedarían
 * sin hora y nadie sabría a qué clase va cada quien. Primero hay que moverlos.
 */
export async function deleteProgramGroup(groupId: string): Promise<GroupFormState> {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const inscritos = await prisma.enrollment.count({
    where: { programGroupId: groupId, status: "ACTIVA" },
  });
  if (inscritos > 0) {
    return {
      error: `Ese grupo tiene ${inscritos} ${inscritos === 1 ? "participante inscrito" : "participantes inscritos"}. Muévelos a otro grupo antes de borrarlo.`,
    };
  }
  await prisma.programGroup.delete({ where: { id: groupId } });
  revalidatePath("/programas");
  revalidatePath("/calendario");
  revalidatePath("/panel");
  return { ok: true };
}

export async function toggleProgram(id: string, active: boolean) {
  await requireWriter("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  await prisma.program.update({ where: { id }, data: { active } });
  revalidatePath("/programas");
  revalidatePath("/panel");
}

/**
 * Activa un ciclo. Solo uno puede estar activo: es el periodo en el que se inscribe
 * y se califica, así que dos activos a la vez dejarían "el ciclo actual" ambiguo.
 * Solo la directora arma el calendario escolar.
 */
export async function activateCycle(cycleId: string) {
  await requireWriter("DIRECTORA");
  await prisma.$transaction([
    prisma.cycle.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.cycle.update({ where: { id: cycleId }, data: { active: true } }),
  ]);
  revalidatePath("/programas");
  revalidatePath("/panel");
}

/** Pone o quita un programa de la oferta de un ciclo. */
export async function setProgramInCycle(
  programId: string,
  cycleId: string,
  offered: boolean,
) {
  await requireWriter("DIRECTORA");
  await prisma.program.update({
    where: { id: programId },
    data: {
      cycles: offered ? { connect: { id: cycleId } } : { disconnect: { id: cycleId } },
    },
  });
  revalidatePath("/programas");
}
