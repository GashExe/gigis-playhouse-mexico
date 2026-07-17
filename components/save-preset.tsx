"use client";

import { useState, useTransition } from "react";
import { BookmarkSimple, X } from "@phosphor-icons/react";
import { saveAsPreset } from "@/lib/actions/programs";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Guarda la plantilla de este programa en la biblioteca, para partir de ella al crear
 * otros. Es la única forma de llenar la biblioteca: sin esto nace vacía.
 */
export function SavePreset({
  programId,
  programName,
  empty,
}: {
  programId: string;
  programName: string;
  empty: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const action = saveAsPreset.bind(null, programId);

  if (empty) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <BookmarkSimple weight="bold" className="size-4" />
        Guardar como plantilla base
      </button>
    );
  }

  return (
    <Card className="w-full p-4">
      <form
        action={(fd) => {
          startTransition(async () => {
            await action(fd);
            setOpen(false);
          });
        }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Guardar como plantilla base</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Copia la estructura de {programName} a la biblioteca. Es una copia: editarla
          después no toca este programa.
        </p>
        <Field label="Nombre" htmlFor="preset-name" required>
          <Input
            id="preset-name"
            name="name"
            required
            autoFocus
            defaultValue={`Formato de ${programName}`}
          />
        </Field>
        <Field label="Para qué sirve (opcional)" htmlFor="preset-description">
          <Textarea id="preset-description" name="description" rows={2} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar en la biblioteca"}
        </Button>
      </form>
    </Card>
  );
}
