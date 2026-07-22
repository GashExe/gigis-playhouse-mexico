import Link from "next/link";
import {
  UsersThree,
  Books,
  GraduationCap,
  ChartLineUp,
  ArrowRight,
  Star,
  CalendarCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getDashboardStats,
  getAbsenceAlerts,
  listRecentFamilyReservations,
} from "@/lib/queries";
import { saludo, haceTiempo } from "@/lib/format";
import { edadLabel } from "@/lib/utils";
import { StatBar } from "@/components/ui/stat-bar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Panel" };

export default async function PanelPage() {
  const user = await getCurrentUser();
  const isMaestra = user.role === "MAESTRA";
  const [stats, absenceAlerts, reservations] = await Promise.all([
    getDashboardStats(),
    // La maestra ve las rachas de SUS grupos; dirección y coordinación, todas.
    getAbsenceAlerts(isMaestra ? user.id : undefined),
    // Enterado de quién apartó lugar: solo dirección y coordinación.
    isMaestra ? Promise.resolve([]) : listRecentFamilyReservations(),
  ]);
  const firstName = user.name.split(" ")[0];
  const maxEnroll = Math.max(1, ...stats.programsWithCounts.map((p) => p._count.enrollments));

  return (
    <div className="space-y-7">
      {/* Bienvenida */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-primary-strong">
          {saludo()}, {firstName} 👋
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {user.role === "DIRECTORA"
            ? "Este es el estado de Gigi's"
            : "Aquí está el resumen de hoy"}
        </h1>
      </div>

      {/* Estadísticas */}
      <StatBar
        stats={[
          {
            label: "Participantes activos",
            value: stats.activeStudents,
            icon: <UsersThree weight="fill" className="size-[1.15rem]" />,
          },
          {
            label: "Programas activos",
            value: stats.activePrograms,
            icon: <Books weight="fill" className="size-[1.15rem]" />,
          },
          {
            label: "Inscripciones activas",
            value: stats.activeEnrollments,
            icon: <GraduationCap weight="fill" className="size-[1.15rem]" />,
          },
          {
            label: "Evaluaciones este mes",
            value: stats.evaluationsThisMonth,
            icon: <ChartLineUp weight="fill" className="size-[1.15rem]" />,
          },
        ]}
      />

      {/* Inscripciones que las familias hicieron por su cuenta (enterado, no aprobación) */}
      {reservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <CalendarCheck weight="fill" className="size-4 text-primary" />
                Inscripciones de las familias
                <Badge tone="info">{reservations.length}</Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border px-5 pb-4">
            {reservations.map((r) => {
              const full = r.occupied >= r.program.studentCapacity;
              const edad = edadLabel(r.student.birthDate);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.program.color ?? "var(--primary)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      <Link href={`/estudiantes/${r.student.id}`} className="hover:underline">
                        {r.student.firstName} {r.student.lastName}
                      </Link>
                      {edad && (
                        <span className="font-normal text-muted"> ({edad})</span>
                      )}{" "}
                      <span className="font-normal text-muted">se inscribió a</span>{" "}
                      {r.program.name}
                    </p>
                    <p className="text-xs text-muted">
                      <span className={`tnum font-semibold ${full ? "text-danger-strong" : ""}`}>
                        {r.occupied}/{r.program.studentCapacity} cupos
                      </span>
                      {full ? " · cupo lleno" : ""}
                      {" · "}
                      {haceTiempo(r.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Ausencias seguidas: hablar con la familia antes de que se pierda el ciclo */}
      {absenceAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <WarningCircle weight="fill" className="size-4 text-danger" />
                Ausencias seguidas
              </span>
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border px-5 pb-4">
            {absenceAlerts.map((a) => (
              <li key={`${a.student.id}:${a.program.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={`${a.student.firstName} ${a.student.lastName}`} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    <Link href={`/estudiantes/${a.student.id}`} className="hover:underline">
                      {a.student.firstName} {a.student.lastName}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted">{a.program.name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-danger-weak px-2.5 py-1 text-xs font-bold text-danger-strong">
                  {a.streak} faltas seguidas
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Distribución por programa */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Participantes por programa</CardTitle>
            <Button href="/programas" variant="ghost" size="sm">
              Ver programas
              <ArrowRight className="size-4" />
            </Button>
          </CardHeader>
          <div className="space-y-4 px-5 pb-5">
            {stats.programsWithCounts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Aún no hay programas registrados.
              </p>
            ) : (
              stats.programsWithCounts.map((p) => (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: p.color ?? "var(--primary)" }}
                      />
                      {p.name}
                    </span>
                    <span className="tnum shrink-0 font-semibold text-muted">
                      {p._count.enrollments}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(p._count.enrollments / maxEnroll) * 100}%`,
                        backgroundColor: p.color ?? "var(--primary)",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Actividad reciente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evaluaciones recientes</CardTitle>
          </CardHeader>
          <div className="px-2 pb-2">
            {stats.recentEvaluations.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  icon={<Star weight="fill" className="size-6" />}
                  title="Sin evaluaciones aún"
                  description="Las evaluaciones que registre el equipo aparecerán aquí."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {stats.recentEvaluations.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/estudiantes/${e.student.id}`}
                      className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <Avatar
                        name={`${e.student.firstName} ${e.student.lastName}`}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {e.student.firstName} {e.student.lastName}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {e.title}
                          {e.program ? ` · ${e.program.name}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {e.score != null && (
                          <span className="tnum text-sm font-extrabold text-ink">
                            {e.score}
                          </span>
                        )}
                        <span className="text-[0.7rem] text-subtle">
                          {haceTiempo(e.date)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
