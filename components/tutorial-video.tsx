"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle, X, CaretRight } from "@phosphor-icons/react";
import { markTutorialSeen } from "@/lib/actions/tutorial";

/**
 * El video tutorial de la plataforma, en la pantalla de inicio.
 *
 * Se abre SOLO la primera vez que la cuenta entra (`autoOpen`), y de ahí en adelante
 * queda como una tarjeta a la que se puede volver cuando se quiera: el tutorial que
 * solo aparece una vez y no se puede recuperar es el que nadie alcanza a ver.
 *
 * Al abrirse por primera vez se marca como visto de inmediato, sin esperar a que el
 * video termine: si la persona lo cierra a los diez segundos, esa fue su decisión y
 * volvérselo a aventar en cada ingreso sería castigarla por ella.
 */
export function TutorialVideo({
  src,
  title,
  description,
  autoOpen = false,
}: {
  /** Ruta del .mp4 dentro de /public. */
  src: string;
  title: string;
  description: string;
  /** Primera vez de esta cuenta: el video se abre solo. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const marked = useRef(false);

  // Visto = lo abrió. Se marca una vez por sesión de pantalla, no en cada apertura.
  useEffect(() => {
    if (!open || marked.current || !autoOpen) return;
    marked.current = true;
    void markTutorialSeen();
  }, [open, autoOpen]);

  // Escape cierra, y mientras está abierto la página de atrás no se desplaza.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [open]);

  function abrir() {
    if (!marked.current) {
      marked.current = true;
      void markTutorialSeen();
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="group flex w-full items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-primary"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-weak text-primary-strong">
          <PlayCircle weight="fill" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">{title}</span>
          <span className="block text-sm text-muted">{description}</span>
        </span>
        <CaretRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            aria-label="Cerrar el tutorial"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
          />
          <div
            ref={dialogRef}
            className="relative w-full max-w-3xl overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{title}</p>
                <p className="truncate text-xs text-muted">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <video
              src={src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="max-h-[70vh] w-full bg-black"
            />
            <div className="flex justify-end border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
