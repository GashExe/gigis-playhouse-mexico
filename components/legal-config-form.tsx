"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  Scroll,
  WarningCircle,
  CheckCircle,
  FloppyDisk,
} from "@phosphor-icons/react";
import { updateLegalConfig } from "@/lib/actions/legal";
import { fecha } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

export function LegalConfigForm({
  avisoPrivacidad,
  reglamento,
  version,
  updatedAt,
}: {
  avisoPrivacidad: string;
  reglamento: string;
  version: string;
  updatedAt: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ version: string; sinCambios: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const formAction = (fd: FormData) =>
    startTransition(async () => {
      const res = await updateLegalConfig(undefined, fd);
      if (res?.error) {
        setError(res.error);
        setSaved(null);
        return;
      }
      setError(null);
      setSaved({ version: res?.version ?? version, sinCambios: !!res?.sinCambios });
    });

  return (
    <form action={formAction} className="space-y-5">
      {/* Aviso: qué implica guardar */}
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-weak px-4 py-3">
        <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-warning-strong" />
        <p className="text-sm leading-relaxed text-ink">
          Si cambias cualquiera de los textos, la plataforma les pedirá a{" "}
          <strong>todas las familias</strong> aceptar de nuevo el aviso y el reglamento
          la próxima vez que entren. Si solo entras a leer, no pasa nada hasta que guardes.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldCheck weight="fill" className="size-4 text-primary" />
          Aviso de privacidad
        </h2>
        <p className="mt-1 text-xs text-muted">
          Cómo se tratan y protegen los datos del participante y su tutor. Lo acepta la
          familia en su primer ingreso.
        </p>
        <Field className="mt-3" htmlFor="avisoPrivacidad" label="Texto del aviso" required>
          <Textarea
            id="avisoPrivacidad"
            name="avisoPrivacidad"
            defaultValue={avisoPrivacidad}
            rows={14}
            required
            className="font-mono text-[0.8125rem]"
          />
        </Field>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Scroll weight="fill" className="size-4 text-primary" />
          Reglamento
        </h2>
        <p className="mt-1 text-xs text-muted">
          Las reglas de convivencia y participación en la playhouse. También se acepta en
          el primer ingreso.
        </p>
        <Field className="mt-3" htmlFor="reglamento" label="Texto del reglamento" required>
          <Textarea
            id="reglamento"
            name="reglamento"
            defaultValue={reglamento}
            rows={14}
            required
            className="font-mono text-[0.8125rem]"
          />
        </Field>
      </Card>

      {error && (
        <p className="flex items-center gap-2 text-sm font-medium text-danger-strong">
          <WarningCircle weight="fill" className="size-4" />
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 text-sm font-medium text-success-strong">
          <CheckCircle weight="fill" className="size-4" />
          {saved.sinCambios
            ? "No había cambios que guardar; los textos quedan igual."
            : `Guardado. Nueva versión ${saved.version}: las familias deberán aceptar de nuevo.`}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          Versión vigente:{" "}
          <span className="font-mono font-semibold text-subtle">
            {saved?.version ?? version}
          </span>{" "}
          · Última edición {fecha(updatedAt)}
        </p>
        <Button type="submit" loading={pending} className="sm:w-auto">
          <FloppyDisk weight="fill" className="size-4" />
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
