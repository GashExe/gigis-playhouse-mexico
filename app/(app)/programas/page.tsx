import { verifySession } from "@/lib/dal";
import { listPrograms, listTeachers } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ProgramsManager } from "@/components/programs-manager";

export const metadata = { title: "Programas" };

export default async function ProgramsPage() {
  await verifySession();
  const [programs, teachers] = await Promise.all([listPrograms(), listTeachers()]);

  return (
    <div>
      <PageHeader
        title="Programas y actividades"
        subtitle="Cada programa es una actividad con horario, cupo y un maestro a cargo."
      />
      <ProgramsManager programs={programs} teachers={teachers} />
    </div>
  );
}
