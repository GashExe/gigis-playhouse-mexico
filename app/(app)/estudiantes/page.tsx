import Link from "next/link";
import {
  UserPlus,
  UsersThree,
  CaretRight,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import { listStudents, countStudentsByStatus } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { StudentStatusSchema } from "@/lib/validators";
import { edadLabel } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/search-input";
import { StudentStatusBadge } from "@/components/status";
import { StudentFilters } from "@/components/student-filters";

export const metadata = { title: "Participantes" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const status = StudentStatusSchema.safeParse(estado);
  const [students, counts, me] = await Promise.all([
    listStudents(q, status.success ? status.data : undefined),
    countStudentsByStatus(q),
    getCurrentUser(),
  ]);
  // "Sin resultados" solo si hay búsqueda o filtro: si no, el padrón está vacío de verdad.
  const filtrando = Boolean(q) || status.success;
  const estadoLabel = status.success
    ? { ACTIVO: "activos", INACTIVO: "inactivos", EGRESADO: "egresados" }[status.data]
    : "";
  const isDirectora = me.role === "DIRECTORA";
  const canManage = me.role !== "MAESTRA"; // la maestra solo consulta el padrón

  return (
    <div>
      <PageHeader
        title="Participantes"
        subtitle="Expediente de cada niño y niña de la playhouse."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isDirectora && (
              <a
                href="/api/credenciales"
                download
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <DownloadSimple weight="bold" className="size-4" />
                Descargar credenciales
              </a>
            )}
            {canManage && (
              <Button href="/estudiantes/nuevo">
                <UserPlus weight="bold" className="size-4" />
                Nuevo participante
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Buscar por nombre o tutor…" />
        <StudentFilters counts={counts} />
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<UsersThree weight="fill" className="size-6" />}
          title={filtrando ? "Sin resultados" : "Aún no hay participantes"}
          description={
            filtrando
              ? `No hay participantes${estadoLabel ? ` ${estadoLabel}` : ""}${
                  q ? ` que coincidan con “${q}”` : ""
                }.`
              : "Registra al primer participante para empezar a llevar su historial."
          }
          action={
            !filtrando && canManage && (
              <Button href="/estudiantes/nuevo">
                <UserPlus weight="bold" className="size-4" />
                Nuevo participante
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {students.map((s) => {
              const edad = edadLabel(s.birthDate);
              return (
                <li key={s.id}>
                  <Link
                    href={`/estudiantes/${s.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <Avatar name={`${s.firstName} ${s.lastName}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {edad ?? "Edad no registrada"}
                        {s.guardianName ? ` · Tutor: ${s.guardianName}` : ""}
                      </p>
                    </div>
                    <div className="hidden items-center gap-6 text-sm text-muted sm:flex">
                      <span className="tnum text-center">
                        <span className="block font-bold text-ink">
                          {s._count.enrollments}
                        </span>
                        <span className="text-xs">programas</span>
                      </span>
                      <span className="tnum text-center">
                        <span className="block font-bold text-ink">
                          {s._count.evaluations}
                        </span>
                        <span className="text-xs">evaluaciones</span>
                      </span>
                    </div>
                    <StudentStatusBadge status={s.status} />
                    <CaretRight className="size-4 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
