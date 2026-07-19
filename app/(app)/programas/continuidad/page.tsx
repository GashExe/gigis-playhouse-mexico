import Link from "next/link";
import { ArrowLeft, Info } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import {
  listCycles,
  getActiveCycle,
  getCycleContinuity,
  getCycleActivity,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CycleContinuity } from "@/components/cycle-continuity";

export const metadata = { title: "Continuidad de ciclo" };

export default async function ContinuidadPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hacia?: string }>;
}) {
  // Armar la continuidad del calendario escolar es tarea de dirección.
  await requireRole("DIRECTORA");
  const { desde, hacia } = await searchParams;

  const [cycles, activeCycle, activity] = await Promise.all([
    listCycles(),
    getActiveCycle(),
    getCycleActivity(),
  ]);

  // Orden cronológico real (ENE_JUN < JUL_AGO < SEP_DIC dentro del año).
  const rank = (c: { year: number; season: string }) =>
    c.year * 10 + (c.season === "ENE_JUN" ? 1 : c.season === "JUL_AGO" ? 2 : 3);

  // Origen por defecto: el ciclo con más historia que copiar (uno vacío dejaría la
  // pantalla sin nada que palomear). Destino: el ciclo siguiente en el calendario, o
  // el activo si es otro. Lo que pida la URL siempre gana.
  const busiest = [...cycles].sort(
    (a, b) => (activity.get(b.id) ?? 0) - (activity.get(a.id) ?? 0) || rank(b) - rank(a),
  )[0];

  const fromId = cycles.find((c) => c.id === desde)?.id ?? busiest?.id ?? cycles[0]?.id ?? "";
  const fromCycle = cycles.find((c) => c.id === fromId);

  const nextAfterFrom = fromCycle
    ? [...cycles]
        .filter((c) => rank(c) > rank(fromCycle))
        .sort((a, b) => rank(a) - rank(b))[0]
    : undefined;

  const toId =
    cycles.find((c) => c.id === hacia && c.id !== fromId)?.id ??
    (activeCycle && activeCycle.id !== fromId ? activeCycle.id : undefined) ??
    nextAfterFrom?.id ??
    cycles.find((c) => c.id !== fromId)?.id ??
    "";

  const toLabel = cycles.find((c) => c.id === toId)?.label ?? "—";
  const fromLabel = cycles.find((c) => c.id === fromId)?.label ?? "—";

  const data =
    fromId && toId && fromId !== toId ? await getCycleContinuity(fromId, toId) : null;

  return (
    <div>
      <Link
        href="/programas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Programas
      </Link>

      <PageHeader
        title="Cambio de ciclo asistido"
        subtitle="Palomea quién continúa del ciclo anterior y cópiale de un jalón sus inscripciones y el nivel donde quedó."
      />

      {/* Selectores de origen y destino */}
      <div className="mb-5 space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <CyclePicker
          label="Del ciclo"
          cycles={cycles}
          selectedId={fromId}
          disabledId={toId}
          hrefFor={(id) => `/programas/continuidad?desde=${id}&hacia=${toId}`}
        />
        <CyclePicker
          label="Al ciclo"
          cycles={cycles}
          selectedId={toId}
          disabledId={fromId}
          hrefFor={(id) => `/programas/continuidad?desde=${fromId}&hacia=${id}`}
        />
      </div>

      <p className="mb-5 flex items-start gap-2 rounded-[var(--radius-card)] border border-info/30 bg-info-weak/50 px-4 py-3 text-sm text-info">
        <Info weight="fill" className="mt-0.5 size-4 shrink-0" />
        <span>
          Solo se copia a los programas que ya estén en la{" "}
          <Link href={`/programas?ciclo=${toId}`} className="font-semibold underline">
            oferta de {toLabel}
          </Link>
          . Arma primero la oferta del ciclo destino si falta algún programa.
        </span>
      </p>

      {!data ? (
        <EmptyState
          title="Elige dos ciclos distintos"
          description="Selecciona el ciclo de origen y el de destino para ver a los participantes que continúan."
        />
      ) : (
        <CycleContinuity
          key={`${fromId}:${toId}`}
          fromId={fromId}
          toId={toId}
          toLabel={toLabel}
          students={data.students}
        />
      )}
    </div>
  );
}

function CyclePicker({
  label,
  cycles,
  selectedId,
  disabledId,
  hrefFor,
}: {
  label: string;
  cycles: { id: string; label: string; active: boolean }[];
  selectedId: string;
  disabledId: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-bold text-subtle">{label}</span>
      {cycles.map((c) => {
        const isSel = c.id === selectedId;
        const isDisabled = c.id === disabledId;
        if (isDisabled) {
          return (
            <span
              key={c.id}
              className="inline-flex h-9 cursor-not-allowed items-center rounded-[var(--radius-input)] px-3 text-sm font-semibold text-subtle opacity-40"
            >
              {c.label}
            </span>
          );
        }
        return (
          <Link
            key={c.id}
            href={hrefFor(c.id)}
            scroll={false}
            aria-current={isSel ? "true" : undefined}
            className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-sm font-semibold transition-colors ${
              isSel ? "bg-ink text-surface" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {c.label}
            {c.active && (
              <span
                title="Ciclo activo"
                className={`size-1.5 rounded-full ${isSel ? "bg-surface" : "bg-[#1D9E75]"}`}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
