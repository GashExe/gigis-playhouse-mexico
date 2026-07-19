"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeSlash, Warning, CheckCircle, LockKey } from "@phosphor-icons/react";
import { changeOwnPassword, type PasswordState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/**
 * Cambio de contraseña de la propia familia, desde Mi espacio. Confirma la actual y
 * pide la nueva dos veces. Así dirección deja de ser el cuello de botella para esto.
 */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changeOwnPassword,
    undefined,
  );
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Al cambiarla con éxito, limpia los campos.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  const err = state?.errors;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <LockKey weight="fill" className="size-5 text-primary" />
        <h2 className="text-base font-extrabold tracking-tight text-ink">Mi cuenta</h2>
      </div>

      <form
        ref={formRef}
        action={action}
        noValidate
        className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
      >
        <p className="text-sm text-muted">
          Cambia tu contraseña cuando quieras. Necesitas la actual para confirmarlo.
        </p>

        {state?.ok && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-[var(--radius-input)] border border-success/30 bg-success-weak px-3 py-2.5 text-sm font-medium text-success-strong"
          >
            <CheckCircle weight="fill" className="size-4 shrink-0" />
            Tu contraseña se cambió. Úsala la próxima vez que entres.
          </div>
        )}

        <Field label="Contraseña actual" htmlFor="current" error={err?.current?.[0]}>
          <Input
            id="current"
            name="current"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </Field>

        <Field
          label="Nueva contraseña"
          htmlFor="next"
          error={err?.next?.[0]}
          hint="Al menos 8 caracteres."
        >
          <div className="relative">
            <Input
              id="next"
              name="next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-subtle transition-colors hover:text-ink"
              aria-label={show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
            >
              {show ? <EyeSlash className="size-[1.15rem]" /> : <Eye className="size-[1.15rem]" />}
            </button>
          </div>
        </Field>

        <Field label="Repite la nueva contraseña" htmlFor="confirm" error={err?.confirm?.[0]}>
          <Input
            id="confirm"
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>

        {err && !err.current && !err.next && !err.confirm && (
          <p className="flex items-center gap-2 text-sm font-medium text-danger-strong">
            <Warning weight="fill" className="size-4 shrink-0" />
            No se pudo cambiar. Revisa los datos.
          </p>
        )}

        <Button type="submit" loading={pending}>
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </section>
  );
}
