"use client";

import { useState, useTransition } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { setStudentStatus } from "@/lib/actions/students";
import type { StudentStatus } from "@/lib/generated/prisma/client";

const OPTIONS: { value: StudentStatus; label: string; dot: string }[] = [
  { value: "ACTIVO", label: "Activo", dot: "#1D9E75" },
  { value: "INACTIVO", label: "Inactivo", dot: "var(--border-strong)" },
  { value: "EGRESADO", label: "Egresado", dot: "#EF9F27" },
];

/**
 * Cambia el estado del participante desde su expediente, sin abrir el formulario.
 * Antes solo se podía dentro de "Editar", donde nadie lo encontraba: en el
 * expediente el estado era una etiqueta de lectura.
 */
export function StudentStatusControl({
  studentId,
  status,
}: {
  studentId: string;
  status: StudentStatus;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = OPTIONS.find((o) => o.value === status) ?? OPTIONS[0];

  function pick(value: StudentStatus) {
    setOpen(false);
    if (value === status) return;
    startTransition(() => {
      setStudentStatus(studentId, value);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Estado: ${current.label}. Cambiar`}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2.5 text-xs font-bold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: current.dot }}
        />
        {current.label}
        <CaretDown weight="bold" className="size-3 text-subtle" />
      </button>

      {open && (
        <>
          {/* Capa para cerrar al hacer clic fuera. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute left-0 top-full z-20 mt-1.5 min-w-40 overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface py-1 shadow-lg"
          >
            {OPTIONS.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === status}
                  onClick={() => pick(o.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: o.dot }}
                  />
                  {o.label}
                  {o.value === status && (
                    <Check weight="bold" className="ml-auto size-3.5 text-primary" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
