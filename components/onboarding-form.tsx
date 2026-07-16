"use client";

import { useActionState } from "react";
import { Warning } from "@phosphor-icons/react";
import { completeOnboarding, type OnboardingState } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/card";

export type OnboardingDefaults = {
  birthDate?: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  medications?: string;
  medicalConditions?: string;
  therapies?: string;
  dietaryRestrictions?: string;
  doctorName?: string;
  doctorPhone?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  healthNotes?: string;
};

export function OnboardingForm({
  defaults = {},
  avisoPrivacidad,
  reglamento,
}: {
  defaults?: OnboardingDefaults;
  avisoPrivacidad: string;
  reglamento: string;
}) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    undefined,
  );
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {/* Datos del participante */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-sm font-bold text-ink">Datos del participante</h2>
        <p className="mb-4 text-xs text-muted">Confirma o completa los datos básicos.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de nacimiento" htmlFor="birthDate" required error={err.birthDate?.[0]}>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} required />
          </Field>
          <Field label="Sexo" htmlFor="gender" required error={err.gender?.[0]}>
            <Select id="gender" name="gender" defaultValue={defaults.gender ?? ""} required>
              <option value="" disabled>Selecciona…</option>
              <option value="FEMENINO">Femenino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OTRO">Otro</option>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Tutor / contacto */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-ink">Tutor responsable</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del tutor" htmlFor="guardianName" required error={err.guardianName?.[0]}>
            <Input id="guardianName" name="guardianName" defaultValue={defaults.guardianName} required />
          </Field>
          <Field label="Teléfono del tutor" htmlFor="guardianPhone" required error={err.guardianPhone?.[0]}>
            <Input id="guardianPhone" name="guardianPhone" inputMode="tel" defaultValue={defaults.guardianPhone} required placeholder="55 1234 5678" />
          </Field>
          <Field label="Correo (opcional)" htmlFor="guardianEmail" error={err.guardianEmail?.[0]}>
            <Input id="guardianEmail" name="guardianEmail" type="email" defaultValue={defaults.guardianEmail} />
          </Field>
          <Field label="Dirección (opcional)" htmlFor="address">
            <Input id="address" name="address" defaultValue={defaults.address} />
          </Field>
        </div>
      </Card>

      {/* Cuestionario de salud */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-sm font-bold text-ink">Cuestionario de salud</h2>
        <p className="mb-4 text-xs text-muted">
          Esta información es confidencial y nos ayuda a cuidar mejor al participante.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alergias" htmlFor="allergies" required error={err.allergies?.[0]} hint="Si no tiene, escribe “Ninguna”.">
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

        <div className="mt-4 rounded-[var(--radius-control)] border border-border bg-surface-2/50 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-subtle">Contacto de emergencia</h3>
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
        </div>

        <Field className="mt-4" label="Observaciones de salud (opcional)" htmlFor="healthNotes">
          <Textarea id="healthNotes" name="healthNotes" defaultValue={defaults.healthNotes} rows={3} />
        </Field>
      </Card>

      {/* Consentimientos */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-ink">Aviso de privacidad y reglamento</h2>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-subtle">Aviso de privacidad</p>
            <div className="max-h-44 overflow-y-auto whitespace-pre-line rounded-[var(--radius-control)] border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted">
              {avisoPrivacidad}
            </div>
            <label className="mt-2 flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" name="acceptPrivacy" value="on" required className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>He leído y acepto el aviso de privacidad.</span>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-subtle">Reglamento</p>
            <div className="max-h-44 overflow-y-auto whitespace-pre-line rounded-[var(--radius-control)] border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted">
              {reglamento}
            </div>
            <label className="mt-2 flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" name="acceptRules" value="on" required className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>He leído y acepto el reglamento de Gigi&apos;s Playhouse.</span>
            </label>
          </div>
        </div>
      </Card>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/40 bg-danger-weak px-4 py-3 text-sm font-medium text-danger-strong">
          <Warning weight="fill" className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" size="lg" loading={pending}>
          Guardar y continuar
        </Button>
      </div>
    </form>
  );
}
