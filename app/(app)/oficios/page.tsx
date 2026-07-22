import Link from "next/link";
import { FileText, Plus, CheckCircle, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { listOficios, zonaLabel, oficioNumero } from "@/lib/queries";
import { createOficio } from "@/lib/actions/oficios";
import { PageHeader } from "@/components/ui/page-header";
import { fecha } from "@/lib/format";

export const metadata = { title: "Oficios" };

export default async function OficiosPage() {
  // Los oficios los redactan coordinación y dirección; la dirección (Eva) los aprueba.
  await requireRole("DIRECTORA", "COORDINADOR");
  const oficios = await listOficios();

  const borradores = oficios.filter((o) => o.status === "BORRADOR");
  const aprobados = oficios.filter((o) => o.status === "APROBADO");

  return (
    <div>
      <PageHeader
        title="Oficios membretados"
        subtitle="Redacta el oficio sobre el papel oficial. La dirección lo aprueba y ahí se le asigna su número; hasta entonces no se puede imprimir ni guardar como PDF."
      />

      {/* Nuevo oficio por zona: cada zona lleva su propia serie de folios. */}
      <div className="mb-6 flex flex-wrap gap-3">
        {(["DIRECCION", "OPERACION"] as const).map((zona) => (
          <form key={zona} action={createOficio}>
            <input type="hidden" name="zona" value={zona} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90"
            >
              <Plus weight="bold" className="size-4" />
              Nuevo oficio · {zonaLabel(zona)}
            </button>
          </form>
        ))}
      </div>

      {oficios.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-12 text-center text-sm text-muted">
          Aún no hay oficios. Crea uno eligiendo su zona.
        </p>
      ) : (
        <div className="space-y-6">
          {borradores.length > 0 && <OficioGroup title="Borradores" oficios={borradores} />}
          {aprobados.length > 0 && <OficioGroup title="Aprobados" oficios={aprobados} />}
        </div>
      )}
    </div>
  );
}

function OficioGroup({
  title,
  oficios,
}: {
  title: string;
  oficios: Awaited<ReturnType<typeof listOficios>>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-subtle">{title}</h2>
      <ul className="space-y-2">
        {oficios.map((o) => {
          const aprobado = o.status === "APROBADO";
          return (
            <li key={o.id}>
              <Link
                href={`/oficios/${o.id}`}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] ${
                    aprobado
                      ? "bg-success-weak text-success-strong"
                      : "bg-primary-weak text-primary"
                  }`}
                >
                  <FileText weight="fill" className="size-[1.05rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {aprobado
                      ? oficioNumero(o.zona, o.folio, o.year)
                      : "Sin número (borrador)"}
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-muted">
                      {zonaLabel(o.zona)}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {o.destinatario
                      ? o.destinatario.replace(/<[^>]*>/g, " ").trim().slice(0, 80)
                      : "Sin destinatario"}
                    {" · "}
                    {o.createdBy?.name ?? "—"}
                    {" · "}
                    {fecha(o.updatedAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    aprobado
                      ? "bg-success-weak text-success-strong"
                      : "bg-warning-weak text-warning-strong"
                  }`}
                >
                  {aprobado ? (
                    <>
                      <CheckCircle weight="fill" className="size-3.5" />
                      Aprobado
                    </>
                  ) : (
                    <>
                      <PencilSimple className="size-3.5" />
                      Borrador
                    </>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
