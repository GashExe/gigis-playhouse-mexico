import { verifySession } from "@/lib/dal";
import { listPrograms } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ProgramsManager } from "@/components/programs-manager";

export const metadata = { title: "Programas" };

export default async function ProgramsPage() {
  await verifySession();
  const programs = await listPrograms();

  return (
    <div>
      <PageHeader
        title="Programas"
        subtitle="Los programas en los que se inscribe a los participantes."
      />
      <ProgramsManager programs={programs} />
    </div>
  );
}
