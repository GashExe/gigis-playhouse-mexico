import Link from "next/link";
import {
  UsersThree,
  Books,
  GraduationCap,
  ChartLineUp,
  ArrowRight,
  Star,
  CalendarCheck,
  Printer,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getActiveCycle,
  getDashboardStats,
  getFinalGradingProgress,
  getAbsenceAlerts,
  listFullPrograms,
  listRecentFamilyReservations,
} from "@/lib/queries";
import { addDays, toDateKey, type Slot } from "@/lib/schedule";
import { saludo, haceTiempo } from "@/lib/format";
import { edadLabel } from "@/lib/utils";
import { StatBar } from "@/components/ui/stat-bar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TutorialVideo } from "@/components/tutorial-video";

export const metadata = { title: "Panel" };

/**
 * Próximo día de clase según el horario, para que el enlace de imprimir caiga en la
 * hoja que se va a usar. Sin horario capturado, hoy.
 */
function proximaClase(slots: Slot[]): Date {
  const hoy = new Date();
  if (slots.length === 0) return hoy;
  const dias = new Set(slots.map((s) => s.weekday));
  for (let i = 0; i < 7; i++) {
    const d = addDays(hoy, i);
    if (dias.has(d.getDay())) return d;
  }
  return hoy;
}

export default async function PanelPage() {
  const user = await getCurrentUser();
  const esTerapeuta = user.role === "TERAPEUTA";
  const cycle = await getActiveCycle();
  const [stats, absenceAlerts, reservations, fullPrograms, grading] = await Promise.all([
    // Los números de arriba son del ciclo que está corriendo, no de la historia entera.
    getDashboardStats(cycle?.id),
    // La terapeuta ve las rachas de SUS grupos; el resto del equipo, todas.
    getAbsenceAlerts(esTerapeuta ? user.id : undefined),
    // Enterado de quién apartó lugar: no le toca a la terapeuta.
    esTerapeuta ? Promise.resolve([]) : listRecentFamilyReservations(),
    cycle ? listFullPrograms(cycle.id) : Promise.resolve([]),
    cycle
      ? getFinalGradingProgress(cycle.id)
      : Promise.resolve({ done: 0, total: 0 }),
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

      {/* Video tutorial: se abre solo la primera vez y queda siempre a la mano */}
      <TutorialVideo
        src="/tutoriales/tutorial-equipo.mp4"
        title="Video tutorial de la plataforma"
        description="Cómo usar Gigi's paso a paso. Dura unos minutos y puedes volver a verlo cuando quieras."
        autoOpen={user.tutorialSeenAt === null}
      />

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
            label: cycle ? `Inscripciones de ${cycle.label}` : "Inscripciones activas",
            value: stats.activeEnrollments,
            icon: <GraduationCap weight="fill" className="size-[1.15rem]" />,
          },
          {
            // Cuántas terapeutas ya cerraron TODAS sus calificaciones finales del
            // ciclo. Es lo que dirección persigue al cerrar; "evaluaciones este mes"
            // era un número que subía sin decir si ya estaba completo.
            label: "Terapeutas con su evaluación final",
            value: grading.total > 0 ? `${grading.done} de ${grading.total}` : "—",
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

      {/* Grupos completos: el aviso de que ya se puede cerrar la lista del grupo.
          No frena nada — la lista se puede imprimir cualquier día — pero es el
          momento en que la casa quiere tenerla en papel. */}
      {fullPrograms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <UsersThree weight="fill" className="size-4 text-primary" />
                Grupos completos
                <Badge tone="warning">{fullPrograms.length}</Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border px-5 pb-4">
            {fullPrograms.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color ?? "var(--primary)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted">
                    <span className="tnum font-semibold">
                      {p.occupied}/{p.studentCapacity} cupos
                    </span>
                    {" · cupo lleno"}
                    {p.waiting > 0 && (
                      <>
                        {" · "}
                        <Link href="/lista-espera" className="font-semibold hover:underline">
                          {p.waiting === 1
                            ? "1 en lista de espera"
                            : `${p.waiting} en lista de espera`}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href={`/calendario/${p.id}/lista?fecha=${toDateKey(proximaClase(p.scheduleSlots))}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Printer className="size-4" />
                  Imprimir lista
                </Link>
              </li>
            ))}
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
