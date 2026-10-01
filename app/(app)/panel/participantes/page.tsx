import Link from "next/link";
import { ArrowLeft, FileXls, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { getActiveCycle, listCycleParticipants } from "@/lib/queries";
import { edadLabel } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/search-input";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Participantes del ciclo" };

export default async function CycleParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const cycle = await getActiveCycle();
  const participants = cycle ? await listCycleParticipants(cycle.id, q) : [];
  const totalClases = participants.reduce((n, p) => n + p.classes.length, 0);
  // El servidor puede correr en UTC: de noche en Querétaro ya sería "mañana".
  const hoy = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date());
  const titulo = cycle ? `Participantes de ${cycle.label}` : "Participantes del ciclo";

  return (
    <div>
      <Link
        href="/panel"
        className="tap mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink print:hidden"
      >
        <ArrowLeft className="size-4" />
        Panel
      </Link>

      <div className="print:hidden">
        <PageHeader
          title={titulo}
          subtitle="Quién tiene al menos una clase en el ciclo y a cuáles va."
          actions={
            participants.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/participantes-ciclo${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-bold text-ink transition-colors hover:border-primary"
                >
                  <FileXls weight="fill" className="size-4 text-success-strong" />
                  Excel
                </a>
                <PrintButton label="PDF" />
              </div>
            )
          }
        />
      </div>

      <div className="mb-5 flex print:hidden flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Buscar por nombre…" />
        {participants.length > 0 && (
          <p className="tnum text-sm text-muted">
            <span className="font-bold text-ink">{participants.length}</span>
            {participants.length === 1 ? " participante" : " participantes"}
            {` · ${totalClases} ${totalClases === 1 ? "clase" : "clases"}`}
          </p>
        )}
      </div>

      {participants.length === 0 ? (
        <EmptyState
          icon={<UsersThree weight="fill" className="size-6" />}
          title={q ? "Sin resultados" : "Nadie inscrito todavía"}
          description={
            q
              ? `Nadie del ciclo coincide con “${q}”.`
              : cycle
                ? "Cuando las familias o el equipo inscriban clases, aquí aparecerá cada participante."
                : "Aún no hay un ciclo registrado."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0 print:hidden">
          <ul className="divide-y divide-border">
            {participants.map((p) => {
              const edad = edadLabel(p.birthDate);
              return (
                <li key={p.id}>
                  <Link
                    href={`/estudiantes/${p.id}`}
                    className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <Avatar name={`${p.firstName} ${p.lastName}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">
                        {p.firstName} {p.lastName}
                        {edad && <span className="font-normal text-muted">{` (${edad})`}</span>}
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {p.classes.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 text-sm">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: c.program.color ?? "var(--primary)" }}
                            />
                            <span className="min-w-0">
                              <span className="font-semibold text-ink">{c.program.name}</span>
                              {c.groupLabel && (
                                <span className="text-muted">{` · ${c.groupLabel}`}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="tnum shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">
                      {p.classes.length === 1 ? "1 clase" : `${p.classes.length} clases`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Versión de papel (Imprimir / Guardar como PDF): tabla en negro sobre
          blanco, sin importar el tema de la pantalla. */}
      {participants.length > 0 && (
        <div className="hidden bg-white text-black print:block">
          <h1 className="text-xl font-bold">{titulo}</h1>
          <p className="mt-1 text-sm">
            {`${participants.length} ${participants.length === 1 ? "participante" : "participantes"} · ${totalClases} ${totalClases === 1 ? "clase" : "clases"}`}
            {q ? ` · Búsqueda: “${q}”` : ""}
            {` · ${hoy}`}
          </p>
          <table className="mt-4 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-1.5 pr-3">#</th>
                <th className="py-1.5 pr-3">Participante</th>
                <th className="py-1.5 pr-3">Edad</th>
                <th className="py-1.5">Clases</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, i) => (
                <tr key={p.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                  <td className="tnum py-1.5 pr-3">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-semibold">
                    {p.firstName} {p.lastName}
                    {p.matricula && (
                      <span className="block font-normal text-neutral-600">{p.matricula}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{edadLabel(p.birthDate) ?? "—"}</td>
                  <td className="py-1.5">
                    {p.classes.map((c) => (
                      <span key={c.id} className="block">
                        <span className="font-semibold">{c.program.name}</span>
                        {c.groupLabel ? ` · ${c.groupLabel}` : ""}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
