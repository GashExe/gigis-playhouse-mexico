import Link from "next/link";
import { headers } from "next/headers";
import {
  HandHeart,
  Clock,
  Hourglass,
  CheckCircle,
  CaretRight,
  UserPlus,
  Sliders,
  ArrowsMerge,
  Warning,
  GraduationCap,
} from "@phosphor-icons/react/dist/ssr";
import { requireServiceAccess } from "@/lib/dal";
import { canManageService } from "@/lib/roles";
import {
  getServiceStats,
  listPendingServiceLogs,
  listServiceAreas,
  listServiceLeaders,
  listServiceSchools,
  listVolunteers,
  listPossibleDuplicateVolunteers,
} from "@/lib/queries";
import { createVolunteer } from "@/lib/actions/servicio";
import { horasLabel, VOLUNTEER_STATUS_LABEL } from "@/lib/servicio";
import { fechaDia } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatBar } from "@/components/ui/stat-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/search-input";
import { ServiceLogDecision } from "@/components/service-log-decision";
import { PublicLinkCard } from "@/components/public-link-card";

export const metadata = { title: "Servicio social" };

const ESTADOS = ["TODOS", "ACTIVO", "CONCLUIDO", "BAJA"] as const;

export default async function ServicioSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  // Entra quien lleva el servicio social: la directora, quien tiene el rol, y
  // quien lo lleva además de lo suyo. El lector también, y no resuelve nada.
  const me = await requireServiceAccess();
  const puedeResolver = canManageService(me);

  const { q, estado } = await searchParams;

  // La liga pública, armada con el host de esta misma petición: la que se copia
  // es la de donde está corriendo la plataforma, sin depender de una variable de
  // entorno que alguien tenga que acordarse de cambiar al mover el despliegue.
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ligaPublica = `${protocolo}://${host}/reportar`;

  const filtro = ESTADOS.includes(estado as (typeof ESTADOS)[number]) ? estado! : "ACTIVO";

  const [stats, pendientes, volunteers, areas, lideres, duplicados, escuelas] =
    await Promise.all([
    getServiceStats(),
    listPendingServiceLogs(),
    listVolunteers({ q, status: filtro }),
    listServiceAreas(),
    listServiceLeaders(),
    listPossibleDuplicateVolunteers(),
    listServiceSchools(),
  ]);

  return (
    <div>
      <PageHeader
        title="Servicio social"
        subtitle="Los prestadores mandan su reporte de la semana y aquí se autoriza. Solo cuentan las horas autorizadas."
        actions={
          puedeResolver ? (
            <Button href="/servicio-social/catalogos" variant="secondary">
              <Sliders className="size-4" />
              Áreas y líderes
            </Button>
          ) : undefined
        }
      />

      <StatBar
        stats={[
          {
            label: "Prestadores activos",
            value: stats.activos,
            icon: <HandHeart weight="fill" className="size-5" />,
            tone: "pink",
          },
          {
            label: "Por revisar",
            value: stats.pendientes,
            icon: <Hourglass weight="fill" className="size-5" />,
            hint: stats.pendientes ? "Reportes esperando respuesta" : "Nada pendiente",
            tone: "orange",
          },
          {
            label: "Horas autorizadas",
            value: horasLabel(stats.totalMinutos),
            icon: <CheckCircle weight="fill" className="size-5" />,
            hint: "Desde 2021",
            tone: "green",
          },
          {
            label: "En el padrón",
            value: volunteers.length,
            icon: <GraduationCap weight="fill" className="size-5" />,
            hint: q
              ? "Resultados de la búsqueda"
              : filtro === "TODOS"
                ? "Todos"
                : VOLUNTEER_STATUS_LABEL[filtro as "ACTIVO"],
            tone: "blue",
          },
        ]}
      />

      {puedeResolver && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <PublicLinkCard url={ligaPublica} />

          {/* Se enseña solo cuando hay algo que revisar: una tarjeta que siempre
              dice "ninguno" acaba siendo parte del decorado y deja de leerse. */}
          {duplicados.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <ArrowsMerge weight="bold" className="size-4 text-warning-strong" />
                Fichas que podrían ser la misma persona
              </h2>
              <p className="mt-1 text-xs text-muted">
                Nadie las juntó solo: un nombre corto y uno largo pueden ser dos personas.
                Abre una y usa «Juntar con otra ficha» si de verdad son la misma.
              </p>
              <ul className="mt-3 space-y-2">
                {duplicados.map(({ a, b }) => (
                  <li
                    key={`${a.id}-${b.id}`}
                    className="rounded-[var(--radius-control)] border border-border bg-surface-2 px-3 py-2 text-xs"
                  >
                    <Link href={`/servicio-social/${a.id}`} className="font-semibold text-ink hover:text-primary-strong">
                      {a.name}
                    </Link>
                    <span className="text-subtle"> · </span>
                    <Link href={`/servicio-social/${b.id}`} className="font-semibold text-ink hover:text-primary-strong">
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── Bandeja: lo que está esperando respuesta ───────────────────────── */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Hourglass weight="fill" className="size-4 text-warning-strong" />
          Por revisar
          {pendientes.length > 0 && <Badge tone="warning">{pendientes.length}</Badge>}
        </h2>
        <p className="mt-1 text-xs text-muted">
          Lo más viejo primero: quien reportó hace más tiempo lleva más esperando su respuesta.
        </p>

        <div className="mt-3 space-y-3">
          {pendientes.length === 0 ? (
            <EmptyState
              icon={<CheckCircle weight="fill" className="size-6" />}
              title="Nada por revisar"
              description="Todos los reportes de horas ya tienen respuesta."
            />
          ) : (
            pendientes.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/servicio-social/${log.volunteer.id}`}
                      className="font-bold text-ink hover:text-primary-strong"
                    >
                      {log.volunteer.name}
                    </Link>
                    <p className="text-xs text-subtle">{log.volunteer.school}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 font-semibold text-ink">
                        <Clock className="size-3.5" />
                        {log.rawHours ? "Sin capturar" : horasLabel(log.reportedMinutes)}
                      </span>
                      <span>
                        {fechaDia(log.weekStart)} — {fechaDia(log.weekEnd)}
                      </span>
                      {log.area && <span>{log.area.name}</span>}
                      {log.leader && <span>Líder: {log.leader.name}</span>}
                      {log.source === "FORMULARIO" && <Badge tone="neutral">Del formulario</Badge>}
                      {/* Lo que entra por la liga no trae a nadie identificado
                          detrás: quien autoriza tiene que saberlo. */}
                      {log.source === "LIGA_PUBLICA" && (
                        <Badge tone="warning">
                          <Warning weight="fill" className="size-3" />
                          Por la liga, sin cuenta
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-line text-muted">{log.activities}</p>
                  </div>
                </div>
                {puedeResolver && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ServiceLogDecision
                      id={log.id}
                      reportedMinutes={log.reportedMinutes}
                      rawHours={log.rawHours}
                      status="PENDIENTE"
                    />
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </section>

      {/* ── Padrón de prestadores ──────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <HandHeart weight="fill" className="size-4 text-primary" />
            Prestadores
          </h2>
          <SearchInput placeholder="Buscar por nombre o escuela…" />
        </div>

        {/* Al buscar no se enseña el filtro: la búsqueda pasa por encima de él a
            propósito, y dejar las pestañas puestas haría creer que el resultado
            está acotado a una de ellas. */}
        {q ? (
          <p className="mt-3 text-xs text-muted">
            Buscando <span className="font-semibold text-ink">«{q}»</span> entre activos,
            concluidos y bajas.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ESTADOS.map((e) => (
              <Link
                key={e}
                href={`/servicio-social?estado=${e}`}
                className={
                  (e === filtro
                    ? "bg-primary-weak text-primary-strong "
                    : "text-muted hover:bg-surface-2 hover:text-ink ") +
                  "rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-semibold transition-colors"
                }
              >
                {e === "TODOS" ? "Todos" : VOLUNTEER_STATUS_LABEL[e]}
              </Link>
            ))}
          </div>
        )}

        {puedeResolver && (
          <details className="mt-4">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
              <UserPlus className="size-4" />
              Dar de alta un prestador
            </summary>
            <Card className="mt-3 p-5">
              <form action={createVolunteer} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre completo" htmlFor="v-name" required>
                    <Input id="v-name" name="name" required placeholder="Ej. Ana Sofía Ruiz Pérez" />
                  </Field>
                  <Field label="¿De qué institución viene?" htmlFor="v-school" required>
                    <Select id="v-school" name="schoolId" defaultValue="" required>
                      <option value="" disabled>
                        Escoge una institución…
                      </option>
                      {escuelas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Área en la que apoya" htmlFor="v-area">
                    <Select id="v-area" name="areaId" defaultValue="">
                      <option value="">Sin asignar</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Líder de área" htmlFor="v-leader">
                    <Select id="v-leader" name="leaderId" defaultValue="">
                      <option value="">Sin asignar</option>
                      {lideres.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Horas que le pide su escuela"
                    htmlFor="v-hours"
                    hint="Opcional. Cada escuela marca las suyas (480, 500, 240…). Sin esto solo se le lleva el acumulado."
                  >
                    <Input id="v-hours" name="requiredHours" inputMode="numeric" placeholder="480" />
                  </Field>
                  <Field label="Inicio del servicio" htmlFor="v-start">
                    <Input id="v-start" name="startDate" type="date" />
                  </Field>
                  <Field label="Correo" htmlFor="v-email">
                    <Input id="v-email" name="email" type="email" />
                  </Field>
                  <Field label="Teléfono" htmlFor="v-phone">
                    <Input id="v-phone" name="phone" />
                  </Field>
                </div>
                <Field label="Nota interna" htmlFor="v-notes" hint="Solo la ve la coordinación.">
                  <Textarea id="v-notes" name="notes" rows={2} />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit">Dar de alta</Button>
                </div>
              </form>
            </Card>
          </details>
        )}

        <div className="mt-4 space-y-2">
          {volunteers.length === 0 ? (
            <EmptyState
              icon={<HandHeart weight="fill" className="size-6" />}
              title={q ? "Nadie con esa búsqueda" : "Todavía no hay prestadores"}
              description={
                q
                  ? "Prueba con otro nombre o con la escuela."
                  : "Da de alta al primero, o importa la hoja del formulario de Google."
              }
            />
          ) : (
            volunteers.map((v) => {
              const horas = v.minutosAutorizados / 60;
              const avance =
                v.requiredHours && v.requiredHours > 0
                  ? Math.min(100, Math.round((horas / v.requiredHours) * 100))
                  : null;
              return (
                <Card key={v.id} className="p-4">
                  <Link href={`/servicio-social/${v.id}`} className="group flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink group-hover:text-primary-strong">
                          {v.name}
                        </h3>
                        {v.status !== "ACTIVO" && (
                          <Badge tone="neutral">{VOLUNTEER_STATUS_LABEL[v.status]}</Badge>
                        )}
                        {v.pendientes > 0 && (
                          <Badge tone="warning">
                            {v.pendientes} por revisar
                          </Badge>
                        )}
                        {!v.user && <Badge tone="neutral">Sin acceso</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {v.school}
                        {v.area ? ` · ${v.area.name}` : ""}
                        {v.leader ? ` · Líder: ${v.leader.name}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-bold text-success-strong">
                          {horasLabel(v.minutosAutorizados)} autorizadas
                        </span>
                        {v.requiredHours ? (
                          <span className="text-muted">de {v.requiredHours} h · {avance}%</span>
                        ) : (
                          <span className="text-subtle">sin meta capturada</span>
                        )}
                        {v.endDate && (
                          <span className="text-subtle">último reporte {fechaDia(v.endDate)}</span>
                        )}
                      </div>
                      {avance != null && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-[var(--success)]"
                            style={{ width: `${avance}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <CaretRight className="mt-1 size-4 shrink-0 text-subtle" />
                  </Link>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
