"use client";

import { useActionState, useEffect, useRef } from "react";
import { Warning, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { submitServiceLog, type ReporteState } from "@/lib/actions/servicio";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ActivitiesField } from "@/components/activities-field";

type Opcion = { id: string; name: string };

/**
 * El reporte semanal del prestador. Es el formulario de Google, con dos cambios:
 * su nombre y su escuela ya no se preguntan (los trae su ficha, y así se acaban
 * los «David Hernpandez» que hacían que sus horas quedaran repartidas en varias
 * personas), y las horas se validan al mandarlas en vez de descubrirse mal
 * escritas meses después.
 */
export function ServiceLogForm({
  areas,
  lideres,
  areaId,
  leaderId,
}: {
  areas: Opcion[];
  lideres: Opcion[];
  areaId: string | null;
  leaderId: string | null;
}) {
  const [state, action, pending] = useActionState<ReporteState, FormData>(
    submitServiceLog,
    undefined,
  );
  const form = useRef<HTMLFormElement>(null);

  // Al mandarse, el formulario se vacía: lo que sigue es la semana siguiente, no
  // corregir la que acaba de irse (ya no se puede, y dejarla llena invita a
  // mandarla otra vez).
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={form} action={action} className="space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3 py-2.5 text-sm font-medium text-danger-strong"
        >
          <Warning weight="fill" className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-input)] border border-success/30 bg-success-weak px-3 py-2.5 text-sm font-medium text-success-strong"
        >
          <CheckCircle weight="fill" className="size-4 shrink-0" />
          Listo, tu reporte ya llegó. La coordinación lo revisa y lo verás abajo.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Área en la que apoyaste" htmlFor="s-area" required>
          <Select id="s-area" name="areaId" defaultValue={areaId ?? ""} required>
            <option value="" disabled>
              Escoge un área…
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Líder de área" htmlFor="s-leader" required>
          <Select id="s-leader" name="leaderId" defaultValue={leaderId ?? ""} required>
            <option value="" disabled>
              Escoge a tu líder…
            </option>
            {lideres.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Inicio de la semana" htmlFor="s-start" required>
          <Input id="s-start" name="weekStart" type="date" required />
        </Field>

        <Field label="Término de la semana" htmlFor="s-end" required>
          <Input id="s-end" name="weekEnd" type="date" required />
        </Field>
      </div>

      <Field
        label="Horas totales a reportar"
        htmlFor="s-hours"
        required
        hint="Un número: 6, 8.5 o 10:30 si fueron diez y media. Solo esta semana, no el acumulado."
      >
        <Input id="s-hours" name="hours" required inputMode="decimal" placeholder="Ej. 8" />
      </Field>

      <ActivitiesField
        id="s-activities"
        hint="Al grano: es lo que tu líder de área lee para avalarte las horas."
      />

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>
          <PaperPlaneTilt weight="fill" className="size-4" />
          Mandar mi reporte
        </Button>
      </div>
    </form>
  );
}
