import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { getStudent } from "@/lib/queries";
import { updateStudent } from "@/lib/actions/students";
import { PageHeader } from "@/components/ui/page-header";
import { StudentForm } from "@/components/student-form";

export const metadata = { title: "Editar participante" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("DIRECTORA", "COORDINADOR");
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  const action = updateStudent.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/estudiantes/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {student.firstName} {student.lastName}
      </Link>
      <PageHeader title="Editar participante" />
      <StudentForm
        action={action}
        submitLabel="Guardar cambios"
        cancelHref={`/estudiantes/${id}`}
        defaults={{
          firstName: student.firstName,
          lastName: student.lastName,
          birthDate: student.birthDate
            ? new Date(student.birthDate).toISOString().slice(0, 10)
            : "",
          gender: student.gender ?? "",
          guardianName: student.guardianName ?? "",
          guardianPhone: student.guardianPhone ?? "",
          guardianEmail: student.guardianEmail ?? "",
          address: student.address ?? "",
          notes: student.notes ?? "",
          status: student.status,
        }}
      />
    </div>
  );
}
