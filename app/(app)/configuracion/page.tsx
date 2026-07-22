import Link from "next/link";
import { ClipboardText, LockOpen, Lock } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { getLegalConfig } from "@/lib/legal";
import { listCycles, getActiveCycle } from "@/lib/queries";
import { getSurveyConfig, getSurveyResults } from "@/lib/survey";
import { setCycleSurveyOpen } from "@/lib/actions/survey";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LegalConfigForm } from "@/components/legal-config-form";
import { SurveyConfigForm } from "@/components/survey-config-form";
import { SurveyResults } from "@/components/survey-results";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  // Ajustes de la plataforma: textos legales y encuesta. Solo la dirección.
  await requireRole("DIRECTORA");
  const { ciclo } = await searchParams;
  const [legal, survey, cycles, activeCycle] = await Promise.all([
    getLegalConfig(),
    getSurveyConfig(),
    listCycles(),
    getActiveCycle(),
  ]);

  const selectedCycleId =
    (ciclo && cycles.some((c) => c.id === ciclo) ? ciclo : null) ??
    activeCycle?.id ??
    cycles[0]?.id ??
    "";
  const results = selectedCycleId ? await getSurveyResults(selectedCycleId) : null;

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          title="Configuración"
          subtitle="Ajustes de la plataforma: el aviso de privacidad y el reglamento que aceptan las familias, y la encuesta de satisfacción de fin de ciclo."
        />
        <LegalConfigForm
          avisoPrivacidad={legal.avisoPrivacidad}
          reglamento={legal.reglamento}
          version={legal.version}
          updatedAt={legal.updatedAt.toISOString()}
        />
      </div>

      {/* Encuesta de satisfacción */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
            <ClipboardText weight="fill" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">
              Encuesta de satisfacción
            </h2>
            <p className="text-sm text-muted">
              Edita las preguntas y abre la encuesta al cerrar un ciclo. Mientras esté
              abierta, las familias deben contestarla para entrar a su espacio.
            </p>
          </div>
        </div>

        {/* Preguntas */}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Preguntas</h3>
          <SurveyConfigForm initial={survey.questions} />
        </Card>

        {/* Abrir / cerrar por ciclo */}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Encuesta por ciclo</h3>
          <ul className="space-y-2">
            {cycles.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border p-3"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {c.label}
                  {c.active && (
                    <span className="rounded-full bg-info-weak px-2 py-0.5 text-[0.7rem] font-bold text-info">
                      Ciclo activo
                    </span>
                  )}
                  {c.surveyOpen && (
                    <span className="rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                      Encuesta abierta
                    </span>
                  )}
                </span>
                <form action={setCycleSurveyOpen.bind(null, c.id, !c.surveyOpen)}>
                  <button
                    type="submit"
                    className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-bold transition-colors ${
                      c.surveyOpen
                        ? "border border-border text-muted hover:bg-surface-2 hover:text-ink"
                        : "bg-primary text-white hover:opacity-90"
                    }`}
                  >
                    {c.surveyOpen ? (
                      <>
                        <Lock className="size-4" />
                        Cerrar encuesta
                      </>
                    ) : (
                      <>
                        <LockOpen className="size-4" />
                        Abrir encuesta
                      </>
                    )}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        {/* Resultados */}
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">Resultados</h3>
            {cycles.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {cycles.map((c) => {
                  const active = c.id === selectedCycleId;
                  return (
                    <Link
                      key={c.id}
                      href={`/configuracion?ciclo=${c.id}`}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "bg-surface-2 text-muted hover:text-ink"
                      }`}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          {results ? (
            <SurveyResults results={results} />
          ) : (
            <p className="text-sm text-muted">No hay ciclos para mostrar.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
