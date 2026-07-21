import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartStraight } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { getOnboardingData } from "@/lib/queries";
import { getLegalConfig, needsOnboarding } from "@/lib/legal";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function BienvenidaPage() {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) redirect("/panel");

  const [student, legal] = await Promise.all([
    getOnboardingData(user.studentId),
    getLegalConfig(),
  ]);
  if (!student) redirect("/mi-espacio");

  // Si ya completó el onboarding con la versión vigente, no hay nada que llenar.
  if (!needsOnboarding(student, legal.version)) redirect("/mi-espacio");

  const firstName = student.firstName.split(" ")[0];
  const h = student.health;

  return (
    <div className="space-y-6">
      <section>
        <span className="flex size-12 items-center justify-center rounded-full text-white shadow-[var(--shadow-sm)]" style={{ backgroundColor: "var(--brand-pink)" }}>
          <HeartStraight weight="fill" className="size-6" />
        </span>
        <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          ¡Bienvenid@ a Gigi&apos;s, {firstName}!
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted">
          Antes de entrar a las clases, necesitamos completar los datos del participante,
          un breve cuestionario de salud y tu aceptación del aviso de privacidad y el
          reglamento. Solo se hace una vez.
        </p>
      </section>

      <OnboardingForm
        avisoPrivacidad={legal.avisoPrivacidad}
        reglamento={legal.reglamento}
        defaults={{
          birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : undefined,
          gender: student.gender ?? undefined,
          guardianName: student.guardianName ?? undefined,
          guardianPhone: student.guardianPhone ?? undefined,
          guardianEmail: student.guardianEmail ?? undefined,
          address: student.address ?? undefined,
          bloodType: h?.bloodType ?? undefined,
          allergies: h?.allergies ?? undefined,
          medications: h?.medications ?? undefined,
          medicalConditions: h?.medicalConditions ?? undefined,
          therapies: h?.therapies ?? undefined,
          dietaryRestrictions: h?.dietaryRestrictions ?? undefined,
          doctorName: h?.doctorName ?? undefined,
          doctorPhone: h?.doctorPhone ?? undefined,
          emergencyName: h?.emergencyName ?? undefined,
          emergencyPhone: h?.emergencyPhone ?? undefined,
          emergencyRelation: h?.emergencyRelation ?? undefined,
          healthNotes: h?.notes ?? undefined,
        }}
      />
    </div>
  );
}
