"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/card";

type Defaults = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  notes?: string;
  status?: string;
  matricula?: string;
};

export function StudentForm({
  action,
  defaults = {},
  submitLabel = "Guardar participante",
  cancelHref = "/estudiantes",
  showMatricula = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel?: string;
  cancelHref?: string;
  showMatricula?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-ink">Datos del participante</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre(s)" htmlFor="firstName" required error={err.firstName?.[0]}>
            <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required autoFocus />
          </Field>
          <Field label="Apellidos" htmlFor="lastName" required error={err.lastName?.[0]}>
            <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="birthDate" error={err.birthDate?.[0]}>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} />
          </Field>
          <Field label="Género" htmlFor="gender">
            <Select id="gender" name="gender" defaultValue={defaults.gender ?? ""}>
              <option value="">Sin especificar</option>
              <option value="FEMENINO">Femenino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OTRO">Otro</option>
            </Select>
          </Field>
          <Field label="Estatus" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaults.status ?? "ACTIVO"}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="EGRESADO">Egresado</option>
            </Select>
          </Field>
          {showMatricula && (
            <Field
              label="Matrícula (opcional)"
              htmlFor="matricula"
              hint="Se usará como usuario. Si la dejas vacía, se genera del nombre."
            >
              <Input id="matricula" name="matricula" defaultValue={defaults.matricula} placeholder="00123456" />
            </Field>
          )}
        </div>
      </Card>
      {showMatricula && (
        <div className="rounded-[var(--radius-control)] border border-border bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-muted">
          Al guardar se crea automáticamente su <strong className="text-ink">usuario y contraseña</strong> de
          acceso. Los verás en su expediente para entregárselos a la familia.
        </div>
      )}

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-ink">Tutor / familiar responsable</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del tutor" htmlFor="guardianName">
            <Input id="guardianName" name="guardianName" defaultValue={defaults.guardianName} />
          </Field>
          <Field label="Teléfono" htmlFor="guardianPhone">
            <Input id="guardianPhone" name="guardianPhone" inputMode="tel" defaultValue={defaults.guardianPhone} placeholder="55 1234 5678" />
          </Field>
          <Field label="Correo del tutor" htmlFor="guardianEmail" error={err.guardianEmail?.[0]}>
            <Input id="guardianEmail" name="guardianEmail" type="email" defaultValue={defaults.guardianEmail} />
          </Field>
          <Field label="Dirección" htmlFor="address">
            <Input id="address" name="address" defaultValue={defaults.address} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <Field label="Notas y observaciones" htmlFor="notes" hint="Intereses, apoyos, información relevante para el equipo.">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes} rows={4} />
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button href={cancelHref} variant="secondary">
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
