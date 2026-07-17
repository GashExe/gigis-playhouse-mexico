import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { getProgramTemplate } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateEditor } from "@/components/template-editor";
import { SavePreset } from "@/components/save-preset";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await getProgramTemplate(id);
  return { title: program ? `Plantilla · ${program.name}` : "Plantilla" };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Solo la directora y el coordinador de programas educativos editan plantillas.
  await requireRole("DIRECTORA", "COORDINADOR");
  const { id } = await params;
  const program = await getProgramTemplate(id);
  if (!program) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/programas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Programas
      </Link>
      <PageHeader
        title={`Plantilla · ${program.name}`}
        subtitle="Arma la evaluación: niveles, bloques y temas. La maestra solo califica; esto es la estructura."
      />
      <div className="mb-5">
        <SavePreset
          programId={program.id}
          programName={program.name}
          empty={!program.levels.some((l) => l.blocks.length > 0)}
        />
      </div>
      <TemplateEditor program={program} />
    </div>
  );
}
