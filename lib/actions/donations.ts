"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

/**
 * Campañas de donativos. Las arma y administra la DIRECCIÓN. El cumplimiento se
 * marca a mano (los donativos a veces son en especie, no un monto que se sume
 * solo). Si la campaña es obligatoria y la familia no cumple, se le restringe
 * apartar clases hasta que cumpla o reciba una prórroga.
 */

/** "YYYY-MM-DD" → Date a medianoche UTC (convención @db.Date del proyecto). */
function parseDateInput(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function parseAmount(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    goalLabel: String(formData.get("goalLabel") ?? "").trim() || null,
    goalAmount: parseAmount(formData.get("goalAmount")),
    mandatory: formData.get("mandatory") != null,
    dueDate: parseDateInput(formData.get("dueDate")),
  };
}

export async function createCampaign(formData: FormData) {
  await requireRole(); // solo DIRECTORA
  const data = fields(formData);
  if (!data.title) return;
  const campaign = await prisma.donationCampaign.create({ data });
  await logAudit({
    action: "donativo.campana.alta",
    summary: `Creó la campaña de donativos «${campaign.title}»${data.mandatory ? " (obligatoria)" : ""}`,
    entityType: "DonationCampaign",
    entityId: campaign.id,
  });
  revalidatePath("/donativos");
  redirect(`/donativos/${campaign.id}`);
}

export async function updateCampaign(formData: FormData) {
  await requireRole();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const data = fields(formData);
  if (!data.title) return;
  await prisma.donationCampaign.update({ where: { id }, data });
  await logAudit({
    action: "donativo.campana.editar",
    summary: `Editó la campaña de donativos «${data.title}»`,
    entityType: "DonationCampaign",
    entityId: id,
  });
  revalidatePath("/donativos");
  revalidatePath(`/donativos/${id}`);
}

export async function setCampaignActive(formData: FormData) {
  await requireRole();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const campaign = await prisma.donationCampaign.update({
    where: { id },
    data: { active },
    select: { title: true },
  });
  await logAudit({
    action: "donativo.campana.estado",
    summary: `${active ? "Reabrió" : "Cerró"} la campaña «${campaign.title}»`,
    entityType: "DonationCampaign",
    entityId: id,
  });
  revalidatePath("/donativos");
  revalidatePath(`/donativos/${id}`);
}

export async function deleteCampaign(formData: FormData) {
  await requireRole();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const campaign = await prisma.donationCampaign.delete({
    where: { id },
    select: { title: true },
  });
  await logAudit({
    action: "donativo.campana.baja",
    summary: `Eliminó la campaña de donativos «${campaign.title}»`,
    entityType: "DonationCampaign",
    entityId: id,
  });
  revalidatePath("/donativos");
  redirect("/donativos");
}

// ── Estado de cada familia en una campaña ────────────────────────────────────

/** Marca el donativo de una familia como CUMPLIDO (registra monto/nota si los dio). */
export async function markContributionDone(formData: FormData) {
  await requireRole();
  const campaignId = String(formData.get("campaignId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  if (!campaignId || !studentId) return;
  const amount = parseAmount(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.donationContribution.upsert({
    where: { campaignId_studentId: { campaignId, studentId } },
    update: { status: "CUMPLIDO", amount, note, graceUntil: null },
    create: { campaignId, studentId, status: "CUMPLIDO", amount, note },
  });
  await logAudit({
    action: "donativo.cumplido",
    summary: "Marcó el donativo como cumplido",
    entityType: "DonationCampaign",
    entityId: campaignId,
    studentId,
  });
  revalidatePath(`/donativos/${campaignId}`);
  revalidatePath("/donativos");
  revalidatePath("/mi-espacio");
}

/** Da una prórroga (tiempo de gracia) a la familia hasta cierta fecha. */
export async function grantContributionGrace(formData: FormData) {
  await requireRole();
  const campaignId = String(formData.get("campaignId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const graceUntil = parseDateInput(formData.get("graceUntil"));
  if (!campaignId || !studentId || !graceUntil) return;

  await prisma.donationContribution.upsert({
    where: { campaignId_studentId: { campaignId, studentId } },
    update: { status: "GRACIA", graceUntil },
    create: { campaignId, studentId, status: "GRACIA", graceUntil },
  });
  await logAudit({
    action: "donativo.gracia",
    summary: "Otorgó una prórroga para el donativo",
    entityType: "DonationCampaign",
    entityId: campaignId,
    studentId,
  });
  revalidatePath(`/donativos/${campaignId}`);
  revalidatePath("/donativos");
  revalidatePath("/mi-espacio");
}

/** Reabre el donativo de la familia (vuelve a PENDIENTE, quita la prórroga). */
export async function resetContribution(formData: FormData) {
  await requireRole();
  const campaignId = String(formData.get("campaignId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  if (!campaignId || !studentId) return;

  await prisma.donationContribution.upsert({
    where: { campaignId_studentId: { campaignId, studentId } },
    update: { status: "PENDIENTE", graceUntil: null },
    create: { campaignId, studentId, status: "PENDIENTE" },
  });
  await logAudit({
    action: "donativo.reabrir",
    summary: "Reabrió el donativo (pendiente)",
    entityType: "DonationCampaign",
    entityId: campaignId,
    studentId,
  });
  revalidatePath(`/donativos/${campaignId}`);
  revalidatePath("/donativos");
  revalidatePath("/mi-espacio");
}
