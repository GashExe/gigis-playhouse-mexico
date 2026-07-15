"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Plus,
  X,
  PencilSimple,
  UserCircleMinus,
  UserCirclePlus,
} from "@phosphor-icons/react";
import {
  createUser,
  updateUser,
  toggleUserActive,
  type UserFormState,
} from "@/lib/actions/users";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { fecha } from "@/lib/format";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/generated/prisma/client";

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
  _count: { evaluations: number };
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus weight="bold" className="size-4" />
            Nueva cuenta
          </Button>
        )}
      </div>

      {creating && (
        <UserForm
          action={createUser}
          onClose={() => setCreating(false)}
          title="Nueva cuenta"
        />
      )}

      <Card className="overflow-visible p-0">
        <ul className="divide-y divide-border">
          {users.map((u) =>
            editingId === u.id ? (
              <li key={u.id} className="p-4">
                <UserForm
                  action={updateUser.bind(null, u.id)}
                  onClose={() => setEditingId(null)}
                  title={`Editar cuenta de ${u.name.split(" ")[0]}`}
                  defaults={u}
                  isEdit
                />
              </li>
            ) : (
              <li
                key={u.id}
                className={`flex items-center gap-4 px-4 py-3.5 sm:px-5 ${
                  !u.active ? "opacity-60" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-weak text-sm font-bold text-primary-strong"
                >
                  {initials(u.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-ink">{u.name}</p>
                    <Badge tone={u.role === "DIRECTORA" ? "accent" : "primary"}>
                      {u.role === "DIRECTORA" ? "Directora" : "Maestra"}
                    </Badge>
                    {!u.active && <Badge tone="neutral">Desactivada</Badge>}
                    {u.id === currentUserId && <Badge tone="neutral">Tú</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted">
                    <span className="font-medium text-ink">@{u.username}</span>
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted sm:block">
                  <p className="tnum font-semibold text-ink">{u._count.evaluations}</p>
                  <p>evaluaciones</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(u.id)}
                    aria-label="Editar cuenta"
                    className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <PencilSimple className="size-[1.05rem]" />
                  </button>
                  {u.id !== currentUserId && (
                    <form action={toggleUserActive.bind(null, u.id, !u.active)}>
                      <button
                        type="submit"
                        aria-label={u.active ? "Desactivar cuenta" : "Reactivar cuenta"}
                        className={`flex size-8 items-center justify-center rounded-[var(--radius-input)] transition-colors ${
                          u.active
                            ? "text-subtle hover:bg-danger-weak hover:text-danger-strong"
                            : "text-subtle hover:bg-success-weak hover:text-success-strong"
                        }`}
                      >
                        {u.active ? (
                          <UserCircleMinus className="size-[1.15rem]" />
                        ) : (
                          <UserCirclePlus className="size-[1.15rem]" />
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      </Card>
    </div>
  );
}

function UserForm({
  action,
  onClose,
  title,
  defaults,
  isEdit,
}: {
  action: (prev: UserFormState, fd: FormData) => Promise<UserFormState>;
  onClose: () => void;
  title: string;
  defaults?: Partial<UserRow>;
  isEdit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    action,
    undefined,
  );
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
          <Field label="Nombre completo" htmlFor="name" required error={err.name?.[0]}>
            <Input id="name" name="name" defaultValue={defaults?.name} required autoFocus />
          </Field>
          <Field
            label="Usuario"
            htmlFor="username"
            required
            error={err.username?.[0]}
            hint="Con lo que inicia sesión. Solo letras, números y . _ -"
          >
            <Input
              id="username"
              name="username"
              defaultValue={defaults?.username}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ej. maria"
              required
            />
          </Field>
          <Field label="Correo electrónico" htmlFor="email" error={err.email?.[0]} hint="Opcional.">
            <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} />
          </Field>
          <Field label="Rol" htmlFor="role">
            <Select id="role" name="role" defaultValue={defaults?.role ?? "MAESTRA"}>
              <option value="MAESTRA">Maestra</option>
              <option value="DIRECTORA">Directora</option>
            </Select>
          </Field>
          <Field
            label={isEdit ? "Nueva contraseña" : "Contraseña inicial"}
            htmlFor="password"
            required={!isEdit}
            error={err.password?.[0]}
            hint={isEdit ? "Déjalo vacío para no cambiarla." : "Mínimo 8 caracteres."}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={isEdit ? "••••••••" : ""}
              required={!isEdit}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {isEdit ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
