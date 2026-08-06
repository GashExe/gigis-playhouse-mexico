import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { canGradeProgram, getCurrentUser } from "@/lib/dal";
import { canRunClasses, isReadOnly } from "@/lib/roles";
import { getActiveCycle, getProgramAcademicReport, listCycles } from "@/lib/queries";
import { fechaDia } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { ScorePair, SCORE_MEANING } from "@/components/grade-report";

export const metadata = { title: "Reporte del grupo" };

const PLACEMENT_LABEL: Record<string, string> = {
  REGULAR: "En curso",
  PROBATORIO: "En reforzamiento",
  POSIBLE_GRADUADO: "Por graduarse",
};

/**
 * El grupo entero de una actividad en una hoja: nivel, calificación, avance y
 * asistencia de cada quien.
 *
 * Vive aquí y no en /reportes a propósito: aquella pantalla elige el programa por
 * la URL y lista todos, así que dejar entrar a la terapeuta ahí le abriría los
 * grupos ajenos escribiendo otro id. Aquí la compuerta es por programa.
 */
export default async function ReporteMateriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const { programId } = await params;
  const { ciclo } = await searchParams;

  const me = await getCurrentUser();
  const soloLectura = isReadOnly(me.role);
  const puedeCalificar = await canGradeProgram(programId);
  if (!soloLectura && !canRunClasses(me.role)) redirect("/panel");
  if (me.role === "TERAPEUTA" && !puedeCalificar) redirect("/panel");

  const [cycles, activeCycle] = await Promise.all([listCycles(), getActiveCycle()]);
  const selectedCycleId =
    (ciclo && cycles.some((c) => c.id === ciclo) ? ciclo : null) ??
    activeCycle?.id ??
    cycles[0]?.id ??
    "";
  const report = selectedCycleId
    ? await getProgramAcademicReport(programId, selectedCycleId)
    : null;
  if (!report) notFound();

  const { program, cycle, participants, totals } = report;
  const num = (n: number | null, dec = 1) => (n == null ? "—" : n.toFixed(dec));

  return (
    <div>
      {/* Barra de trabajo: no se imprime */}
      <div className="mb-5 print:hidden">
        <Link
          href={`/calendario/${programId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Panel de clase
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            Reporte del grupo
          </h1>
          <PrintButton label="Imprimir / PDF" />
        </div>
        {cycles.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cycles.map((c) => (
              <Link
                key={c.id}
                href={`/calendario/${programId}/reporte?ciclo=${c.id}`}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                  c.id === selectedCycleId
                    ? "bg-primary text-white"
                    : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <article className="mx-auto max-w-4xl rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)] print:border-0 print:shadow-none sm:p-8">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-strong">
            Gigi&apos;s Playhouse México
          </p>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">
            {program.name}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Dato label="Ciclo" value={cycle.label} />
            <Dato label="Terapeuta" value={program.teacher?.name ?? "Sin asignar"} />
            <Dato label="Participantes" value={String(totals.total)} />
            <Dato
              label="Clases registradas"
              value={
                report.ventanaAbierta
                  ? `${report.totalSessions} (todas las del programa)`
                  : `${report.totalSessions} en el ciclo`
              }
            />
          </dl>
          {report.ventanaAbierta && (
            <p className="mt-2 text-xs text-muted print:hidden">
              Este ciclo no tiene fechas puestas, así que se contaron todas las clases
              registradas del programa. Ponle fechas en Configuración para acotarlo.
            </p>
          )}
        </header>

        {/* Resumen del grupo */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Promedio inicial" value={num(totals.promedioInicial)} />
          <Tile label="Promedio final" value={num(totals.promedioFinal)} />
          <Tile
            label="Avance promedio"
            value={
              totals.promedioAvance == null
                ? "—"
                : `${totals.promedioAvance > 0 ? "+" : ""}${num(totals.promedioAvance)}`
            }
          />
          <Tile
            label="Asistencia promedio"
            value={totals.asistenciaPromedio == null ? "—" : `${Math.round(totals.asistenciaPromedio)}%`}
          />
        </div>

        {participants.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-muted">
            No hay participantes inscritos a esta actividad en {cycle.label}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th className="text-left">Participante</Th>
                  <Th className="text-left">Nivel</Th>
                  <Th>Calificación</Th>
                  <Th>Avance</Th>
                  <Th>Asistió</Th>
                  <Th>Faltó</Th>
                  <Th>Retardo</Th>
                  <Th>Justif.</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-border align-middle">
                    <Td className="text-left">
                      <span className="font-semibold text-ink">
                        {p.lastName}, {p.firstName}
                      </span>
                      {p.matricula && (
                        <span className="block text-xs text-subtle">{p.matricula}</span>
                      )}
                    </Td>
                    <Td className="text-left">
                      {p.levelName ?? <span className="text-subtle">Sin ubicar</span>}
                      {p.placement && p.placement !== "REGULAR" && (
                        <span className="block text-xs text-warning-strong">
                          {PLACEMENT_LABEL[p.placement]}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <ScorePair
                        initialScore={p.initialScore}
                        finalScore={p.finalScore}
                      />
                    </Td>
                    <Td className="tnum font-semibold">
                      {p.avance == null ? "—" : p.avance > 0 ? `+${p.avance}` : p.avance}
                    </Td>
                    <Td className="tnum">{p.presentes}</Td>
                    <Td className="tnum">{p.ausentes}</Td>
                    <Td className="tnum">{p.retardos}</Td>
                    <Td className="tnum">{p.justificadas}</Td>
                    <Td className="tnum font-bold">
                      {p.asistenciaPct == null ? "—" : `${p.asistenciaPct}%`}
                      {p.marcadas > 0 && (
                        <span className="block text-[0.65rem] font-normal text-subtle">
                          {`${p.marcadas} con lista`}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-6 space-y-1 border-t border-border pt-3 text-xs text-muted">
          <p>
            Escala 1–4:{" "}
            {Object.entries(SCORE_MEANING)
              .map(([n, texto]) => `${n} ${texto}`)
              .join(" · ")}
            . El retardo cuenta como asistencia; lo justificado no cuenta ni como
            asistencia ni como falta.
          </p>
          <p>
            El porcentaje se calcula sobre las clases donde sí se pasó lista a esa
            persona, no sobre el total: una lista sin pasar no es una falta.
          </p>
          <p>Documento generado el {fechaDia(new Date())}</p>
        </footer>
      </article>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="font-semibold text-muted">{label}:</dt>
      <dd className="min-w-0 flex-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface-2/50 px-3 py-2.5 text-center print:border-border">
      <p className="tnum text-xl font-extrabold text-ink">{value}</p>
      <p className="text-[0.7rem] font-semibold text-muted">{label}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-2 py-2 text-center text-xs font-bold text-muted ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2.5 text-center ${className}`}>{children}</td>;
}
