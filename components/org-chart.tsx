"use client";

import { useActionState, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  PencilSimple,
  Plus,
  TreeStructure,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import {
  createOrgNode,
  deleteOrgNode,
  moveOrgNode,
  seedOrgFromAccounts,
  updateOrgNode,
  type OrgFormState,
} from "@/lib/actions/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { roleLabel } from "@/lib/utils";
import { roleWithCoordination } from "@/lib/roles";
import type { Coordination, Role } from "@/lib/generated/prisma/client";

export type OrgNodeItem = {
  id: string;
  name: string;
  title: string | null;
  notes: string | null;
  parentId: string | null;
  order: number;
  user: {
    id: string;
    name: string;
    role: Role;
    coordination: Coordination | null;
    active: boolean;
  } | null;
  programs: { id: string; name: string; color: string | null }[];
  children: OrgNodeItem[];
};

type Account = { id: string; name: string; role: Role };
type FlatNode = { id: string; name: string; title: string | null };

/**
 * El organigrama de la casa. Se arma a mano —hay gente sin cuenta en la
 * plataforma— pero las cajas ligadas a una cuenta muestran su rol y los programas
 * que da, sacados de la plataforma para que no haya que mantenerlos dos veces.
 */
export function OrgChart({
  tree,
  flat,
  accounts,
  canEdit,
}: {
  tree: OrgNodeItem[];
  flat: FlatNode[];
  accounts: Account[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState<string | null | false>(false);

  if (tree.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={<TreeStructure weight="fill" className="size-6" />}
          title="Todavía no hay organigrama"
          description="Puedes armarlo desde cero, o partir de las cuentas activas y acomodarlo a tu gusto."
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-2">
                <SeedButton />
                <Button variant="secondary" size="sm" onClick={() => setAdding(null)}>
                  <Plus weight="bold" className="size-4" />
                  Empezar de cero
                </Button>
              </div>
            ) : undefined
          }
        />
        {adding !== false && (
          <div className="mt-4">
            <NodeForm
              parentId={null}
              flat={flat}
              accounts={accounts}
              onDone={() => setAdding(false)}
            />
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAdding(null)}>
            <Plus weight="bold" className="size-4" />
            Agregar hasta arriba
          </Button>
        </div>
      )}
      {adding === null && (
        <NodeForm
          parentId={null}
          flat={flat}
          accounts={accounts}
          onDone={() => setAdding(false)}
        />
      )}
      <ul className="space-y-2">
        {tree.map((n) => (
          <NodeRow key={n.id} node={n} flat={flat} accounts={accounts} canEdit={canEdit} />
        ))}
      </ul>
    </div>
  );
}

function NodeRow({
  node,
  flat,
  accounts,
  canEdit,
  depth = 0,
}: {
  node: OrgNodeItem;
  flat: FlatNode[];
  accounts: Account[];
  canEdit: boolean;
  depth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  return (
    <li>
      <div
        className="rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-sm)]"
        style={{ marginLeft: depth > 0 ? "0.25rem" : undefined }}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">
              {node.name}
              {node.user && !node.user.active && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-muted">
                  Cuenta desactivada
                </span>
              )}
            </p>
            <p className="text-sm text-muted">
              {node.title ??
                (node.user
                  ? roleWithCoordination(
                      node.user.role,
                      node.user.coordination,
                      roleLabel(node.user.role),
                    )
                  : "")}
            </p>
            {node.notes && <p className="mt-0.5 text-xs text-subtle">{node.notes}</p>}
            {node.programs.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {node.programs.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-muted"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: p.color ?? "var(--primary)" }}
                    />
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-1">
              <IconAction action={moveOrgNode.bind(null, node.id, "arriba")} label="Subir">
                <ArrowUp className="size-4" />
              </IconAction>
              <IconAction action={moveOrgNode.bind(null, node.id, "abajo")} label="Bajar">
                <ArrowDown className="size-4" />
              </IconAction>
              <button
                onClick={() => setAddingChild((v) => !v)}
                aria-label="Agregar debajo"
                className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-4" />
              </button>
              <button
                onClick={() => setEditing((v) => !v)}
                aria-label="Editar"
                className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <PencilSimple className="size-4" />
              </button>
              {/* Al borrar, su gente sube un nivel: nadie desaparece con la caja. */}
              <IconAction action={deleteOrgNode.bind(null, node.id)} label="Quitar" danger>
                <Trash className="size-4" />
              </IconAction>
            </div>
          )}
        </div>

        {editing && (
          <div className="mt-3 border-t border-border pt-3">
            <NodeForm
              node={node}
              parentId={node.parentId}
              flat={flat.filter((f) => f.id !== node.id)}
              accounts={accounts}
              onDone={() => setEditing(false)}
            />
          </div>
        )}
      </div>

      {addingChild && (
        <div className="ml-4 mt-2 border-l-2 border-border pl-4">
          <NodeForm
            parentId={node.id}
            flat={flat}
            accounts={accounts}
            onDone={() => setAddingChild(false)}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-4">
          {node.children.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              flat={flat}
              accounts={accounts}
              canEdit={canEdit}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NodeForm({
  node,
  parentId,
  flat,
  accounts,
  onDone,
}: {
  node?: OrgNodeItem;
  parentId: string | null;
  flat: FlatNode[];
  accounts: Account[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    async (prev, fd) => {
      const result = node
        ? await updateOrgNode(node.id, prev, fd)
        : await createOrgNode(prev, fd);
      if (result?.ok) onDone();
      return result;
    },
    undefined,
  );

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-[var(--radius-control)] bg-surface-2/60 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor={`name-${node?.id ?? "nuevo"}`}>
          <Input
            id={`name-${node?.id ?? "nuevo"}`}
            name="name"
            defaultValue={node?.name ?? ""}
            placeholder="Ej. Patronato"
            required
          />
        </Field>
        <Field label="Cargo" htmlFor={`title-${node?.id ?? "nuevo"}`}>
          <Input
            id={`title-${node?.id ?? "nuevo"}`}
            name="title"
            defaultValue={node?.title ?? ""}
            placeholder="Ej. Coordinación de lenguaje"
          />
        </Field>
        <Field
          label="Depende de"
          htmlFor={`parent-${node?.id ?? "nuevo"}`}
          hint="Vacío = va hasta arriba."
        >
          <Select
            id={`parent-${node?.id ?? "nuevo"}`}
            name="parentId"
            defaultValue={parentId ?? ""}
          >
            <option value="">Nadie (hasta arriba)</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.title ? ` — ${f.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Cuenta de la plataforma"
          htmlFor={`user-${node?.id ?? "nuevo"}`}
          hint="Opcional: si la tiene, la caja muestra su rol y sus programas."
        >
          <Select
            id={`user-${node?.id ?? "nuevo"}`}
            name="userId"
            defaultValue={node?.user?.id ?? ""}
          >
            <option value="">Sin cuenta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {roleLabel(a.role)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Nota" htmlFor={`notes-${node?.id ?? "nuevo"}`}>
        <Input
          id={`notes-${node?.id ?? "nuevo"}`}
          name="notes"
          defaultValue={node?.notes ?? ""}
          placeholder="Opcional"
        />
      </Field>

      {state?.error && (
        <p className="flex items-start gap-1.5 text-sm font-semibold text-danger-strong">
          <Warning weight="fill" className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          {node ? "Guardar" : "Agregar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function SeedButton() {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    async (prev) => seedOrgFromAccounts(),
    undefined,
  );
  return (
    <form action={formAction}>
      <Button type="submit" size="sm" loading={pending}>
        <TreeStructure weight="bold" className="size-4" />
        Armarlo con las cuentas activas
      </Button>
      {state?.error && (
        <p className="mt-2 text-sm font-semibold text-danger-strong">{state.error}</p>
      )}
    </form>
  );
}

function IconAction({
  action,
  label,
  danger,
  children,
}: {
  action: () => Promise<void>;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`flex size-8 items-center justify-center rounded-[var(--radius-input)] transition-colors ${
          danger
            ? "text-subtle hover:bg-danger-weak hover:text-danger-strong"
            : "text-subtle hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
