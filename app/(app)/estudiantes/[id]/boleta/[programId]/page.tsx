import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/dal";
import { getStudent, getStudentGradeHistory } from "@/lib/queries";
import { edadLabel } from "@/lib/utils";
import { fechaDia, fechaDiaLarga } from "@/lib/format";
import { ProgressBar, BlockList } from "@/components/grade-report";
import { PrintButton } from "@/components/print-button";

const GENDER_LABEL: Record<string, string> = {
  FEMENINO: "Femenino",
  MASCULINO: "Masculino",
  OTRO: "Otro",
};

const PLACEMENT_LABEL: Record<string, string> = {
  REGULAR: "En curso",
  PROBATORIO: "En reforzamiento",
  POSIBLE_GRADUADO: "Por graduarse",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; programId: string }>;
}) {
  const { id } = await params;
  const student = await getStudent(id);
  return { title: student ? `Boleta · ${student.firstName} ${student.lastName}` : "Boleta" };
}

export default async function BoletaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programId: string }>;
  searchParams: Promise<{ ciclo?: string }>;
}) {
  await requireStaff();
  const { id, programId } = await params;
  const { ciclo } = await searchParams;
  const [student, history] = await Promise.all([
    getStudent(id),
    getStudentGradeHistory(id, programId),
  ]);
  if (!student) notFound();

  const group = history[0] ?? null; // getStudentGradeHistory acotado a un programa: un grupo
  const entries = group?.entries ?? [];
  // Ciclo elegido: el de la URL si existe, si no el más reciente.
  const entry = entries.find((e) => e.cycle.id === ciclo) ?? entries[0] ?? null;
  const color = group?.program.color ?? "var(--brand-teal)";
  const edad = edadLabel(student.birthDate);

  return (
    <div>
      {/* Barra de acciones (no se imprime) */}
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/estudiantes/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          {student.firstName} {student.lastName}
        </Link>
        {entry && <PrintButton label="Imprimir boleta" />}
      </div>

      {/* Selector de ciclo (no se imprime) */}
      {entries.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2 print:hidden">
          {entries.map((e) => {
            const active = e.cycle.id === entry?.cycle.id;
            return (
              <Link
                key={e.cycle.id}
                href={`/estudiantes/${id}/boleta/${programId}?ciclo=${e.cycle.id}`}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {e.cycle.label}
              </Link>
            );
          })}
        </div>
      )}

      {!entry ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-12 text-center text-sm text-muted">
          No hay calificaciones registradas de {student.firstName} en esta asignatura.
        </div>
      ) : (
        <article className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)] print:border-0 print:shadow-none sm:p-8">
          {/* Encabezado de la boleta */}
          <header className="border-b border-border pb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-strong">
              Gigi&apos;s Playhouse México
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
              Boleta de calificaciones
            </h1>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div>
                <dt className="text-xs text-subtle">Participante</dt>
                <dd className="font-semibold text-ink">
                  {student.firstName} {student.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Matrícula</dt>
                <dd className="font-semibold text-ink">{student.matricula ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Asignatura</dt>
                <dd className="font-semibold text-ink">{group?.program.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Ciclo</dt>
                <dd className="font-semibold text-ink">{entry.cycle.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Edad / sexo</dt>
                <dd className="font-semibold text-ink">
                  {edad ?? "—"}
                  {student.gender ? ` · ${GENDER_LABEL[student.gender]}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Calificado el</dt>
                <dd className="font-semibold text-ink">{fechaDiaLarga(entry.gradedAt)}</dd>
              </div>
            </dl>
          </header>

          {/* Nivel y avance general */}
          <section className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs text-subtle">Nivel</p>
                <p className="text-lg font-bold text-ink">{entry.levelName}</p>
                {entry.levelDescription && (
                  <p className="text-xs text-muted">{entry.levelDescription}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold text-ink">{entry.overall}%</p>
                <p className="text-xs text-subtle">avance del nivel</p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar percent={entry.overall} color={color} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Situación: {PLACEMENT_LABEL[entry.placement] ?? entry.placement}
            </p>
          </section>

          {/* Detalle por bloque */}
          <section className="mt-5">
            <h2 className="text-sm font-bold text-ink">Avance por bloque</h2>
            {entry.blocks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Este nivel aún no tiene bloques capturados en la plantilla.
              </p>
            ) : (
              <BlockList blocks={entry.blocks} color={color} />
            )}
          </section>

          {entry.note && (
            <section className="mt-5 rounded-[var(--radius-control)] bg-surface-2 p-3 print:border print:border-border">
              <h2 className="text-xs font-bold text-ink">Observaciones</h2>
              <p className="mt-1 text-sm text-muted">{entry.note}</p>
            </section>
          )}

          <footer className="mt-8 border-t border-border pt-4 text-xs text-subtle">
            Escala 1–4 (4 = dominado). Documento generado el {fechaDia(new Date())}.
          </footer>
        </article>
      )}
    </div>
  );
}
