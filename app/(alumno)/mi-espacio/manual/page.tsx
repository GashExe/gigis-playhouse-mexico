import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { getStudentSpace } from "@/lib/queries";
import { ManualEntrar, ManualParticipante } from "@/components/manual-sections";

export const metadata: Metadata = { title: "Manual" };

/**
 * Manual de la familia. Accesible incluso antes de terminar la bienvenida:
 * justamente explica cómo llenarla.
 */
export default async function ManualAlumnoPage() {
  const user = await getCurrentUser();
  if (user.role !== "ALUMNO") redirect("/panel");
  const student = user.studentId ? await getStudentSpace(user.studentId) : null;
  const firstName = (student?.firstName ?? user.name).split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/mi-espacio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
        <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Manual de tu espacio
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted">
          {`Cómo usar la cuenta de ${firstName} en la plataforma de Gigi's Playhouse.`}
        </p>
      </div>
      <div className="space-y-8">
        <ManualEntrar paraFamilia />
        <ManualParticipante nombre={firstName} />
      </div>
    </div>
  );
}
