import { redirect } from "next/navigation";
import { Clock, CheckCircle, Hourglass, XCircle } from "@phosphor-icons/react/dist/ssr";
import { requireVolunteer } from "@/lib/dal";
import { getVolunteer, listServiceAreas, listServiceLeaders } from "@/lib/queries";
import {
  horasLabel,
  minutosQueCuentan,
  SERVICE_LOG_STATUS_LABEL,
  serviceLogTone,
} from "@/lib/servicio";
import { fechaDia } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceLogForm } from "@/components/service-log-form";

export const metadata = { title: "Mi servicio social" };

export default async function MiServicioPage() {
  const me = await requireVolunteer();
  const [volunteer, areas, lideres] = await Promise.all([
    getVolunteer(me.volunteerId),
    listServiceAreas(),
    listServiceLeaders(),
  ]);
  // La ficha se borró debajo de la cuenta: no hay nada que enseñar aquí.
  if (!volunteer) redirect("/login");

  const horas = volunteer.minutosAutorizados / 60;
  const avance =
    volunteer.requiredHours && volunteer.requiredHours > 0
      ? Math.min(100, Math.round((horas / volunteer.requiredHours) * 100))
      : null;
  const faltan =
    volunteer.requiredHours != null
      ? Math.max(0, Math.round((volunteer.requiredHours - horas) * 10) / 10)
      : null;
  const porRevisar = volunteer.logs.filter((l) => l.status === "PENDIENTE").length;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Hola, {volunteer.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted">
        Aquí reportas las horas de tu semana y ves cuántas te han autorizado.
      </p>

      {/* ── Cómo va ────────────────────────────────────────────────────────── */}
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-extrabold text-success-strong">
              {horasLabel(volunteer.minutosAutorizados)}
            </p>
            <p className="text-xs text-muted">
              {volunteer.requiredHours
                ? `autorizadas de las ${volunteer.requiredHours} h que te pide tu escuela`
                : "autorizadas"}
            </p>
          </div>
          {faltan != null && (
            <p className="text-sm font-semibold text-ink">
              {faltan > 0 ? `Te faltan ${faltan} h` : "Ya cumpliste tus horas"}
            </p>
          )}
        </div>

        {avance != null && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-[var(--success)] transition-[width]"
              style={{ width: `${avance}%` }}
            />
          </div>
        )}

        {/* Que sepa que lo suyo ya llegó, aunque todavía no tenga respuesta: si no,
            un reporte pendiente se ve igual que uno que nunca se mandó. */}
        {porRevisar > 0 && (
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
            <Hourglass weight="fill" className="size-3.5" />
            {porRevisar} {porRevisar === 1 ? "reporte tuyo está" : "reportes tuyos están"} esperando
            respuesta de la coordinación. Esas horas todavía no cuentan.
          </p>
        )}

        {!volunteer.requiredHours && (
          <p className="mt-4 text-xs text-subtle">
            La coordinación todavía no captura cuántas horas te pide tu escuela. Mientras tanto se
            te lleva el acumulado.
          </p>
        )}
      </Card>

      {/* ── Reportar la semana ─────────────────────────────────────────────── */}
      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Clock weight="fill" className="size-4 text-primary" />
          Reportar mi semana
        </h2>
        <p className="mt-1 mb-4 text-xs text-muted">
          Una semana por reporte. Si apoyaste en dos áreas, manda un reporte por cada una.
        </p>
        <ServiceLogForm
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          lideres={lideres.map((l) => ({ id: l.id, name: l.name }))}
          areaId={volunteer.areaId}
          leaderId={volunteer.leaderId}
        />
      </Card>

      {/* ── Lo que ya mandé ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-sm font-bold text-ink">Lo que ya mandé</h2>
        <div className="mt-3 space-y-3">
          {volunteer.logs.length === 0 ? (
            <EmptyState
              icon={<Clock weight="fill" className="size-6" />}
              title="Todavía no mandas ninguna semana"
              description="Cuando mandes tu primer reporte aparecerá aquí, con la respuesta de la coordinación."
            />
          ) : (
            volunteer.logs.map((log) => {
              const cuentan = minutosQueCuentan(log);
              const recortado = log.status === "AUTORIZADO" && log.approvedMinutes != null;
              return (
                <Card key={log.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">
                      {log.rawHours ? log.rawHours : horasLabel(log.reportedMinutes)}
                    </span>
                    <Badge tone={serviceLogTone(log.status)}>
                      {log.status === "AUTORIZADO" && <CheckCircle weight="fill" className="size-3" />}
                      {log.status === "NO_AUTORIZADO" && <XCircle weight="fill" className="size-3" />}
                      {SERVICE_LOG_STATUS_LABEL[log.status]}
                    </Badge>
                    {recortado && <Badge tone="info">te cuentan {horasLabel(cuentan)}</Badge>}
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
                    </p>
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
