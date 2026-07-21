import { requireRole } from "@/lib/dal";
import { getLegalConfig } from "@/lib/legal";
import { PageHeader } from "@/components/ui/page-header";
import { LegalConfigForm } from "@/components/legal-config-form";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  // Ajustes de la plataforma: por ahora, los textos legales. Solo la dirección.
  await requireRole("DIRECTORA");
  const legal = await getLegalConfig();

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle="Ajustes de la plataforma. Aquí editas el aviso de privacidad y el reglamento que aceptan las familias en su primer ingreso."
      />
      <LegalConfigForm
        avisoPrivacidad={legal.avisoPrivacidad}
        reglamento={legal.reglamento}
        version={legal.version}
        updatedAt={legal.updatedAt.toISOString()}
      />
    </div>
  );
}
