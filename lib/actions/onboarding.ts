"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { OnboardingSchema } from "@/lib/validators";
import { getLegalConfig } from "@/lib/legal";

export type OnboardingState =
  | { errors?: Record<string, string[]>; error?: string }
  | undefined;

/**
 * Primer ingreso del tutor: guarda datos básicos del participante + cuestionario
 * de salud y registra la aceptación del aviso de privacidad y el reglamento.
 * Solo cuentas ALUMNO ligadas a un participante. Al terminar, abre el acceso a clases.
 */
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) {
    redirect("/login");
  }

  const parsed = OnboardingSchema.safeParse({
    birthDate: formData.get("birthDate"),
    gender: formData.get("gender"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    guardianEmail: formData.get("guardianEmail") ?? "",
    address: formData.get("address") ?? "",
    bloodType: formData.get("bloodType") ?? "",
    allergies: formData.get("allergies") ?? "",
    medications: formData.get("medications") ?? "",
    medicalConditions: formData.get("medicalConditions") ?? "",
    therapies: formData.get("therapies") ?? "",
    dietaryRestrictions: formData.get("dietaryRestrictions") ?? "",
    doctorName: formData.get("doctorName") ?? "",
    doctorPhone: formData.get("doctorPhone") ?? "",
    emergencyName: formData.get("emergencyName") ?? "",
    emergencyPhone: formData.get("emergencyPhone") ?? "",
    emergencyRelation: formData.get("emergencyRelation") ?? "",
    healthNotes: formData.get("healthNotes") ?? "",
    acceptPrivacy: formData.get("acceptPrivacy") ?? "",
    acceptRules: formData.get("acceptRules") ?? "",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // Los dos consentimientos son obligatorios para dar acceso a clases.
  if (d.acceptPrivacy !== "on" || d.acceptRules !== "on") {
    return {
      error: "Para continuar debes aceptar el aviso de privacidad y el reglamento.",
    };
  }

  const now = new Date();
  const legal = await getLegalConfig();
  const healthData = {
    bloodType: d.bloodType || null,
    allergies: d.allergies || null,
    medications: d.medications || null,
    medicalConditions: d.medicalConditions || null,
    therapies: d.therapies || null,
    dietaryRestrictions: d.dietaryRestrictions || null,
    doctorName: d.doctorName || null,
    doctorPhone: d.doctorPhone || null,
    emergencyName: d.emergencyName || null,
    emergencyPhone: d.emergencyPhone || null,
    emergencyRelation: d.emergencyRelation || null,
    notes: d.healthNotes || null,
  };

  await prisma.student.update({
    where: { id: user.studentId },
    data: {
      // fecha "YYYY-MM-DD" a medianoche UTC (evita corrimiento por zona horaria)
      birthDate: new Date(`${d.birthDate}T00:00:00Z`),
      gender: d.gender,
      guardianName: d.guardianName,
      guardianPhone: d.guardianPhone,
      guardianEmail: d.guardianEmail || null,
      address: d.address || null,
      privacyAcceptedAt: now,
      rulesAcceptedAt: now,
      consentVersion: legal.version,
      onboardingCompletedAt: now,
      health: {
        upsert: { create: healthData, update: healthData },
      },
    },
  });

  revalidatePath("/mi-espacio");
  redirect("/mi-espacio");
}
