import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Cake,
  Phone,
  EnvelopeSimple,
  MapPin,
  User,
  ChartLineUp,
  Star,
  GraduationCap,
} from "@phosphor-icons/react/dist/ssr";
import { verifySession } from "@/lib/dal";
import { getStudent, listActivePrograms } from "@/lib/queries";
import { ageFrom } from "@/lib/utils";
import { fechaLarga } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { StudentStatusBadge } from "@/components/status";
import { StudentActions } from "@/components/student-actions";
import { EnrollmentsPanel } from "@/components/enrollments-panel";
import { EvaluationsPanel } from "@/components/evaluations-panel";

const genderLabel: Record<string, string> = {
  FEMENINO: "Femenino",
  MASCULINO: "Masculino",
  OTRO: "Otro",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await getStudent(id);
  return { title: student ? `${student.firstName} ${student.lastName}` : "Participante" };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const { id } = await params;
  const [student, programs] = await Promise.all([getStudent(id), listActivePrograms()]);
  if (!student) notFound();

  const age = ageFrom(student.birthDate);
  const scored = student.evaluations.filter((e) => e.score != null);
  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length) * 10) / 10
      : null;
  const activeEnrollments = student.enrollments.filter((e) => e.status === "ACTIVA").length;

  const contactRows = [
    student.guardianName && { icon: User, label: "Tutor", value: student.guardianName },
    student.guardianPhone && { icon: Phone, label: "Teléfono", value: student.guardianPhone },
    student.guardianEmail && { icon: EnvelopeSimple, label: "Correo", value: student.guardianEmail },
    student.address && { icon: MapPin, label: "Dirección", value: student.address },
  ].filter(Boolean) as { icon: typeof User; label: string; value: string }[];

  return (
    <div>
      <Link
        href="/estudiantes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Participantes
      </Link>

      {/* Encabezado del participante */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={`${student.firstName} ${student.lastName}`} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink text-balance">
                {student.firstName} {student.lastName}
              </h1>
              <StudentStatusBadge status={student.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {age != null ? `${age} años` : "Edad no registrada"}
              {student.gender ? ` · ${genderLabel[student.gender]}` : ""}
              {student.birthDate ? ` · Nació el ${fechaLarga(student.birthDate)}` : ""}
            </p>
          </div>
        </div>
        <StudentActions
          studentId={student.id}
          studentName={`${student.firstName} ${student.lastName}`}
        />
      </div>

      {/* Resumen de progreso */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryTile
          icon={<GraduationCap weight="fill" className="size-[1.15rem]" />}
          value={activeEnrollments}
          label="Programas activos"
        />
        <SummaryTile
          icon={<Star weight="fill" className="size-[1.15rem]" />}
          value={student.evaluations.length}
          label="Evaluaciones"
        />
        <SummaryTile
          icon={<ChartLineUp weight="fill" className="size-[1.15rem]" />}
          value={avg != null ? avg : "—"}
          label="Promedio general"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <EnrollmentsPanel
            studentId={student.id}
            enrollments={student.enrollments.map((e) => ({
              id: e.id,
              status: e.status,
              startDate: e.startDate,
              program: {
                id: e.program.id,
                name: e.program.name,
                color: e.program.color,
                area: e.program.area,
              },
            }))}
            allPrograms={programs.map((p) => ({ id: p.id, name: p.name }))}
          />
          <EvaluationsPanel
            studentId={student.id}
            evaluations={student.evaluations}
            programs={programs.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>

        {/* Barra lateral: información */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">Contacto</h2>
            {contactRows.length === 0 ? (
              <p className="text-sm text-muted">Sin datos de contacto registrados.</p>
            ) : (
              <dl className="space-y-3">
                {contactRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-surface-2 text-muted">
                        <Icon className="size-[1.05rem]" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-subtle">{row.label}</dt>
                        <dd className="break-words text-sm font-semibold text-ink">
                          {row.value}
                        </dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            )}
          </Card>

          {student.notes && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-bold text-ink">Notas</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                {student.notes}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
        {icon}
      </span>
      <p className="tnum text-xl font-extrabold text-ink">{value}</p>
      <p className="text-xs font-semibold text-muted leading-tight">{label}</p>
    </div>
  );
}
