import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui/page-header";
import { OficioEditor } from "@/components/oficio-editor";

export const metadata = { title: "Oficios" };

export default async function OficiosPage() {
  // Los oficios salen a nombre de la dirección: solo ella los redacta.
  await requireRole("DIRECTORA");

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Oficios membretados"
          subtitle="Redacta el oficio sobre el papel oficial y mándalo a imprimir o guárdalo como PDF, sin abrir Word."
        />
      </div>
      <OficioEditor />
    </div>
  );
}
