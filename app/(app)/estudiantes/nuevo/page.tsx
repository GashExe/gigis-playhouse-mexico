import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { verifySession } from "@/lib/dal";
import { createStudent } from "@/lib/actions/students";
import { PageHeader } from "@/components/ui/page-header";
import { StudentForm } from "@/components/student-form";

export const metadata = { title: "Nuevo participante" };

export default async function NewStudentPage() {
  await verifySession();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/estudiantes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Participantes
      </Link>
      <PageHeader
        title="Nuevo participante"
        subtitle="Registra los datos básicos. Después podrás inscribirlo en programas y registrar evaluaciones."
      />
      <StudentForm action={createStudent} showMatricula />
    </div>
  );
}
