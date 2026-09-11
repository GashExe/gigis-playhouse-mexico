"use client";

import { useActionState, useEffect, useRef } from "react";
import { Warning, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { submitPublicServiceLog, type ReporteState } from "@/lib/actions/servicio";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ActivitiesField } from "@/components/activities-field";

type Opcion = { id: string; name: string };

/**
 * El reporte semanal por la liga abierta: el Google Form, en casa y sin cuenta.
 *
 * Las preguntas y su orden son los del formulario a propósito. Quien lo llena
 * lleva años llenando el otro; cambiarle el orden o la redacción "porque se ve
 * mejor" solo lograría que se equivoque de campo.
 *
 * Lo único que se agregó es el correo, y es lo que arregla el problema de fondo
 * de la hoja vieja: ahí la misma persona escribía su nombre de tres maneras y
 * acababa con tres fichas y sus horas repartidas. El correo no se teclea
 * distinto, así que con él se reconoce a quién acreditarle la semana aunque el
 * nombre venga con erratas.
 */
export function PublicServiceLogForm({
  areas,
  lideres,
  escuelas,
}: {
  areas: Opcion[];
  lideres: Opcion[];
  escuelas: Opcion[];
}) {
  const [state, action, pending] = useActionState<ReporteState, FormData>(
    submitPublicServiceLog,
    undefined,
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
          className="flex items-start gap-2 rounded-[var(--radius-input)] border border-success/30 bg-success-weak px-3 py-3 text-sm font-medium text-success-strong"
        >
          <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
          <span>
            Listo, tu reporte ya llegó
            {state.nombre ? (
              <>
                {" "}y quedó a nombre de{" "}
                <span className="font-bold">{state.nombre}</span>
              </>
            ) : null}
            . La coordinación de servicio social lo revisa y autoriza tus horas. Si te
            falta otra semana, puedes mandarla aquí mismo.
          </span>
        </div>
      )}

      <Field label="Nombre completo" htmlFor="p-name" required>
        <Input id="p-name" name="name" required autoComplete="name" maxLength={120} />
      </Field>

      <Field
        label="Correo"
        htmlFor="p-email"
        required
        hint="Usa SIEMPRE el mismo. Con él sabemos que eres tú y tus horas se acumulan juntas, aunque un día escribas tu nombre distinto."
      >
        <Input
          id="p-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={160}
          placeholder="tucorreo@escuela.mx"
        />
      </Field>

      <Field
        label="¿De qué institución provienes?"
        htmlFor="p-school"
        required
        hint="Si la tuya no aparece, pídele a la coordinación de servicio social que la agregue."
      >
        <Select id="p-school" name="schoolId" defaultValue="" required>
          <option value="" disabled>
            Escoge tu institución…
          </option>
          {escuelas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Área en la que apoyas" htmlFor="p-area" required>
          <Select id="p-area" name="areaId" defaultValue="" required>
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

        <Field label="Nombre del líder de área" htmlFor="p-leader" required>
          <Select id="p-leader" name="leaderId" defaultValue="" required>
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

        <Field label="Fecha de inicio de semana a reportar" htmlFor="p-start" required>
          <Input id="p-start" name="weekStart" type="date" required />
        </Field>

        <Field label="Fecha de término de semana a reportar" htmlFor="p-end" required>
          <Input id="p-end" name="weekEnd" type="date" required />
        </Field>
      </div>

      <Field
        label="Horas totales a reportar"
        htmlFor="p-hours"
        required
        hint="Un número: 6, 8.5 o 10:30 si fueron diez y media. Solo de esta semana."
      >
        <Input id="p-hours" name="hours" required inputMode="decimal" placeholder="Ej. 8" />
      </Field>

      <ActivitiesField
        id="p-activities"
        rows={5}
        hint="Al grano: es lo que tu líder de área lee para avalarte las horas."
      />

      <Button type="submit" loading={pending} disabled={pending} className="w-full" size="lg">
        <PaperPlaneTilt weight="fill" className="size-4" />
        Mandar mi reporte
      </Button>
    </form>
  );
}
