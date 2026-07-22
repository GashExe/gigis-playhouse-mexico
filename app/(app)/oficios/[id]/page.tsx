import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { getOficio, nextOficioFolio, zonaLabel } from "@/lib/queries";
import { deleteOficio } from "@/lib/actions/oficios";
import { OficioEditor } from "@/components/oficio-editor";

export const metadata = { title: "Oficio" };

export default async function OficioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("DIRECTORA", "COORDINADOR");
  const { id } = await params;
  const oficio = await getOficio(id);
  if (!oficio) notFound();

  const [proximoDireccion, proximoOperacion] = await Promise.all([
    nextOficioFolio("DIRECCION", oficio.year),
    nextOficioFolio("OPERACION", oficio.year),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/oficios"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Oficios
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-subtle">
            Zona {zonaLabel(oficio.zona)}
          </span>
          {oficio.status === "BORRADOR" && (
            <form action={deleteOficio.bind(null, oficio.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-danger-weak hover:text-danger-strong"
              >
                <Trash className="size-4" />
                Eliminar borrador
              </button>
            </form>
          )}
        </div>
      </div>

      <OficioEditor
        oficio={{
          id: oficio.id,
          zona: oficio.zona,
          status: oficio.status,
          year: oficio.year,
          folio: oficio.folio,
          lugarFecha: oficio.lugarFecha,
          destinatario: oficio.destinatario,
          cuerpo: oficio.cuerpo,
          firmante: oficio.firmante,
        }}
        proximoFolio={{ DIRECCION: proximoDireccion, OPERACION: proximoOperacion }}
        canApprove={me.role === "DIRECTORA"}
      />
    </div>
  );
}
