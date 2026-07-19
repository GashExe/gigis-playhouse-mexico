"use client";

import { useState, useTransition } from "react";
import { ArrowsClockwise, CheckCircle, Warning } from "@phosphor-icons/react";
import { resetStudentPassword } from "@/lib/actions/users";

/**
 * Botón de dirección para reponer la contraseña de un participante que la olvidó.
 * Genera una nueva y la muestra al momento para entregarla a la familia. La familia
 * puede cambiarla luego desde Mi espacio.
 */
export function ResetPasswordButton({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function reset() {
    setError(false);
    startTransition(async () => {
      const res = await resetStudentPassword(studentId);
      if (res.ok) {
        setNewPassword(res.password);
        setConfirming(false);
      } else {
        setError(true);
      }
    });
  }

  if (newPassword) {
    return (
      <div className="mt-3 rounded-[var(--radius-input)] border border-success/30 bg-success-weak/60 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-success-strong">
          <CheckCircle weight="fill" className="size-4" />
          Nueva contraseña generada
        </p>
        <p className="mt-1.5 select-all font-mono text-sm font-semibold text-ink">
          {newPassword}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Compártela con la familia. Es la nueva contraseña de acceso; la familia puede
          cambiarla después desde su espacio.
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="mt-3 rounded-[var(--radius-input)] border border-border bg-surface-2/60 p-3">
        <p className="text-xs leading-relaxed text-muted">
          Se generará una contraseña nueva y la actual dejará de funcionar. ¿Continuar?
        </p>
        {error && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger-strong">
            <Warning weight="fill" className="size-3.5" />
            No se pudo reponer. Intenta de nuevo.
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="rounded-[var(--radius-input)] bg-primary px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
          >
            {pending ? "Generando…" : "Sí, reponer"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-[var(--radius-input)] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
    >
      <ArrowsClockwise weight="bold" className="size-3.5" />
      Reponer contraseña
    </button>
  );
}
