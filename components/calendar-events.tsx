"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, Briefcase, X } from "@phosphor-icons/react";
import {
  saveCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/actions/calendar-events";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

/**
 * Eventos internos del calendario: juntas, capacitaciones, visitas, eventos de
 * recaudación. Los capturan dirección y coordinación y solo los ve el equipo;
 * por eso viven aquí y no en los avisos de las familias.
 */

export type CalendarEventItem = {
  id: string;
  title: string;
  /** Clave "YYYY-MM-DD" del día del evento. */
  dateKey: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  color: string | null;
  authorName: string | null;
};

const DEFAULT_COLOR = "#6b7280";

/** Botón de la barra del calendario para capturar un evento nuevo. */
export function NewEventButton({ defaultDateKey }: { defaultDateKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Plus weight="bold" className="size-3.5" />
        Evento interno
      </button>
      {open && (
        <EventDialog
          defaultDateKey={defaultDateKey}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Tarjetita del evento dentro del día. Dirección y coordinación la tocan para
 * editar; la maestra solo la lee (el detalle le sale como tooltip).
 */
export function EventChip({
  event,
  canEdit,
}: {
  event: CalendarEventItem;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const color = event.color ?? DEFAULT_COLOR;

  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-subtle">
        <Briefcase weight="fill" className="size-3" />
        Interno
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-ink">{event.title}</p>
      {event.startTime && (
        <p className="tnum mt-0.5 text-xs font-semibold" style={{ color }}>
          {event.startTime}
          {event.endTime ? `–${event.endTime}` : ""}
        </p>
      )}
    </>
  );

  const base =
    "block w-full rounded-[var(--radius-control)] border border-dashed border-border bg-surface-2/60 p-2.5 text-left";
  const style = { borderLeft: `4px solid ${color}` };

  if (!canEdit) {
    return (
      <div className={base} style={style} title={event.notes ?? undefined}>
        {body}
        {event.notes && (
          <p className="mt-1 line-clamp-2 text-[0.7rem] text-muted">{event.notes}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} transition-colors hover:border-border-strong hover:bg-surface`}
        style={style}
      >
        {body}
      </button>
      {open && <EventDialog event={event} onClose={() => setOpen(false)} />}
    </>
  );
}

function EventDialog({
  event,
  defaultDateKey,
  onClose,
}: {
  event?: CalendarEventItem;
  defaultDateKey?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape cierra: el diálogo tapa el calendario y hay que poder salir sin mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const formAction = (fd: FormData) =>
    startTransition(async () => {
      const result = await saveCalendarEvent(undefined, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!event) return;
      await deleteCalendarEvent(event.id);
      onClose();
      router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={event ? "Editar evento" : "Nuevo evento interno"}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
              <Briefcase weight="fill" className="size-4 text-primary" />
              {event ? "Editar evento" : "Nuevo evento interno"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Solo lo ve el equipo. Las familias no lo verán en Mi espacio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-3">
          {event && <input type="hidden" name="id" value={event.id} />}
          <Field label="Nombre del evento" htmlFor="ev-title" required>
            <Input
              id="ev-title"
              name="title"
              required
              autoFocus
              defaultValue={event?.title}
              placeholder="Ej. Junta de equipo"
            />
          </Field>
          <Field label="Fecha" htmlFor="ev-date" required>
            <Input
              id="ev-date"
              name="date"
              type="date"
              required
              defaultValue={event?.dateKey ?? defaultDateKey}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="ev-start" hint="Opcional">
              <Input
                id="ev-start"
                name="startTime"
                type="time"
                defaultValue={event?.startTime ?? ""}
              />
            </Field>
            <Field label="Hasta" htmlFor="ev-end" hint="Opcional">
              <Input
                id="ev-end"
                name="endTime"
                type="time"
                defaultValue={event?.endTime ?? ""}
              />
            </Field>
          </div>
          <Field label="Detalle" htmlFor="ev-notes" hint="Lugar, quién asiste, qué llevar…">
            <Textarea
              id="ev-notes"
              name="notes"
              rows={3}
              defaultValue={event?.notes ?? ""}
            />
          </Field>
          <Field label="Color" htmlFor="ev-color">
            <input
              id="ev-color"
              name="color"
              type="color"
              defaultValue={event?.color ?? DEFAULT_COLOR}
              className="h-10 w-20 cursor-pointer rounded-[var(--radius-input)] border border-border-strong bg-surface p-1"
            />
          </Field>

          {error && <p className="text-xs font-medium text-danger-strong">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {event ? (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong disabled:opacity-50"
              >
                <Trash className="size-4" />
                Borrar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {event ? "Guardar" : "Agregar"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
