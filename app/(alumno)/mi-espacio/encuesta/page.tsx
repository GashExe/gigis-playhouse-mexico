import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { getActiveCycle } from "@/lib/queries";
import { getSurveyConfig, hasSurveyResponse } from "@/lib/survey";
import { SurveyForm } from "@/components/survey-form";

export const metadata: Metadata = { title: "Encuesta de satisfacción" };

export default async function EncuestaPage() {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO" || !user.studentId) redirect("/mi-espacio");
  const studentId = user.studentId;

  const cycle = await getActiveCycle();
  // Si no hay encuesta abierta o ya la contestó, no hay nada que llenar aquí.
  if (!cycle?.surveyOpen) redirect("/mi-espacio");
  if (await hasSurveyResponse(studentId, cycle.id)) redirect("/mi-espacio");

  const config = await getSurveyConfig();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ClipboardText weight="fill" className="size-5 text-primary" />
          Encuesta de fin de ciclo
        </p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          Cuéntanos cómo te fue este ciclo
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tu opinión nos ayuda a mejorar. Es rápida y necesaria para seguir usando tu
          espacio. Ciclo <span className="font-semibold text-ink">{cycle.label}</span>.
        </p>
      </div>

      <SurveyForm questions={config.questions} />
    </div>
  );
}
