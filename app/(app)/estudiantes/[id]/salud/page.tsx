import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { verifySession } from "@/lib/dal";
import { getStudent } from "@/lib/queries";
import { saveHealth } from "@/lib/actions/students";
import { PageHeader } from "@/components/ui/page-header";
import { HealthForm } from "@/components/health-form";

export const metadata = { title: "Historial médico" };

export default async function HealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  const h = student.health;
  const action = saveHealth.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/estudiantes/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {student.firstName} {student.lastName}
      </Link>
      <PageHeader
        title="Historial médico"
        subtitle="Normalmente lo llena el tutor en su primer ingreso. Aquí puedes capturarlo o corregirlo."
      />
      <HealthForm
        action={action}
        cancelHref={`/estudiantes/${id}`}
        defaults={{
          bloodType: h?.bloodType ?? "",
          allergies: h?.allergies ?? "",
          medications: h?.medications ?? "",
          medicalConditions: h?.medicalConditions ?? "",
          therapies: h?.therapies ?? "",
          dietaryRestrictions: h?.dietaryRestrictions ?? "",
          doctorName: h?.doctorName ?? "",
          doctorPhone: h?.doctorPhone ?? "",
          emergencyName: h?.emergencyName ?? "",
          emergencyPhone: h?.emergencyPhone ?? "",
          emergencyRelation: h?.emergencyRelation ?? "",
          healthNotes: h?.notes ?? "",
        }}
      />
    </div>
  );
}
