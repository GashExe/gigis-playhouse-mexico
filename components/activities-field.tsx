"use client";

import { useState } from "react";
import { cuentaPalabras, MAX_PALABRAS_ACTIVIDADES } from "@/lib/servicio";
import { Field, Textarea } from "@/components/ui/field";

/**
 * El campo de actividades, con su cuenta de palabras a la vista.
 *
 * El tope se enseña mientras se escribe y no al mandar: descubrir que sobran
 * treinta palabras DESPUÉS de llenar todo el formulario es la manera segura de
 * que alguien borre a lo bruto con tal de que pase. El servidor lo vuelve a
 * revisar de todos modos —esto es una cortesía, no la regla.
 */
export function ActivitiesField({
  id,
  hint,
  rows = 4,
}: {
  id: string;
  hint: string;
  rows?: number;
}) {
  const [texto, setTexto] = useState("");
  const palabras = cuentaPalabras(texto);
  const sobran = palabras > MAX_PALABRAS_ACTIVIDADES;

  return (
    <Field label="Actividades realizadas" htmlFor={id} required hint={hint}>
      <Textarea
        id={id}
        name="activities"
        rows={rows}
        required
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué hiciste esta semana…"
        aria-describedby={`${id}-cuenta`}
      />
      <p
        id={`${id}-cuenta`}
        className={
          "mt-1 text-right text-xs font-semibold " +
          (sobran ? "text-danger-strong" : "text-subtle")
        }
      >
        {palabras} de {MAX_PALABRAS_ACTIVIDADES} palabras
        {sobran ? " · resúmelo un poco" : ""}
      </p>
    </Field>
  );
}
