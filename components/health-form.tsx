"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions/students";

export type HealthDefaults = {
  bloodType: string;
  allergies: string;
  medications: string;
  medicalConditions: string;
  therapies: string;
  dietaryRestrictions: string;
  doctorName: string;
  doctorPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  healthNotes: string;
};

/**
 * Captura del historial médico por parte del personal. Pide exactamente lo mismo
 * que el formulario del tutor: comparten HealthSchema, así que capturar por aquí no
 * es una vía más laxa.
 */
export function HealthForm({
  action,
  defaults,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: HealthDefaults;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Salud</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Alergias"
            htmlFor="allergies"
            required
            error={err.allergies?.[0]}
            hint="Si no tiene, escribe “Ninguna”."
          >
            <Input id="allergies" name="allergies" defaultValue={defaults.allergies} required />
          </Field>
          <Field label="Tipo de sangre (opcional)" htmlFor="bloodType">
            <Input id="bloodType" name="bloodType" defaultValue={defaults.bloodType} placeholder="O+" />
          </Field>
          <Field label="Medicamentos actuales (opcional)" htmlFor="medications">
            <Input id="medications" name="medications" defaultValue={defaults.medications} />
          </Field>
          <Field label="Condiciones médicas / diagnóstico (opcional)" htmlFor="medicalConditions">
            <Input id="medicalConditions" name="medicalConditions" defaultValue={defaults.medicalConditions} />
          </Field>
          <Field label="Terapias externas (opcional)" htmlFor="therapies">
            <Input id="therapies" name="therapies" defaultValue={defaults.therapies} />
          </Field>
          <Field label="Restricciones alimentarias (opcional)" htmlFor="dietaryRestrictions">
            <Input id="dietaryRestrictions" name="dietaryRestrictions" defaultValue={defaults.dietaryRestrictions} />
          </Field>
          <Field label="Médico de cabecera (opcional)" htmlFor="doctorName">
            <Input id="doctorName" name="doctorName" defaultValue={defaults.doctorName} />
          </Field>
          <Field label="Teléfono del médico (opcional)" htmlFor="doctorPhone">
            <Input id="doctorPhone" name="doctorPhone" inputMode="tel" defaultValue={defaults.doctorPhone} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Contacto de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre" htmlFor="emergencyName" required error={err.emergencyName?.[0]}>
            <Input id="emergencyName" name="emergencyName" defaultValue={defaults.emergencyName} required />
          </Field>
          <Field label="Teléfono" htmlFor="emergencyPhone" required error={err.emergencyPhone?.[0]}>
            <Input id="emergencyPhone" name="emergencyPhone" inputMode="tel" defaultValue={defaults.emergencyPhone} required />
          </Field>
          <Field label="Parentesco (opcional)" htmlFor="emergencyRelation">
            <Input id="emergencyRelation" name="emergencyRelation" defaultValue={defaults.emergencyRelation} placeholder="Madre, padre…" />
          </Field>
        </div>
        <Field className="mt-4" label="Observaciones de salud (opcional)" htmlFor="healthNotes">
          <Textarea id="healthNotes" name="healthNotes" rows={3} defaultValue={defaults.healthNotes} />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar historial"}
        </Button>
        <Link
          href={cancelHref}
          className="text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
