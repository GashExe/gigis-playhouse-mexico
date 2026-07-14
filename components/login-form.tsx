"use client";

import { useActionState } from "react";
import { Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { login, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3 py-2.5 text-sm font-medium text-danger-strong"
        >
          <Warning weight="fill" className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@gigisplayhouse.mx"
          required
          autoFocus
        />
      </Field>

      <Field label="Contraseña" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-subtle transition-colors hover:text-ink"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeSlash className="size-[1.15rem]" /> : <Eye className="size-[1.15rem]" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
