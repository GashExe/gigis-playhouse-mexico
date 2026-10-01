import Link from "next/link";
import { ClockCounterClockwise, Funnel } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { listAuditLogFiltered } from "@/lib/queries";
import { AUDIT_PERIODS, isAuditCategory, type AuditPeriod } from "@/lib/audit-categories";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AuditLog, type AuditEntry } from "@/components/audit-log";
import { AuditFilters } from "@/components/audit-filters";

export const metadata = { title: "Bitácora" };

const PAGINA = 200;
const TZ = "America/Mexico_City";

/** Clave de día (AAAA-MM-DD) en hora de Querétaro, para agrupar sin que la hora UTC
 *  mande un movimiento de las 7 pm al día siguiente. */
function diaClave(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function diaTitulo(clave: string, hoy: string, ayer: string): string {
  if (clave === hoy) return "Hoy";
  if (clave === ayer) return "Ayer";
  const texto = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${clave}T12:00:00-06:00`));
  const limpio = texto.replace(",", ""); // "lunes, 28 de…" → "lunes 28 de…"
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; persona?: string; periodo?: string; q?: string; n?: string }>;
}) {
  // La bitácora es un control de dirección: quién movió qué en la plataforma.
  await requireRole("DIRECTORA");
  const sp = await searchParams;
  const category = isAuditCategory(sp.tipo) ? sp.tipo : undefined;
  // Por defecto, los últimos 30 días: lo de hace meses casi nunca se busca y es lo
  // que hacía que la lista se sintiera interminable.
  const period: AuditPeriod = AUDIT_PERIODS.some((p) => p.value === sp.periodo)
    ? (sp.periodo as AuditPeriod)
    : "30";
  const take = Math.min(Math.max(Number(sp.n) || PAGINA, PAGINA), 2000);

  const { entries, total, categoryCounts, allCount, actors } = await listAuditLogFiltered({
    category,
    actor: sp.persona || undefined,
    period,
    q: sp.q,
    take,
  });

  const filtrando = Boolean(category || sp.persona || sp.q || period !== "todo");
  const sinNada = allCount === 0 && !sp.persona && !sp.q && period === "todo";

  // Agrupar por día conservando el orden (lo más nuevo primero).
  const ahora = new Date();
  const hoy = diaClave(ahora);
  const ayer = diaClave(new Date(ahora.getTime() - 86_400_000));
  const grupos: { clave: string; items: AuditEntry[] }[] = [];
  for (const e of entries) {
    const clave = diaClave(e.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.clave === clave) ultimo.items.push(e);
    else grupos.push({ clave, items: [e] });
  }

  const masHref = (() => {
    const p = new URLSearchParams();
    if (sp.tipo) p.set("tipo", sp.tipo);
    if (sp.persona) p.set("persona", sp.persona);
    if (sp.periodo) p.set("periodo", sp.periodo);
    if (sp.q) p.set("q", sp.q);
    p.set("n", String(take + PAGINA));
    return `/bitacora?${p.toString()}`;
  })();

  return (
    <div>
      <PageHeader
        title="Bitácora de cambios"
        subtitle="Quién movió qué: calificaciones, inscripciones, niveles y datos de los participantes. Solo la dirección la ve."
      />
      {sinNada ? (
        <EmptyState
          icon={<ClockCounterClockwise weight="fill" className="size-6" />}
          title="Todavía no hay movimientos registrados"
          description="En cuanto el equipo empiece a calificar, inscribir o editar, cada cambio quedará aquí con su autor y su fecha."
        />
      ) : (
        <>
          <AuditFilters categoryCounts={categoryCounts} allCount={allCount} actors={actors} />
          {entries.length === 0 ? (
            <EmptyState
              icon={<Funnel weight="fill" className="size-6" />}
              title="Ningún movimiento con estos filtros"
              description={
                filtrando
                  ? "Prueba con otro periodo, otra persona o quita la búsqueda."
                  : "No hay movimientos registrados."
              }
            />
          ) : (
            <div className="space-y-6">
              {grupos.map((g) => (
                <section key={g.clave} aria-labelledby={`dia-${g.clave}`}>
                  <h2
                    id={`dia-${g.clave}`}
                    className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink"
                  >
                    {diaTitulo(g.clave, hoy, ayer)}
                    <span className="tnum text-xs font-medium text-subtle">
                      {g.items.length} {g.items.length === 1 ? "movimiento" : "movimientos"}
                    </span>
                  </h2>
                  <AuditLog entries={g.items} withTime />
                </section>
              ))}
              <p className="text-center text-xs text-muted">
                {`Mostrando ${entries.length} de ${total} movimientos`}
                {entries.length < total && (
                  <>
                    {" · "}
                    <Link href={masHref} scroll={false} className="font-semibold text-primary-strong hover:underline">
                      Ver más
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
