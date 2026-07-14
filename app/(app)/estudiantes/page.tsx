import Link from "next/link";
import { UserPlus, UsersThree, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { listStudents } from "@/lib/queries";
import { ageFrom } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/search-input";
import { StudentStatusBadge } from "@/components/status";

export const metadata = { title: "Participantes" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const students = await listStudents(q);

  return (
    <div>
      <PageHeader
        title="Participantes"
        subtitle="Expediente de cada niño y niña de la playhouse."
        actions={
          <Button href="/estudiantes/nuevo">
            <UserPlus weight="bold" className="size-4" />
            Nuevo participante
          </Button>
        }
      />

      <div className="mb-5">
        <SearchInput placeholder="Buscar por nombre o tutor…" />
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<UsersThree weight="fill" className="size-6" />}
          title={q ? "Sin resultados" : "Aún no hay participantes"}
          description={
            q
              ? `No encontramos participantes que coincidan con “${q}”.`
              : "Registra al primer participante para empezar a llevar su historial."
          }
          action={
            !q && (
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
              const age = ageFrom(s.birthDate);
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
                        {age != null ? `${age} años` : "Edad no registrada"}
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
