"use client";

import { useState } from "react";
import { PencilSimple, Trash, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { deleteStudent } from "@/lib/actions/students";

export function StudentActions({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button href={`/estudiantes/${studentId}/editar`} variant="secondary" size="sm">
        <PencilSimple weight="bold" className="size-4" />
        Editar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-muted hover:bg-danger-weak hover:text-danger-strong"
      >
        <Trash className="size-4" />
      </Button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          />
          <div className="relative w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
            <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger-weak text-danger-strong">
              <Warning weight="fill" className="size-5" />
            </div>
            <h2 className="text-lg font-extrabold text-ink">Eliminar participante</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Vas a eliminar a <span className="font-semibold text-ink">{studentName}</span> y
              todo su historial de inscripciones y evaluaciones. Esta acción no se puede
              deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <form action={deleteStudent.bind(null, studentId)}>
                <Button type="submit" variant="danger">
                  Sí, eliminar
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
