import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EvalFormat } from "@/lib/generated/prisma/client";

/**
 * Estructura de una plantilla: niveles → bloques → temas. La comparten las tres vías
 * de arrancar la evaluación de un programa nuevo (en blanco, copiando otro programa,
 * o desde una plantilla base), así que todas terminan escribiendo lo mismo.
 */
export const StructureSchema = z.array(
  z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    blocks: z.array(
      z.object({
        name: z.string().trim().min(1),
        code: z.string().trim().nullable().optional(),
        items: z.array(z.string().trim().min(1)),
      }),
    ),
  }),
);

export type Structure = z.infer<typeof StructureSchema>;

const codeForItem = (i: number) => (i < 26 ? String.fromCharCode(97 + i) : "a" + (i - 25));

/** Lee la estructura de un programa existente, para copiarla. */
export async function readStructure(programId: string): Promise<Structure> {
  const levels = await prisma.programLevel.findMany({
    where: { programId },
    orderBy: { order: "asc" },
    select: {
      name: true,
      description: true,
      blocks: {
        orderBy: { order: "asc" },
        select: {
          name: true,
          code: true,
          items: { orderBy: { order: "asc" }, select: { text: true } },
        },
      },
    },
  });
  return levels.map((l) => ({
    name: l.name,
    description: l.description,
    blocks: l.blocks.map((b) => ({
      name: b.name,
      code: b.code,
      items: b.items.map((i) => i.text),
    })),
  }));
}

/**
 * Escribe una estructura sobre un programa. Solo para programas SIN plantilla: no
 * borra ni reordena nada, así que no puede pisar calificaciones ya registradas.
 * El orden y los códigos se generan por posición.
 */
export async function writeStructure(programId: string, structure: Structure) {
  const yaTiene = await prisma.programLevel.count({ where: { programId } });
  if (yaTiene > 0) return;

  for (let li = 0; li < structure.length; li++) {
    const l = structure[li];
    const level = await prisma.programLevel.create({
      data: {
        programId,
        order: li + 1,
        name: l.name,
        description: l.description ?? null,
      },
    });
    for (let bi = 0; bi < l.blocks.length; bi++) {
      const b = l.blocks[bi];
      const block = await prisma.evalBlock.create({
        data: {
          levelId: level.id,
          order: bi + 1,
          name: b.name,
          code: b.code ?? `${li + 1}.${bi + 1}`,
        },
      });
      await prisma.evalItem.createMany({
        data: b.items.map((text, ii) => ({
          blockId: block.id,
          order: ii + 1,
          code: codeForItem(ii),
          text,
        })),
      });
    }
  }
}

/** Plantillas base de la biblioteca, para elegir al crear un programa. */
export async function listPresets() {
  const presets = await prisma.templatePreset.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, evalFormat: true, structure: true },
  });
  return presets.map((p) => {
    const parsed = StructureSchema.safeParse(p.structure);
    const structure: Structure = parsed.success ? parsed.data : [];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      evalFormat: p.evalFormat as EvalFormat,
      levels: structure.length,
      blocks: structure.reduce((a, l) => a + l.blocks.length, 0),
      items: structure.reduce(
        (a, l) => a + l.blocks.reduce((b, x) => b + x.items.length, 0),
        0,
      ),
    };
  });
}
