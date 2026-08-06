"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { COORDINATION_LABEL } from "@/lib/roles";

/**
 * El organigrama de la casa. Se arma a mano y no se deduce de las cuentas porque
 * en la estructura hay gente que no entra a la plataforma —patronato, voluntariado,
 * administración— y un árbol sacado solo de las cuentas los dejaría fuera.
 *
 * Cuando una caja SÍ es una cuenta se liga con `userId`: así su rol y sus programas
 * salen al día sin tener que actualizarlos en dos lados.
 */

export type OrgFormState = { error?: string; ok?: boolean } | undefined;

function campos(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    parentId: String(formData.get("parentId") ?? "") || null,
    userId: String(formData.get("userId") ?? "") || null,
  };
}

export async function createOrgNode(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  await requireWriter("DIRECTORA");
  const d = campos(formData);
  if (!d.name) return { error: "Escribe el nombre." };

  // Va al final de sus hermanos.
  const ultimo = await prisma.orgNode.findFirst({
    where: { parentId: d.parentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.orgNode.create({
    data: { ...d, order: (ultimo?.order ?? -1) + 1 },
  });

  await logAudit({
    action: "organigrama.editar",
    summary: `Agregó a ${d.name} al organigrama`,
    entityType: "OrgNode",
  });
  revalidatePath("/organigrama");
  return { ok: true };
}

export async function updateOrgNode(
  id: string,
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  await requireWriter("DIRECTORA");
  const d = campos(formData);
  if (!d.name) return { error: "Escribe el nombre." };
  // Colgarse de sí mismo (o de su propia gente) partiría el árbol en dos.
  if (d.parentId === id) return { error: "Una caja no puede depender de sí misma." };
  if (d.parentId && (await esDescendiente(id, d.parentId))) {
    return { error: "No puedes colgarla de alguien que ya depende de ella." };
  }

  await prisma.orgNode.update({ where: { id }, data: d });
  await logAudit({
    action: "organigrama.editar",
    summary: `Editó a ${d.name} en el organigrama`,
    entityType: "OrgNode",
    entityId: id,
  });
  revalidatePath("/organigrama");
  return { ok: true };
}

/** Borra la caja. Su gente sube un nivel en vez de desaparecer con ella. */
export async function deleteOrgNode(id: string) {
  await requireWriter("DIRECTORA");
  const node = await prisma.orgNode.findUnique({
    where: { id },
    select: { name: true, parentId: true },
  });
  if (!node) return;
  await prisma.$transaction([
    prisma.orgNode.updateMany({
      where: { parentId: id },
      data: { parentId: node.parentId },
    }),
    prisma.orgNode.delete({ where: { id } }),
  ]);
  await logAudit({
    action: "organigrama.editar",
    summary: `Quitó a ${node.name} del organigrama`,
    entityType: "OrgNode",
  });
  revalidatePath("/organigrama");
}

/** Sube o baja una caja entre sus hermanas. */
export async function moveOrgNode(id: string, dir: "arriba" | "abajo") {
  await requireWriter("DIRECTORA");
  const node = await prisma.orgNode.findUnique({
    where: { id },
    select: { id: true, parentId: true, order: true },
  });
  if (!node) return;
  const vecino = await prisma.orgNode.findFirst({
    where: {
      parentId: node.parentId,
      order: dir === "arriba" ? { lt: node.order } : { gt: node.order },
    },
    orderBy: { order: dir === "arriba" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!vecino) return; // ya está en la punta
  await prisma.$transaction([
    prisma.orgNode.update({ where: { id: node.id }, data: { order: vecino.order } }),
    prisma.orgNode.update({ where: { id: vecino.id }, data: { order: node.order } }),
  ]);
  revalidatePath("/organigrama");
}

/**
 * Propone el árbol con las cuentas activas: dirección arriba, las coordinaciones
 * debajo, y cada terapeuta colgando de la coordinación de los programas que da (o
 * de dirección si no da ninguno). Es un punto de partida para no empezar de cero;
 * a partir de ahí se acomoda a mano.
 *
 * Solo corre con el organigrama vacío: si ya hay algo armado, rehacerlo borraría
 * el trabajo de dirección.
 */
export async function seedOrgFromAccounts(): Promise<OrgFormState> {
  await requireWriter("DIRECTORA");
  if ((await prisma.orgNode.count()) > 0) {
    return { error: "El organigrama ya tiene cajas: acomódalo a mano." };
  }

  const users = await prisma.user.findMany({
    where: { active: true, role: { not: "ALUMNO" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      coordination: true,
      programs: { where: { active: true }, select: { coordination: true } },
    },
  });
  if (users.length === 0) return { error: "No hay cuentas activas todavía." };

  const directoras = users.filter((u) => u.role === "DIRECTORA");
  const coordinadores = users.filter((u) => u.role === "COORDINADOR");
  const resto = users.filter((u) => !["DIRECTORA", "COORDINADOR"].includes(u.role));

  const TITULO: Record<string, string> = {
    DIRECTORA: "Dirección general",
    COORDINADOR: "Coordinación",
    GESTORA_OPERACIONES: "Operación",
    TERAPEUTA: "Terapeuta",
    LECTOR: "Consulta",
  };

  // Raíz: la primera dirección. Si no hay ninguna, una caja de dirección vacía.
  const raiz = await prisma.orgNode.create({
    data: {
      name: directoras[0]?.name ?? "Dirección",
      title: "Dirección general",
      userId: directoras[0]?.id ?? null,
      order: 0,
    },
    select: { id: true },
  });

  // Las demás direcciones cuelgan de la raíz.
  let orden = 0;
  for (const d of directoras.slice(1)) {
    await prisma.orgNode.create({
      data: { name: d.name, title: TITULO.DIRECTORA, userId: d.id, parentId: raiz.id, order: orden++ },
    });
  }

  // Coordinaciones, y de cada una su gente.
  const nodoPorCoordinacion = new Map<string, string>();
  for (const c of coordinadores) {
    const node = await prisma.orgNode.create({
      data: {
        name: c.name,
        title: c.coordination
          ? `Coordinación de ${COORDINATION_LABEL[c.coordination].toLowerCase()}`
          : "Coordinación",
        userId: c.id,
        parentId: raiz.id,
        order: orden++,
      },
      select: { id: true },
    });
    if (c.coordination && !nodoPorCoordinacion.has(c.coordination)) {
      nodoPorCoordinacion.set(c.coordination, node.id);
    }
  }

  for (const u of resto) {
    // La terapeuta cuelga de la coordinación de los programas que da; si no da
    // ninguno (o son de varias), queda bajo dirección para acomodarla a mano.
    const coords = new Set(
      u.programs.map((p) => p.coordination).filter((c): c is NonNullable<typeof c> => !!c),
    );
    const única = coords.size === 1 ? [...coords][0] : null;
    const parentId = (única && nodoPorCoordinacion.get(única)) || raiz.id;
    await prisma.orgNode.create({
      data: { name: u.name, title: TITULO[u.role] ?? null, userId: u.id, parentId, order: orden++ },
    });
  }

  await logAudit({
    action: "organigrama.editar",
    summary: `Armó el organigrama con ${users.length} cuentas activas`,
    entityType: "OrgNode",
  });
  revalidatePath("/organigrama");
  return { ok: true };
}

/** ¿`posibleHijo` cuelga (directa o indirectamente) de `id`? */
async function esDescendiente(id: string, posibleHijo: string): Promise<boolean> {
  const nodes = await prisma.orgNode.findMany({ select: { id: true, parentId: true } });
  const padreDe = new Map(nodes.map((n) => [n.id, n.parentId]));
  let cursor: string | null | undefined = posibleHijo;
  // El tope evita quedarse dando vueltas si por lo que sea hay un ciclo guardado.
  for (let i = 0; i < nodes.length && cursor; i++) {
    if (cursor === id) return true;
    cursor = padreDe.get(cursor) ?? null;
  }
  return false;
}
