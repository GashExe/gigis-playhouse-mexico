import { FileXls, UsersThree, CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import {
  listPrograms,
  listCycles,
  getActiveCycle,
  getProgramCycleReport,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PrintButton } from "@/components/print-button";
import { edadLabel } from "@/lib/utils";

export const metadata = { title: "Reportes" };

const GENDER_LABEL: Record<string, string> = {
  FEMENINO: "Femenino",
  MASCULINO: "Masculino",
  OTRO: "Otro",
  "Sin dato": "Sin dato",
};

/** Barra horizontal simple para las distribuciones (sin librería de gráficas). */
function DistBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-medium text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold text-ink">
        {count} · {pct}%
      </span>
    </div>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string; ciclo?: string }>;
}) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const { programa, ciclo } = await searchParams;
  const [programs, cycles, activeCycle] = await Promise.all([
    listPrograms(),
    listCycles(),
    getActiveCycle(),
  ]);

  const selectedProgramId =
    (programa && programs.some((p) => p.id === programa) ? programa : null) ??
    programs[0]?.id ??
    "";
  const selectedCycleId =
    (ciclo && cycles.some((c) => c.id === ciclo) ? ciclo : null) ??
    activeCycle?.id ??
    cycles[0]?.id ??
    "";

  const report =
    selectedProgramId && selectedCycleId
      ? await getProgramCycleReport(selectedProgramId, selectedCycleId)
      : null;

  const genderColors: Record<string, string> = {
    FEMENINO: "var(--brand-purple)",
    MASCULINO: "var(--brand-teal)",
    OTRO: "#F2A541",
    "Sin dato": "var(--border-strong)",
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <PageHeader
          title="Reporte por programa y ciclo"
          subtitle="Participantes con edad y sexo, y el estado de su donativo. Descárgalo a Excel o imprímelo."
        />
        {report && report.totals.total > 0 && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/reportes?programa=${selectedProgramId}&ciclo=${selectedCycleId}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm font-bold text-ink transition-colors hover:border-primary"
            >
              <FileXls weight="fill" className="size-4 text-success-strong" />
              Excel
            </a>
            <PrintButton label="Imprimir / PDF" />
          </div>
        )}
      </div>

      {/* Selectores de programa y ciclo */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1 text-xs font-semibold text-subtle">
          Programa
          <select
            name="programa"
            defaultValue={selectedProgramId}
            className="h-10 rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm text-ink"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-subtle">
          Ciclo
          <select
            name="ciclo"
            defaultValue={selectedCycleId}
            className="h-10 rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm text-ink"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-bold text-white transition-colors hover:opacity-90"
        >
          Ver reporte
        </button>
      </form>

      {!report ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-12 text-center text-sm text-muted">
          Elige un programa y un ciclo para ver el reporte.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Encabezado del reporte (visible al imprimir) */}
          <div className="hidden print:block">
            <h1 className="text-xl font-extrabold text-ink">
              {report.program.name} · {report.cycle.label}
            </h1>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
                <UsersThree weight="fill" className="size-[1.05rem]" />
              </span>
              <p className="mt-2 text-2xl font-extrabold text-ink">{report.totals.total}</p>
              <p className="text-xs font-semibold text-muted">Participantes</p>
            </Card>
            <Card className="p-4">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-success-weak text-success-strong">
                <CheckCircle weight="fill" className="size-[1.05rem]" />
              </span>
              <p className="mt-2 text-2xl font-extrabold text-ink">
                {report.totals.alCorriente}
              </p>
              <p className="text-xs font-semibold text-muted">Donativo al corriente</p>
            </Card>
            <Card className="p-4">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-warning-weak text-warning-strong">
                <Clock weight="fill" className="size-[1.05rem]" />
              </span>
              <p className="mt-2 text-2xl font-extrabold text-ink">
                {report.totals.pendientes}
              </p>
              <p className="text-xs font-semibold text-muted">Donativo pendiente</p>
            </Card>
          </div>

          {/* Distribuciones */}
          {report.totals.total > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-bold text-ink">Por sexo</h2>
                <div className="space-y-2.5">
                  {Object.entries(report.totals.byGender)
                    .filter(([, n]) => n > 0)
                    .map(([g, n]) => (
                      <DistBar
                        key={g}
                        label={GENDER_LABEL[g] ?? g}
                        count={n}
                        total={report.totals.total}
                        color={genderColors[g] ?? "var(--brand-teal)"}
                      />
                    ))}
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-bold text-ink">Por edad</h2>
                <div className="space-y-2.5">
                  {Object.entries(report.totals.byAge)
                    .filter(([, n]) => n > 0)
                    .map(([bucket, n]) => (
                      <DistBar
                        key={bucket}
                        label={`${bucket} años`}
                        count={n}
                        total={report.totals.total}
                        color="var(--primary)"
                      />
                    ))}
                </div>
              </Card>
            </div>
          )}

          {/* Tabla de participantes */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-xs font-semibold text-subtle">
                    <th className="px-4 py-2.5">Participante</th>
                    <th className="px-4 py-2.5">Matrícula</th>
                    <th className="px-4 py-2.5">Edad</th>
                    <th className="px-4 py-2.5">Sexo</th>
                    <th className="px-4 py-2.5">Donativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.participants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        No hay participantes inscritos en este programa y ciclo.
                      </td>
                    </tr>
                  ) : (
                    report.participants.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-semibold text-ink">
                          {p.firstName} {p.lastName}
                        </td>
                        <td className="px-4 py-2.5 text-muted">{p.matricula ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted">
                          {edadLabel(p.birthDate) ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {p.gender ? GENDER_LABEL[p.gender] : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.alCorriente ? (
                            <span className="rounded-full bg-success-weak px-2 py-0.5 text-xs font-bold text-success-strong">
                              Al corriente
                            </span>
                          ) : (
                            <span className="rounded-full bg-warning-weak px-2 py-0.5 text-xs font-bold text-warning-strong">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
