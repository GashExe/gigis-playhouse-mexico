import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  EnvelopeSimple,
  MapPin,
  User,
  Stack,
  GraduationCap,
  Key,
  ClockCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getStudent,
  listActivePrograms,
  listCycles,
  getActiveCycle,
  getStudentLevels,
  listProgramsWithLevels,
  getStudentTimeline,
  listAuditLog,
} from "@/lib/queries";
import { edadLabel } from "@/lib/utils";
import { fechaDiaLarga } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { StudentStatusControl } from "@/components/student-status-control";
import { StudentStatusBadge } from "@/components/status";
import { HealthPanel } from "@/components/health-panel";
import { StudentActions } from "@/components/student-actions";
import { EnrollmentsPanel } from "@/components/enrollments-panel";
import { LevelRecordsPanel } from "@/components/level-records-panel";
import { StudentTimeline } from "@/components/student-timeline";
import { AuditLog } from "@/components/audit-log";
import { ResetPasswordButton } from "@/components/reset-password-button";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const me = await getCurrentUser();
  const { id } = await params;
  const { ciclo } = await searchParams;
  const activeCycle = await getActiveCycle();
  const isDirectora = me.role === "DIRECTORA";
  const [student, programs, cycles, programsWithLevels, timeline, auditEntries] =
    await Promise.all([
      getStudent(id),
      // Solo la oferta del ciclo activo: es a lo único que se puede inscribir.
      listActivePrograms(activeCycle?.id),
      listCycles(),
      listProgramsWithLevels(),
      getStudentTimeline(id),
      // La actividad de la bitácora de este participante la ve solo la dirección.
      isDirectora ? listAuditLog({ studentId: id, take: 15 }) : Promise.resolve([]),
    ]);
  if (!student) notFound();

  // La maestra solo consulta: sin editar expediente, estado, salud ni inscripciones.
  const canManage = me.role !== "MAESTRA";
  // Y solo califica (ubicar nivel / temas) en los programas a su cargo.
  const gradableProgramIds = canManage
    ? programsWithLevels.map((p) => p.id)
    : programsWithLevels.filter((p) => p.teacherId === me.id).map((p) => p.id);

  // Ciclo seleccionado: el de la URL si es válido, si no el activo.
  const validCiclo = ciclo && cycles.some((c) => c.id === ciclo) ? ciclo : null;
  const selectedCycleId = validCiclo ?? activeCycle?.id ?? cycles[0]?.id ?? "";
  const levelRecords = selectedCycleId ? await getStudentLevels(id, selectedCycleId) : [];

  const edad = edadLabel(student.birthDate);
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
              {canManage ? (
                <StudentStatusControl studentId={student.id} status={student.status} />
              ) : (
                <StudentStatusBadge status={student.status} />
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {edad ?? "Edad no registrada"}
              {student.gender ? ` · ${genderLabel[student.gender]}` : ""}
              {student.birthDate ? ` · Nació el ${fechaDiaLarga(student.birthDate)}` : ""}
            </p>
          </div>
        </div>
        {canManage && (
          <StudentActions
            studentId={student.id}
            studentName={`${student.firstName} ${student.lastName}`}
          />
        )}
      </div>

      {/* Resumen de progreso */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <SummaryTile
          icon={<GraduationCap weight="fill" className="size-[1.15rem]" />}
          value={activeEnrollments}
          label="Programas activos"
        />
        <SummaryTile
          icon={<Stack weight="fill" className="size-[1.15rem]" />}
          value={levelRecords.length}
          label="Niveles registrados (este ciclo)"
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
            canManage={canManage}
          />
          {cycles.length > 0 && (
            <LevelRecordsPanel
              studentId={student.id}
              records={levelRecords.map((r) => ({
                id: r.id,
                placement: r.placement,
                note: r.note,
                gradedAt: r.gradedAt,
                program: r.program,
                level: r.level,
              }))}
              programs={programsWithLevels}
              cycles={cycles.map((c) => ({ id: c.id, label: c.label, active: c.active }))}
              selectedCycleId={selectedCycleId}
              gradableProgramIds={gradableProgramIds}
            />
          )}
          <StudentTimeline groups={timeline} />

          {/* Reportes: historial completo y boleta por asignatura */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
                <ClockCounterClockwise weight="fill" className="size-[1.05rem]" />
              </span>
              <h2 className="text-sm font-bold text-ink">Reportes</h2>
            </div>
            <Link
              href={`/estudiantes/${student.id}/historial`}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              Historial de calificaciones (todos los ciclos)
              <ArrowLeft className="size-4 rotate-180 text-subtle" />
            </Link>
            {student.enrollments.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-subtle">Boleta por asignatura</p>
                <ul className="flex flex-wrap gap-2">
                  {student.enrollments.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/estudiantes/${student.id}/boleta/${e.program.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-primary"
                      >
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: e.program.color ?? "var(--brand-teal)" }}
                        />
                        {e.program.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
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

          {/* Acceso del alumno — solo visible para la directora */}
          {isDirectora && student.account && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
                  <Key weight="fill" className="size-[1.05rem]" />
                </span>
                <h2 className="text-sm font-bold text-ink">Acceso del alumno</h2>
              </div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-subtle">Usuario</dt>
                  <dd className="select-all font-mono text-sm font-semibold text-ink">
                    {student.account.username}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-subtle">Contraseña inicial</dt>
                  <dd className="select-all font-mono text-sm font-semibold text-ink">
                    {student.account.initialPassword ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Confidencial: solo tú la ves. Si la familia ya la cambió aparece «—»;
                repónla para generar una nueva.
              </p>
              <ResetPasswordButton studentId={student.id} />
            </Card>
          )}

          {/* Actividad reciente de la bitácora — solo la directora */}
          {isDirectora && auditEntries.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-primary-weak text-primary">
                  <ClockCounterClockwise weight="fill" className="size-[1.05rem]" />
                </span>
                <h2 className="text-sm font-bold text-ink">Actividad reciente</h2>
              </div>
              <AuditLog entries={auditEntries} showStudent={false} />
            </div>
          )}

          <HealthPanel studentId={student.id} health={student.health} canEdit={canManage} />

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
