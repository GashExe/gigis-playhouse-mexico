"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { getLegalConfig } from "@/lib/legal";

/**
 * Edición de los textos legales (aviso de privacidad y reglamento) por la
 * dirección. Al guardar un cambio se genera una nueva `version`, lo que obliga a
 * todas las familias a aceptar de nuevo en su siguiente ingreso (la compuerta de
 * onboarding compara la versión aceptada contra la vigente).
 */

export type LegalConfigState =
  | { ok?: boolean; error?: string; version?: string; sinCambios?: boolean }
  | undefined;

/** Versión legible y siempre nueva: fecha y hora hasta el segundo. */
function nuevaVersion(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"); // 2026-07-21-14-30-05
}

export async function updateLegalConfig(
  _prev: LegalConfigState,
  formData: FormData,
): Promise<LegalConfigState> {
  const user = await requireRole("DIRECTORA");

  const avisoPrivacidad = String(formData.get("avisoPrivacidad") ?? "").trim();
  const reglamento = String(formData.get("reglamento") ?? "").trim();
  if (!avisoPrivacidad || !reglamento) {
    return { error: "El aviso de privacidad y el reglamento no pueden quedar vacíos." };
  }

  const current = await getLegalConfig();
  const changed =
    avisoPrivacidad !== current.avisoPrivacidad || reglamento !== current.reglamento;
  if (!changed) {
    return { ok: true, sinCambios: true, version: current.version };
  }

  const version = nuevaVersion();
  await prisma.legalConfig.update({
    where: { id: 1 },
    data: { avisoPrivacidad, reglamento, version, updatedById: user.id },
  });

  await logAudit({
    action: "config.legal.editar",
    summary: `Actualizó los textos legales (nueva versión ${version}); se pedirá a las familias aceptarlos de nuevo.`,
    entityType: "LegalConfig",
    entityId: "1",
  });

  // Las familias ven los textos en el onboarding; refrescamos esas rutas.
  revalidatePath("/configuracion");
  revalidatePath("/mi-espacio");
  revalidatePath("/mi-espacio/bienvenida");

  return { ok: true, version };
}
