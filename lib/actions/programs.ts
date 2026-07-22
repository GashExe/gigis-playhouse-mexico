"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { ProgramSchema, ScheduleSlotsSchema } from "@/lib/validators";
import { getActiveCycle } from "@/lib/queries";
import { readStructure, writeStructure, StructureSchema } from "@/lib/templates";

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
    teacherId: d.teacherId || null,
  };
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireRole("DIRECTORA", "COORDINADOR");
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

  // De dónde sale su evaluación: en blanco, copiada de otro programa, o de una
  // plantilla base. Si algo falla, el programa igual queda creado y su plantilla se
  // arma a mano desde el editor: no vale perder el programa por esto.
  const source = String(formData.get("templateSource") ?? "");
  try {
    if (source.startsWith("copy:")) {
      const from = source.slice(5);
      await writeStructure(program.id, await readStructure(from));
    } else if (source.startsWith("preset:")) {
      const preset = await prisma.templatePreset.findUnique({
        where: { id: source.slice(7) },
        select: { structure: true, evalFormat: true },
      });
      if (preset) {
        const parsed = StructureSchema.safeParse(preset.structure);
        if (parsed.success) await writeStructure(program.id, parsed.data);
        await prisma.program.update({
          where: { id: program.id },
          data: { evalFormat: preset.evalFormat },
        });
      }
    }
  } catch (e) {
    console.error("No se pudo copiar la plantilla al programa nuevo:", e);
  }

  revalidatePath("/programas");
  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Guarda la plantilla de un programa en la biblioteca, para reutilizarla al crear
 * otros. Sin esto la biblioteca nace vacía y no hay forma de llenarla.
 */
export async function saveAsPreset(programId: string, formData: FormData) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { evalFormat: true },
  });
  if (!program) return;
  const structure = await readStructure(programId);
  if (structure.length === 0) return;

  await prisma.templatePreset.create({
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      evalFormat: program.evalFormat,
      structure,
    },
  });
  revalidatePath("/programas");
}

export async function deletePreset(id: string) {
  await requireRole("DIRECTORA", "COORDINADOR");
  await prisma.templatePreset.delete({ where: { id } });
  revalidatePath("/programas");
}

export async function updateProgram(
  id: string,
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireRole("DIRECTORA", "COORDINADOR");
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
      prisma.scheduleSlot.deleteMany({ where: { programId: id } }),
      ...(rows.length > 0 ? [prisma.scheduleSlot.createMany({ data: rows })] : []),
    ]);
  }

  revalidatePath("/programas");
  revalidatePath("/panel");
  revalidatePath("/calendario");
  return { ok: true };
}

export async function toggleProgram(id: string, active: boolean) {
  await requireRole("DIRECTORA", "COORDINADOR");
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
  await requireRole("DIRECTORA");
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
  await requireRole("DIRECTORA");
  await prisma.program.update({
    where: { id: programId },
    data: {
      cycles: offered ? { connect: { id: cycleId } } : { disconnect: { id: cycleId } },
    },
  });
  revalidatePath("/programas");
}
