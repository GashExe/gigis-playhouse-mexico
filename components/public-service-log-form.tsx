"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Warning,
  CheckCircle,
  PaperPlaneTilt,
  MagnifyingGlass,
  UserCircle,
} from "@phosphor-icons/react";
import {
  submitPublicServiceLog,
  validarCorreo,
  type ReporteState,
  type ValidaCorreoState,
} from "@/lib/actions/servicio";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ActivitiesField } from "@/components/activities-field";

type Opcion = { id: string; name: string };

/**
 * El reporte semanal por la liga abierta: el Google Form, en casa y sin cuenta.
 *
 * El CORREO va primero, antes que el nombre, y eso no es un capricho de orden.
 * En la hoja vieja la misma persona escribía su nombre de tres maneras y acababa
 * con tres fichas y sus horas repartidas. Preguntando primero el correo se le
 * pueden devolver sus propios datos ya escritos —nombre, institución, área y
 * líder— y entonces no hay nada que teclear distinto. El nombre deja de ser la
 * llave; pasa a ser un dato que la plataforma recuerda por él.
 *
 * Quien no esté registrado llena todo, igual que antes.
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
  const [busqueda, buscar, buscando] = useActionState<ValidaCorreoState, FormData>(
    validarCorreo,
    undefined,
  );

  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state?.ok) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state?.enviados, state?.ok]);

  const encontrado = busqueda?.estado === "encontrado" ? busqueda : null;
  const yaValidado = busqueda?.estado === "encontrado" || busqueda?.estado === "nuevo";

  /**
   * La identidad del formulario de abajo. Al cambiar, React lo vuelve a montar y
   * los campos se rellenan solos con lo que traiga la validación.
   *
   * Va así, y no copiando los datos a estado dentro de un efecto, porque esa
   * copia es la que se desincroniza: en cuanto alguien edita un campo y vuelve a
   * validar, hay dos versiones del mismo dato y una gana por accidente. Con la
   * llave hay una sola fuente, y además se limpia lo de la semana en cada envío
   * —lo de la persona no, que casi siempre viene a mandar otra semana seguida.
   */
  const llave = [
    busqueda?.estado ?? "sin-validar",
    encontrado?.name ?? "",
    state?.enviados ?? 0,
  ].join("|");

  return (
    <div className="space-y-4">
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
                {" "}y quedó a nombre de <span className="font-bold">{state.nombre}</span>
              </>
            ) : null}
            . La coordinación de servicio social lo revisa y autoriza tus horas. Si te
            falta otra semana, puedes mandarla aquí mismo.
          </span>
        </div>
      )}

      {/* ── Paso 1: quién eres ──────────────────────────────────────────────
          Va en su propio formulario, y no dentro del grande, para que validar el
          correo no arrastre ni valide el resto de los campos todavía vacíos. */}
      <form action={buscar} className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-4">
        <Field
          label="Tu correo"
          htmlFor="p-email"
          required
          hint="Usa SIEMPRE el mismo. Con él te reconocemos y tus horas se acumulan juntas."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              id="p-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={160}
              placeholder="tucorreo@escuela.mx"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-48 flex-1"
            />
            <Button type="submit" variant="secondary" loading={buscando} disabled={buscando}>
              <MagnifyingGlass className="size-4" />
              Validar correo
            </Button>
          </div>
        </Field>

        {busqueda?.estado === "invalido" && (
          <p className="mt-2 text-xs font-semibold text-danger-strong">
            Ese correo no se ve bien. Revísalo.
          </p>
        )}
        {busqueda?.estado === "encontrado" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success-strong">
            <UserCircle weight="fill" className="size-4" />
            Hola de nuevo. Ya llenamos tus datos abajo — revísalos por si algo cambió.
          </p>
        )}
        {busqueda?.estado === "nuevo" && (
          <p className="mt-2 text-xs text-muted">
            Es tu primer reporte con este correo. Llena tus datos abajo y con eso quedas
            registrado; la próxima vez ya salen solos.
          </p>
        )}
      </form>

      {/* ── Paso 2: el reporte ─────────────────────────────────────────────── */}
      <form key={llave} action={action} className="space-y-4">
        <input type="hidden" name="email" value={email} />

        <Field label="Nombre completo" htmlFor="p-name" required>
          <Input
            id="p-name"
            name="name"
            required
            autoComplete="name"
            maxLength={120}
            defaultValue={encontrado?.name ?? ""}
          />
        </Field>

        <Field label="¿De qué institución provienes?" htmlFor="p-school" required>
          <Select
            id="p-school"
            name="schoolId"
            required
            defaultValue={encontrado?.schoolId ?? ""}
          >
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
            <Select
              id="p-area"
              name="areaId"
              required
              defaultValue={encontrado?.areaId ?? ""}
            >
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
            <Select
              id="p-leader"
              name="leaderId"
              required
              defaultValue={encontrado?.leaderId ?? ""}
            >
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

        <Button
          type="submit"
          loading={pending}
          disabled={pending || !yaValidado}
          className="w-full"
          size="lg"
        >
          <PaperPlaneTilt weight="fill" className="size-4" />
          Mandar mi reporte
        </Button>
        {!yaValidado && (
          <p className="text-center text-xs text-subtle">
            Primero valida tu correo, arriba.
          </p>
        )}
      </form>
    </div>
  );
}
