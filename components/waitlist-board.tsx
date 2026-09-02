"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle, Warning, X } from "@phosphor-icons/react";
import {
  acceptWaitlist,
  rejectWaitlist,
  type WaitlistDecisionState,
} from "@/lib/actions/waitlist";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { haceTiempo } from "@/lib/format";
import { edadLabel } from "@/lib/utils";

type Request = {
  id: string;
  requestedAt: string;
  message: string | null;
  student: { id: string; firstName: string; lastName: string; matricula: string | null; birthDate: string | null };
  ageOk: boolean;
  load: { current: number; max: number | null; full: boolean };
};

type Group = {
  program: {
    id: string;
    name: string;
    color: string | null;
    area: string | null;
    studentCapacity: number;
    allowFamilyEnroll: boolean;
  };
  occupied: number;
  /** Lugares totales: la suma de los grupos de la actividad, o su cupo si no reparte. */
  capacity: number;
  requests: Request[];
};

/**
 * La fila de espera por actividad, en orden de llegada. Aceptar inscribe de una vez;
 * si hay reparos (cupo lleno, tope de actividades, empalme) el servidor los devuelve
 * y aquí se confirman — el mismo trato que inscribir desde el expediente.
 *
 * La EDAD no es de esos: aquí no se puede autorizar. Quien no cumple la edad de la
 * actividad no se inscribe por la fila; si de veras hay que meterlo, se hace desde su
 * expediente, que es donde queda constancia de quién lo autorizó.
 */
export function WaitlistBoard({
  groups,
  canDecide,
}: {
  groups: Group[];
  canDecide: boolean;
}) {
  if (groups.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={<CheckCircle weight="fill" className="size-6" />}
          title="No hay nadie esperando"
          description="Cuando una familia pida lugar en una actividad, aparecerá aquí en orden de llegada."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const left = Math.max(0, g.capacity - g.occupied);
        return (
          <Card key={g.program.id}>
            <CardHeader>
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: g.program.color ?? "var(--brand-teal)" }}
                />
                <div className="min-w-0">
                  <CardTitle>{g.program.name}</CardTitle>
                  <p className="text-xs text-muted">
                    {`${g.occupied} de ${g.capacity} cupos`}
                    {left === 0 ? " · cupo lleno" : ` · ${left} libres`}
                    {!g.program.allowFamilyEnroll && " · solo dirección inscribe"}
                  </p>
                </div>
              </div>
              <Badge tone={left === 0 ? "warning" : "info"}>
                {g.requests.length} esperando
              </Badge>
            </CardHeader>

            <ul className="divide-y divide-border">
              {g.requests.map((r, i) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  position={i + 1}
                  canDecide={canDecide}
                />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function RequestRow({
  request: r,
  position,
  canDecide,
}: {
  request: Request;
  position: number;
  canDecide: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [state, formAction, pending] = useActionState<WaitlistDecisionState, FormData>(
    async (prev, fd) => acceptWaitlist(r.id, prev, fd),
    undefined,
  );
  const warnings = state?.warnings ?? [];

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="tnum w-6 shrink-0 text-sm font-bold text-subtle">{position}</span>
        <Avatar name={`${r.student.firstName} ${r.student.lastName}`} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/estudiantes/${r.student.id}`}
            className="block truncate font-semibold text-ink hover:underline"
          >
            {r.student.firstName} {r.student.lastName}
          </Link>
          <p className="text-xs text-muted">
            {edadLabel(r.student.birthDate ? new Date(r.student.birthDate) : null) ??
              "Edad no registrada"}
            {r.student.matricula ? ` · ${r.student.matricula}` : ""}
            {` · pidió ${haceTiempo(r.requestedAt)}`}
          </p>
          {r.message && (
            <p className="mt-1 text-xs italic text-muted">“{r.message}”</p>
          )}
        </div>

        {canDecide && (
          <div className="flex shrink-0 gap-2">
            <form action={formAction}>
              {/* Segundo intento: la confirmación viaja con la misma acción. */}
              {warnings.length > 0 && <input type="hidden" name="force" value="1" />}
              <button
                type="submit"
                disabled={pending || !r.ageOk}
                title={
                  r.ageOk
                    ? undefined
                    : "Está fuera del rango de edad: se inscribe desde su expediente."
                }
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle weight="fill" className="size-4" />
                {warnings.length > 0 ? "Darle lugar de todos modos" : "Darle lugar"}
              </button>
            </form>
            <button
              onClick={() => setRejecting((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X weight="bold" className="size-3.5" />
              No hay lugar
            </button>
          </div>
        )}
      </div>

      {/* Reparos: aceptar inscribe, así que se avisa antes de qué se está pasando. */}
      {warnings.length > 0 && (
        <div className="mt-2 rounded-[var(--radius-control)] border border-warning bg-warning-weak/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-warning-strong">
            <Warning weight="fill" className="size-4 shrink-0" />
            Antes de darle lugar
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-ink">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            Si aun así le toca, vuelve a apretar el botón: queda inscrito y se anota en
            la bitácora quién lo autorizó.
          </p>
        </div>
      )}
      {state?.error && (
        <p className="mt-2 text-sm font-semibold text-danger-strong">{state.error}</p>
      )}
      {r.load.max != null && !state && r.load.full && (
        <p className="mt-1.5 pl-9 text-xs text-warning-strong">
          {`Ya lleva ${r.load.current} de ${r.load.max} actividades del ciclo.`}
        </p>
      )}
      {!r.ageOk && (
        <p className="mt-1.5 pl-9 text-xs font-semibold text-danger-strong">
          Está fuera del rango de edad de la actividad: desde aquí no se le puede dar
          lugar. Si aun así le corresponde, inscríbelo desde su expediente.
        </p>
      )}

      {rejecting && canDecide && (
        <form
          action={async (fd) => {
            await rejectWaitlist(r.id, fd);
            setRejecting(false);
          }}
          className="mt-2 flex flex-col gap-2 sm:flex-row"
        >
          <input
            name="decisionNote"
            placeholder="¿Por qué no hay lugar? (opcional, lo ve la familia)"
            className="h-9 flex-1 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-subtle focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-control)] border border-danger px-3 py-1.5 text-xs font-bold text-danger-strong transition-colors hover:bg-danger-weak"
          >
            Confirmar que no hay lugar
          </button>
        </form>
      )}
    </li>
  );
}
