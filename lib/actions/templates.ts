"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

/**
 * Editor de PLANTILLAS de evaluación (niveles → bloques → temas). Solo la directora
 * y el coordinador de programas educativos pueden editarlas. La calificación de los
 * alumnos (ItemScore) NO se toca aquí; ojo: borrar un bloque/tema con calificaciones
 * las elimina en cascada (por eso el UI pide confirmación).
 */

async function gate() {
  return requireRole("DIRECTORA", "COORDINADOR");
}

function refresh(programId: string) {
  revalidatePath(`/programas/${programId}/plantilla`);
}

const EVAL_FORMATS = ["BLOQUES", "AREAS", "PLANO"] as const;
type EvalFormat = (typeof EVAL_FORMATS)[number];

/** Configuración de la plantilla del programa: formato y umbral para pasar de nivel. */
export async function setProgramEvalConfig(programId: string, formData: FormData) {
  await gate();
  const rawFormat = String(formData.get("evalFormat") ?? "BLOQUES");
  const evalFormat: EvalFormat = (EVAL_FORMATS as readonly string[]).includes(rawFormat)
    ? (rawFormat as EvalFormat)
    : "BLOQUES";
  const threshold = Math.min(100, Math.max(1, Number(formData.get("passThreshold")) || 80));
  await prisma.program.update({
    where: { id: programId },
    data: { evalFormat, passThreshold: threshold },
  });
  refresh(programId);
}

// ---------- Niveles ----------

export async function addLevel(programId: string, formData: FormData) {
  await gate();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;
  const max = await prisma.programLevel.aggregate({
    where: { programId },
    _max: { order: true },
  });
  await prisma.programLevel.create({
    data: { programId, name, description, order: (max._max.order ?? 0) + 1 },
  });
  refresh(programId);
}

export async function updateLevel(levelId: string, programId: string, formData: FormData) {
  await gate();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;
  await prisma.programLevel.update({ where: { id: levelId }, data: { name, description } });
  refresh(programId);
}

export async function deleteLevel(levelId: string, programId: string) {
  await gate();
  await prisma.programLevel.delete({ where: { id: levelId } });
  refresh(programId);
}

export async function moveLevel(levelId: string, programId: string, dir: "up" | "down") {
  await gate();
  const rows = await prisma.programLevel.findMany({
    where: { programId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  await swap(rows, levelId, dir, (id, order) =>
    prisma.programLevel.update({ where: { id }, data: { order } }),
  );
  refresh(programId);
}

/** Duplica un nivel con todos sus bloques y temas, al final del programa. */
export async function cloneLevel(levelId: string, programId: string) {
  await gate();
  const level = await prisma.programLevel.findUnique({
    where: { id: levelId },
    include: { blocks: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
  });
  if (!level || level.programId !== programId) return;
  const max = await prisma.programLevel.aggregate({
    where: { programId },
    _max: { order: true },
  });
  await prisma.programLevel.create({
    data: {
      programId,
      order: (max._max.order ?? 0) + 1,
      name: `${level.name} (copia)`,
      description: level.description,
      blocks: {
        create: level.blocks.map((b) => ({
          code: b.code,
          name: b.name,
          order: b.order,
          description: b.description,
          items: { create: b.items.map((i) => ({ code: i.code, text: i.text, order: i.order })) },
        })),
      },
    },
  });
  refresh(programId);
}

// ---------- Bloques ----------

export async function addBlock(levelId: string, programId: string, formData: FormData) {
  await gate();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!name) return;
  const max = await prisma.evalBlock.aggregate({ where: { levelId }, _max: { order: true } });
  await prisma.evalBlock.create({
    data: { levelId, name, code, order: (max._max.order ?? 0) + 1 },
  });
  refresh(programId);
}

export async function updateBlock(blockId: string, programId: string, formData: FormData) {
  await gate();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!name) return;
  await prisma.evalBlock.update({ where: { id: blockId }, data: { name, code } });
  refresh(programId);
}

export async function deleteBlock(blockId: string, programId: string) {
  await gate();
  await prisma.evalBlock.delete({ where: { id: blockId } });
  refresh(programId);
}

export async function moveBlock(
  blockId: string,
  levelId: string,
  programId: string,
  dir: "up" | "down",
) {
  await gate();
  const rows = await prisma.evalBlock.findMany({
    where: { levelId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  await swap(rows, blockId, dir, (id, order) =>
    prisma.evalBlock.update({ where: { id }, data: { order } }),
  );
  refresh(programId);
}

// ---------- Temas ----------

export async function addItem(blockId: string, programId: string, formData: FormData) {
  await gate();
  const text = String(formData.get("text") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!text) return;
  const max = await prisma.evalItem.aggregate({ where: { blockId }, _max: { order: true } });
  await prisma.evalItem.create({
    data: { blockId, text, code, order: (max._max.order ?? 0) + 1 },
  });
  refresh(programId);
}

export async function updateItem(itemId: string, programId: string, formData: FormData) {
  await gate();
  const text = String(formData.get("text") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!text) return;
  await prisma.evalItem.update({ where: { id: itemId }, data: { text, code } });
  refresh(programId);
}

export async function deleteItem(itemId: string, programId: string) {
  await gate();
  await prisma.evalItem.delete({ where: { id: itemId } });
  refresh(programId);
}

export async function moveItem(
  itemId: string,
  blockId: string,
  programId: string,
  dir: "up" | "down",
) {
  await gate();
  const rows = await prisma.evalItem.findMany({
    where: { blockId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  await swap(rows, itemId, dir, (id, order) =>
    prisma.evalItem.update({ where: { id }, data: { order } }),
  );
  refresh(programId);
}

/**
 * Intercambia el `order` de un elemento con su vecino (arriba/abajo). Usa un valor
 * temporal (-1) para no chocar con el índice único (scope, order) durante el swap.
 */
async function swap(
  rows: { id: string; order: number }[],
  id: string,
  dir: "up" | "down",
  update: (id: string, order: number) => Promise<unknown>,
) {
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const a = rows[i];
  const b = rows[j];
  await update(a.id, -1); // temporal, libera el índice de `a`
  await update(b.id, a.order);
  await update(a.id, b.order);
}
