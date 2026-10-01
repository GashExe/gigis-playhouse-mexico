import Link from "next/link";
import { ArrowLeft, Plus, Trash, Eye, EyeSlash, Sliders } from "@phosphor-icons/react/dist/ssr";
import { requireServiceAccess } from "@/lib/dal";
import { canManageService } from "@/lib/roles";
import { listServiceAreas, listServiceLeaders, listServiceSchools } from "@/lib/queries";
import {
  createServiceCatalogEntry,
  deleteServiceCatalogEntry,
  setServiceCatalogActive,
} from "@/lib/actions/servicio";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Áreas y líderes de servicio social" };

type Entrada = {
  id: string;
  name: string;
  active: boolean;
  /** Las instituciones no cuelgan de reportes, solo de prestadores. */
  _count: { logs?: number; volunteers: number };
};

/**
 * Una columna del catálogo (áreas o líderes). Las dos se manejan igual, así que
 * comparten la misma tabla en vez de estar escritas dos veces.
 */
function Catalogo({
  tipo,
  titulo,
  descripcion,
  placeholder,
  entradas,
  puedeEditar,
}: {
  tipo: "area" | "lider" | "escuela";
  titulo: string;
  descripcion: string;
  placeholder: string;
  entradas: Entrada[];
  puedeEditar: boolean;
}) {
  return (
    <Card className="self-start p-5">
      <h2 className="text-sm font-bold text-ink">{titulo}</h2>
      <p className="mt-1 text-xs text-muted">{descripcion}</p>

      {puedeEditar && (
        <form action={createServiceCatalogEntry} className="mt-3 flex gap-2">
          <input type="hidden" name="tipo" value={tipo} />
          <input
            name="name"
            required
            placeholder={placeholder}
            className="h-10 flex-1 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-subtle transition-[border,box-shadow] duration-150 focus:outline-none focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
          />
          <Button type="submit" size="sm" variant="secondary">
            <Plus className="size-4" />
            Agregar
          </Button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-border">
        {entradas.map((e) => {
          const enUso = (e._count.logs ?? 0) + e._count.volunteers;
          return (
            <li key={e.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={e.active ? "text-sm text-ink" : "text-sm text-subtle line-through"}>
                  {e.name}
                </p>
                <p className="text-xs text-subtle">
                  {e._count.logs != null &&
                    `${e._count.logs} reporte${e._count.logs === 1 ? "" : "s"}`}
                  {e._count.logs != null && e._count.volunteers > 0 && " · "}
                  {e._count.volunteers > 0 &&
                    `${e._count.volunteers} prestador${e._count.volunteers === 1 ? "" : "es"}`}
                  {e._count.logs == null && e._count.volunteers === 0 && "Todavía sin prestadores"}
                </p>
              </div>
              {!e.active && <Badge tone="neutral">Ya no se ofrece</Badge>}
              {puedeEditar && (
                <>
                  <form action={setServiceCatalogActive}>
                    <input type="hidden" name="tipo" value={tipo} />
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="active" value={e.active ? "false" : "true"} />
                    <button
                      type="submit"
                      aria-label={e.active ? "Dejar de ofrecer" : "Volver a ofrecer"}
                      title={e.active ? "Dejar de ofrecer" : "Volver a ofrecer"}
                      className="tap flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {e.active ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </form>
                  {/* Borrar solo lo que no usa nadie: lo demás se desactiva, porque
                      los reportes de 2021 siguen nombrando áreas de entonces. */}
                  {enUso === 0 && (
                    <form action={deleteServiceCatalogEntry}>
                      <input type="hidden" name="tipo" value={tipo} />
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        aria-label="Eliminar"
                        className="tap flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                      >
                        <Trash className="size-4" />
                      </button>
                    </form>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default async function CatalogosPage() {
  const me = await requireServiceAccess();
  const puedeEditar = canManageService(me);
  const [areas, lideres, escuelas] = await Promise.all([
    listServiceAreas(true),
    listServiceLeaders(true),
    listServiceSchools(true),
  ]);

  return (
    <div>
      <Link
        href="/servicio-social"
        className="tap mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Servicio social
      </Link>

      <PageHeader
        title="Áreas, líderes e instituciones"
        subtitle="Las tres listas que el prestador escoge al mandar su reporte. Lo que ya no se ofrece se deja de ofrecer en vez de borrarse: los reportes viejos lo siguen nombrando."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Catalogo
          tipo="escuela"
          titulo="Instituciones"
          descripcion="Las universidades y colegios activos. Es la lista del formulario: si alguien llega de una escuela que no está, agrégala aquí y le aparece en el acto."
          placeholder="Ej. Universidad Cuauhtémoc"
          entradas={escuelas}
          puedeEditar={puedeEditar}
        />
        <Catalogo
          tipo="area"
          titulo="Áreas en las que se apoya"
          descripcion="Las mismas de la lista del formulario. Algunas traen el nombre de quien las lleva; así las escribieron las áreas y así se dejan."
          placeholder="Ej. Programas educacionales (Tutorías)"
          entradas={areas}
          puedeEditar={puedeEditar}
        />
        <Catalogo
          tipo="lider"
          titulo="Líderes de área"
          descripcion="Quien recibe y avala el trabajo del prestador."
          placeholder="Ej. Paula Tornell"
          entradas={lideres}
          puedeEditar={puedeEditar}
        />
      </div>

      {!puedeEditar && (
        <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
          <Sliders className="size-3.5" />
          Solo la coordinación de servicio social mueve estas listas.
        </p>
      )}
    </div>
  );
}
