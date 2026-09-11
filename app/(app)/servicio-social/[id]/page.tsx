import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Key,
  PencilSimple,
  Trash,
  ArrowsMerge,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { requireServiceAccess } from "@/lib/dal";
import { canManageService } from "@/lib/roles";
import {
  getVolunteer,
  listServiceAreas,
  listServiceLeaders,
  listServiceSchools,
  listVolunteers,
} from "@/lib/queries";
import {
  createVolunteerAccess,
  deleteServiceLog,
  deleteVolunteer,
  mergeVolunteers,
  setVolunteerStatus,
  updateVolunteer,
} from "@/lib/actions/servicio";
import {
  horasLabel,
  minutosQueCuentan,
  SERVICE_LOG_STATUS_LABEL,
  serviceLogTone,
  VOLUNTEER_STATUS_LABEL,
} from "@/lib/servicio";
import { fechaDia } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceLogDecision } from "@/components/service-log-decision";
import { PrintButton } from "@/components/print-button";

/** "YYYY-MM-DD" para los <input type="date"> (el campo es @db.Date, va en UTC). */
function fechaInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function PrestadorPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireServiceAccess();
  const puedeResolver = canManageService(me);
  const { id } = await params;

  const [volunteer, areas, lideres, escuelas, todos] = await Promise.all([
    getVolunteer(id),
    listServiceAreas(),
    listServiceLeaders(),
    listServiceSchools(),
    listVolunteers({ status: "TODOS" }),
  ]);
  if (!volunteer) notFound();

  const horas = volunteer.minutosAutorizados / 60;
  const avance =
    volunteer.requiredHours && volunteer.requiredHours > 0
      ? Math.min(100, Math.round((horas / volunteer.requiredHours) * 100))
      : null;
  const faltan =
    volunteer.requiredHours != null ? Math.max(0, volunteer.requiredHours - horas) : null;
  const pendientes = volunteer.logs.filter((l) => l.status === "PENDIENTE").length;

  return (
    <div>
      <Link
        href="/servicio-social"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink print:hidden"
      >
        <ArrowLeft className="size-4" />
        Servicio social
      </Link>

      {/* ── Encabezado y avance ────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-ink">{volunteer.name}</h1>
              <Badge tone={volunteer.status === "ACTIVO" ? "success" : "neutral"}>
                {VOLUNTEER_STATUS_LABEL[volunteer.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{volunteer.school}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-subtle">
              {volunteer.area && <span>{volunteer.area.name}</span>}
              {volunteer.leader && <span>Líder: {volunteer.leader.name}</span>}
              {volunteer.startDate && <span>Desde {fechaDia(volunteer.startDate)}</span>}
              {volunteer.email && <span>{volunteer.email}</span>}
              {volunteer.phone && <span>{volunteer.phone}</span>}
            </div>
          </div>
          <div className="text-right print:hidden">
            <p className="text-2xl font-extrabold text-success-strong">
              {horasLabel(volunteer.minutosAutorizados)}
            </p>
            <p className="text-xs text-muted">
              {volunteer.requiredHours
                ? `de ${volunteer.requiredHours} h · faltan ${faltan} h`
                : "autorizadas"}
            </p>
          </div>
        </div>

        {avance != null && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-[var(--success)] transition-[width]"
                style={{ width: `${avance}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-muted">{avance}% cumplido</p>
          </div>
        )}

        {volunteer.notes && (
          <p className="mt-4 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3 text-sm whitespace-pre-line text-muted">
            {volunteer.notes}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 print:hidden">
          {puedeResolver &&
            (["ACTIVO", "CONCLUIDO", "BAJA"] as const)
              .filter((e) => e !== volunteer.status)
              .map((e) => (
                <form key={e} action={setVolunteerStatus}>
                  <input type="hidden" name="id" value={volunteer.id} />
                  <input type="hidden" name="status" value={e} />
                  <Button type="submit" size="sm" variant="secondary">
                    Marcar {VOLUNTEER_STATUS_LABEL[e].toLowerCase()}
                  </Button>
                </form>
              ))}
          {/* Imprimir no es escribir: el lector también saca el concentrado de horas. */}
          <PrintButton label="Imprimir concentrado" />
        </div>
      </Card>

      {/* ── Acceso a la plataforma ─────────────────────────────────────────── */}
      {puedeResolver && (
        <Card className="mt-4 p-5 print:hidden">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Key weight="fill" className="size-4 text-primary" />
            Acceso para reportar sus horas
          </h2>
          {volunteer.user ? (
            <div className="mt-2 text-sm">
              <p className="text-muted">
                Usuario: <span className="font-mono font-bold text-ink">{volunteer.user.username}</span>
              </p>
              {volunteer.user.initialPassword ? (
                <p className="mt-0.5 text-muted">
                  Contraseña inicial:{" "}
                  <span className="font-mono font-bold text-ink">
                    {volunteer.user.initialPassword}
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-subtle">
                  Ya cambió su contraseña; la inicial dejó de aplicar.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                Todavía no tiene con qué entrar. Al generárselo podrá mandar su reporte de la
                semana desde la plataforma, en lugar del formulario de Google.
              </p>
              <form action={createVolunteerAccess} className="mt-3">
                <input type="hidden" name="id" value={volunteer.id} />
                <Button type="submit" size="sm">
                  <Key className="size-4" />
                  Generar usuario y contraseña
                </Button>
              </form>
            </>
          )}
        </Card>
      )}

      {/* ── Editar ficha y juntar duplicados ───────────────────────────────── */}
      {puedeResolver && (
        <div className="mt-4 space-y-3 print:hidden">
          <details>
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
              <PencilSimple className="size-4" />
              Editar ficha
            </summary>
            <Card className="mt-3 p-5">
              <form action={updateVolunteer} className="space-y-3">
                <input type="hidden" name="id" value={volunteer.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre completo" htmlFor="e-name" required>
                    <Input id="e-name" name="name" required defaultValue={volunteer.name} />
                  </Field>
                  <Field
                    label="Institución"
                    htmlFor="e-school"
                    hint={
                      volunteer.schoolId
                        ? undefined
                        : `Hoy dice «${volunteer.school}», que no está en el catálogo. Si lo dejas sin escoger se queda así.`
                    }
                  >
                    {/* Lo que tenía escrito viaja en un campo oculto: si su
                        institución no está en la lista —pasa con lo que vino de
                        la hoja— guardar no debe vaciársela. */}
                    <input type="hidden" name="school" value={volunteer.school} />
                    <Select id="e-school" name="schoolId" defaultValue={volunteer.schoolId ?? ""}>
                      <option value="">
                        {volunteer.schoolId ? "Sin institución" : `Dejar «${volunteer.school}»`}
                      </option>
                      {escuelas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Área en la que apoya" htmlFor="e-area">
                    <Select id="e-area" name="areaId" defaultValue={volunteer.areaId ?? ""}>
                      <option value="">Sin asignar</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                      {/* El área de su ficha puede ser una que ya no se ofrece. */}
                      {volunteer.area && !areas.some((a) => a.id === volunteer.area!.id) && (
                        <option value={volunteer.area.id}>{volunteer.area.name} (inactiva)</option>
                      )}
                    </Select>
                  </Field>
                  <Field label="Líder de área" htmlFor="e-leader">
                    <Select id="e-leader" name="leaderId" defaultValue={volunteer.leaderId ?? ""}>
                      <option value="">Sin asignar</option>
                      {lideres.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                      {volunteer.leader && !lideres.some((l) => l.id === volunteer.leader!.id) && (
                        <option value={volunteer.leader.id}>
                          {volunteer.leader.name} (inactivo)
                        </option>
                      )}
                    </Select>
                  </Field>
                  <Field
                    label="Horas que le pide su escuela"
                    htmlFor="e-hours"
                    hint="Vacío = sin meta; solo se le lleva el acumulado."
                  >
                    <Input
                      id="e-hours"
                      name="requiredHours"
                      inputMode="numeric"
                      defaultValue={volunteer.requiredHours ?? ""}
                    />
                  </Field>
                  <Field label="Correo" htmlFor="e-email">
                    <Input id="e-email" name="email" type="email" defaultValue={volunteer.email ?? ""} />
                  </Field>
                  <Field label="Inicio del servicio" htmlFor="e-start">
                    <Input
                      id="e-start"
                      name="startDate"
                      type="date"
                      defaultValue={fechaInput(volunteer.startDate)}
                    />
                  </Field>
                  <Field label="Término / liberación" htmlFor="e-end">
                    <Input
                      id="e-end"
                      name="endDate"
                      type="date"
                      defaultValue={fechaInput(volunteer.endDate)}
                    />
                  </Field>
                  <Field label="Teléfono" htmlFor="e-phone">
                    <Input id="e-phone" name="phone" defaultValue={volunteer.phone ?? ""} />
                  </Field>
                </div>
                <Field label="Nota interna" htmlFor="e-notes">
                  <Textarea id="e-notes" name="notes" rows={2} defaultValue={volunteer.notes ?? ""} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <form action={deleteVolunteer}>
                    <input type="hidden" name="id" value={volunteer.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger-strong transition-colors hover:underline"
                    >
                      <Trash className="size-3.5" />
                      Eliminar prestador y sus {volunteer.logs.length} reportes
                    </button>
                  </form>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </Card>
          </details>

          <details>
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
              <ArrowsMerge className="size-4" />
              Juntar con otra ficha
            </summary>
            <Card className="mt-3 p-5">
              <p className="text-xs text-muted">
                Si la misma persona quedó dos veces —en el formulario de Google su nombre se
                escribió de varias maneras—, escoge la otra ficha: sus reportes se pasan a{" "}
                <span className="font-semibold text-ink">esta</span> y la otra se borra. No se
                puede deshacer, así que revisa primero que de verdad sean la misma persona.
              </p>
              <form action={mergeVolunteers} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="keepId" value={volunteer.id} />
                <Field label="Ficha que se va" htmlFor="m-merge" className="min-w-64 flex-1">
                  <Select id="m-merge" name="mergeId" defaultValue="" required>
                    <option value="" disabled>
                      Escoge la ficha repetida…
                    </option>
                    {todos
                      .filter((v) => v.id !== volunteer.id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.school} ({horasLabel(v.minutosAutorizados)})
                        </option>
                      ))}
                  </Select>
                </Field>
                <Button type="submit" variant="secondary">
                  Juntar
                </Button>
              </form>
            </Card>
          </details>
        </div>
      )}

      {/* ── Reportes ───────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Clock weight="fill" className="size-4 text-primary" />
          Reportes de horas
          <span className="text-xs font-medium text-subtle">
            {volunteer.logs.length} en total
            {pendientes > 0 ? ` · ${pendientes} por revisar` : ""}
          </span>
        </h2>

        <div className="mt-3 space-y-3">
          {volunteer.logs.length === 0 ? (
            <EmptyState
              icon={<Clock weight="fill" className="size-6" />}
              title="Todavía no reporta horas"
              description="Cuando mande su primer reporte de la semana aparecerá aquí."
            />
          ) : (
            volunteer.logs.map((log) => {
              const cuentan = minutosQueCuentan(log);
              const recortado = log.status === "AUTORIZADO" && log.approvedMinutes != null;
              return (
                <Card key={log.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">
                          {log.rawHours ? "Sin capturar" : horasLabel(log.reportedMinutes)}
                        </span>
                        <Badge tone={serviceLogTone(log.status)}>
                          {SERVICE_LOG_STATUS_LABEL[log.status]}
                        </Badge>
                        {recortado && (
                          <Badge tone="info">
                            <CheckCircle className="size-3" />
                            cuentan {horasLabel(cuentan)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-subtle">
                        {fechaDia(log.weekStart)} — {fechaDia(log.weekEnd)}
                        {log.area ? ` · ${log.area.name}` : ""}
                        {log.leader ? ` · Líder: ${log.leader.name}` : ""}
                      </p>
                      <p className="mt-2 text-sm whitespace-pre-line text-muted">{log.activities}</p>
                      {log.decisionNote && (
                        <p className="mt-2 rounded-[var(--radius-control)] border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                          {log.decisionNote}
                          {log.decidedBy ? ` — ${log.decidedBy.name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {puedeResolver && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 print:hidden">
                      <ServiceLogDecision
                        id={log.id}
                        reportedMinutes={log.reportedMinutes}
                        rawHours={log.rawHours}
                        status={log.status}
                      />
                      <form action={deleteServiceLog}>
                        <input type="hidden" name="id" value={log.id} />
                        <button
                          type="submit"
                          aria-label="Eliminar reporte"
                          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                        >
                          <Trash className="size-4" />
                        </button>
                      </form>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
