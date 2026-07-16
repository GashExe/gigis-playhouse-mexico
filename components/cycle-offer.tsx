"use client";

import { useState, useTransition } from "react";
import { CaretDown, Check, Warning } from "@phosphor-icons/react";
import { setProgramInCycle } from "@/lib/actions/programs";
import { Card } from "@/components/ui/card";

type P = {
  id: string;
  name: string;
  area: string | null;
  color: string | null;
  offered: boolean;
  enrollments: number;
};

/**
 * La oferta del ciclo: qué programas corren en él. La directora los elige de los que
 * ya existen (ej. que en Sep–Dic solo corran 7). Solo ella lo ve.
 */
export function CycleOffer({
  cycleId,
  cycleLabel,
  programs,
}: {
  cycleId: string;
  cycleLabel: string;
  programs: P[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const enOferta = programs.filter((p) => p.offered).length;

  function toggle(p: P) {
    startTransition(() => {
      setProgramInCycle(p.id, cycleId, !p.offered);
    });
  }

  return (
    <Card className="mb-5 p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Oferta de {cycleLabel}</p>
          <p className="text-xs text-muted">
            {enOferta} de {programs.length} programas corren en este ciclo. Elige cuáles.
          </p>
        </div>
        <CaretDown
          weight="bold"
          className={`size-4 shrink-0 text-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="border-t border-border p-3 sm:p-4"
          data-pending={pending ? "" : undefined}
        >
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {programs.map((p) => (
              <li key={p.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-input)] border px-3 py-2 transition-colors ${
                    p.offered
                      ? "border-border-strong bg-surface"
                      : "border-border bg-surface-2/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={p.offered}
                    onChange={() => toggle(p)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                      p.offered
                        ? "border-primary bg-primary text-surface"
                        : "border-border-strong bg-surface"
                    }`}
                  >
                    {p.offered && <Check weight="bold" className="size-3" />}
                  </span>
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: p.color ?? "var(--border-strong)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${p.offered ? "text-ink" : "text-muted"}`}
                    >
                      {p.name}
                    </span>
                    {p.area && (
                      <span className="block truncate text-xs text-subtle">{p.area}</span>
                    )}
                  </span>
                  {/* Quitarlo no borra nada, pero deja inscritos fuera de la oferta. */}
                  {p.offered && p.enrollments > 0 && (
                    <span
                      title={`${p.enrollments} inscritos en este ciclo`}
                      className="flex shrink-0 items-center gap-1 text-xs font-bold text-subtle"
                    >
                      <span className="tnum">{p.enrollments}</span>
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted">
            <Warning className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Quitar un programa de la oferta no borra nada: sus inscripciones,
              calificaciones y plantilla siguen ahí. Solo deja de poder inscribirse en
              este ciclo.
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
