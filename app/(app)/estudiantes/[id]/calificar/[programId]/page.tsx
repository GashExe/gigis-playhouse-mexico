import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Stack } from "@phosphor-icons/react/dist/ssr";
import { requireGraderForProgram } from "@/lib/dal";
import {
  getStudent,
  getProgramBasics,
  listCycles,
  getActiveCycle,
  getGradingData,
} from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GradingPanel } from "@/components/grading-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; programId: string }>;
}) {
  const { programId } = await params;
  const program = await getProgramBasics(programId);
  return { title: program ? `Calificar · ${program.name}` : "Calificar" };
}

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programId: string }>;
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const { id, programId } = await params;
  // La maestra solo entra a calificar los programas a su cargo.
  await requireGraderForProgram(programId);
  const { ciclo } = await searchParams;

  const [student, program, cycles, activeCycle] = await Promise.all([
    getStudent(id),
    getProgramBasics(programId),
    listCycles(),
    getActiveCycle(),
  ]);
  if (!student || !program) notFound();

  const validCiclo = ciclo && cycles.some((c) => c.id === ciclo) ? ciclo : null;
  const selectedCycleId = validCiclo ?? activeCycle?.id ?? cycles[0]?.id ?? "";
  const data = selectedCycleId
    ? await getGradingData(id, programId, selectedCycleId)
    : null;

  const backHref = `/estudiantes/${id}${selectedCycleId ? `?ciclo=${selectedCycleId}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {student.firstName} {student.lastName}
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-input)]"
            style={{
              backgroundColor: (program.color ?? "var(--primary)") + "22",
              color: program.color ?? "var(--primary)",
            }}
          >
            <Stack weight="fill" className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">{program.name}</h1>
            <p className="text-sm text-muted">Calificación por bloques</p>
          </div>
        </div>

        {/* Selector de ciclo (enlaces, sin JS) */}
        {cycles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cycles.map((c) => {
              const active = c.id === selectedCycleId;
              return (
                <Link
                  key={c.id}
                  href={`/estudiantes/${id}/calificar/${programId}?ciclo=${c.id}`}
                  className={`rounded-[var(--radius-input)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {c.label}
                  {c.active ? " · actual" : ""}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {!data ? (
        <Card className="p-4">
          <EmptyState
            icon={<Stack weight="fill" className="size-6" />}
            title="Aún no está ubicado en un nivel"
            description={`Primero ubica a ${student.firstName} en un nivel de ${program.name} desde su expediente para poder calificar.`}
            action={
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
              >
                Ir al expediente
              </Link>
            }
          />
        </Card>
      ) : data.blocks.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={<Stack weight="fill" className="size-6" />}
            title="Este nivel aún no tiene bloques"
            description={`El nivel "${data.level.name}" de ${program.name} no tiene una plantilla de bloques cargada todavía.`}
          />
        </Card>
      ) : (
        <GradingPanel
          studentId={id}
          programId={programId}
          cycleId={selectedCycleId}
          levelName={data.level.name}
          passThreshold={program.passThreshold}
          blocks={data.blocks}
        />
      )}
    </div>
  );
}
