"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Plus,
  Books,
  PencilSimple,
  X,
  Eye,
  EyeSlash,
  UsersThree,
  Star,
} from "@phosphor-icons/react";
import {
  createProgram,
  updateProgram,
  toggleProgram,
  type ProgramFormState,
} from "@/lib/actions/programs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Program = {
  id: string;
  name: string;
  description: string | null;
  area: string | null;
  color: string | null;
  active: boolean;
  _count: { enrollments: number; evaluations: number };
};

const SWATCHES = [
  "#E4572E", "#2E86AB", "#8AA624", "#C05299", "#F2A541",
  "#3E7C59", "#6C63FF", "#0EAD9C", "#D7263D", "#B5651D",
];

export function ProgramsManager({ programs }: { programs: Program[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {!creating && !editingId && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus weight="bold" className="size-4" />
            Nuevo programa
          </Button>
        </div>
      )}

      {creating && (
        <ProgramForm
          action={createProgram}
          onClose={() => setCreating(false)}
          title="Nuevo programa"
        />
      )}

      {programs.length === 0 && !creating ? (
        <EmptyState
          icon={<Books weight="fill" className="size-6" />}
          title="Aún no hay programas"
          description="Crea el primer programa para poder inscribir participantes."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus weight="bold" className="size-4" />
              Nuevo programa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="sm:col-span-2">
                <ProgramForm
                  action={updateProgram.bind(null, p.id)}
                  onClose={() => setEditingId(null)}
                  title={`Editar “${p.name}”`}
                  defaults={p}
                />
              </div>
            ) : (
              <ProgramCard key={p.id} program={p} onEdit={() => setEditingId(p.id)} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ProgramCard({
  program: p,
  onEdit,
}: {
  program: Program;
  onEdit: () => void;
}) {
  const color = p.color ?? "var(--primary)";
  return (
    <Card className={`flex flex-col p-5 ${!p.active ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-[var(--radius-control)]"
          style={{ backgroundColor: color + "22", color }}
        >
          <Books weight="fill" className="size-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {!p.active && <Badge tone="neutral">Inactivo</Badge>}
          {p.area && p.active && <Badge tone="neutral">{p.area}</Badge>}
        </div>
      </div>

      <h3 className="mt-3 font-bold text-ink">{p.name}</h3>
      {p.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
          {p.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <UsersThree className="size-4" />
          <span className="tnum font-semibold text-ink">{p._count.enrollments}</span> activos
        </span>
        <span className="flex items-center gap-1.5">
          <Star className="size-4" />
          <span className="tnum font-semibold text-ink">{p._count.evaluations}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <form action={toggleProgram.bind(null, p.id, !p.active)}>
            <button
              type="submit"
              aria-label={p.active ? "Desactivar programa" : "Activar programa"}
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {p.active ? <EyeSlash className="size-[1.05rem]" /> : <Eye className="size-[1.05rem]" />}
            </button>
          </form>
          <button
            onClick={onEdit}
            aria-label="Editar programa"
            className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <PencilSimple className="size-[1.05rem]" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function ProgramForm({
  action,
  onClose,
  title,
  defaults,
}: {
  action: (prev: ProgramFormState, fd: FormData) => Promise<ProgramFormState>;
  onClose: () => void;
  title: string;
  defaults?: Partial<Program>;
}) {
  const [state, formAction, pending] = useActionState<ProgramFormState, FormData>(
    action,
    undefined,
  );
  const [color, setColor] = useState(defaults?.color ?? SWATCHES[0]);
  const err = state?.errors ?? {};

  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok]);

  return (
    <Card className="p-5 sm:p-6">
      <form action={formAction} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" required error={err.name?.[0]}>
            <Input id="name" name="name" defaultValue={defaults?.name} required autoFocus />
          </Field>
          <Field label="Área" htmlFor="area" hint="Ej. Comunicación, Motor, Cognición.">
            <Input id="area" name="area" defaultValue={defaults?.area ?? ""} />
          </Field>
        </div>

        <Field label="Descripción" htmlFor="description">
          <Textarea id="description" name="description" rows={2} defaultValue={defaults?.description ?? ""} />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Color</span>
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`size-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform ${
                  color === c ? "scale-110 ring-ink" : "ring-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {defaults ? "Guardar cambios" : "Crear programa"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
