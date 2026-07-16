"use client";

import { useState } from "react";
import {
  Plus,
  PencilSimple,
  Trash,
  Copy,
  CaretUp,
  CaretDown,
  Stack,
  Check,
  X,
} from "@phosphor-icons/react";
import {
  setProgramEvalConfig,
  addLevel,
  updateLevel,
  deleteLevel,
  moveLevel,
  cloneLevel,
  addBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  addItem,
  updateItem,
  deleteItem,
  moveItem,
} from "@/lib/actions/templates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

type Item = { id: string; code: string | null; text: string; order: number };
type Block = { id: string; code: string | null; name: string; order: number; items: Item[] };
type Level = { id: string; name: string; order: number; description: string | null; blocks: Block[] };
type Program = {
  id: string;
  name: string;
  evalFormat: "BLOQUES" | "AREAS" | "PLANO";
  passThreshold: number;
  levels: Level[];
};

const FORMAT_LABEL = {
  BLOQUES: "Por bloques (Mate, Lectura)",
  AREAS: "Por áreas (Lenguaje)",
  PLANO: "Formato plano (Danza, terapias)",
};

function confirmSubmit(message: string) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

/** Botones mover ↑ ↓ como formularios independientes. */
function MoveButtons({
  action,
  canUp,
  canDown,
}: {
  action: (dir: "up" | "down") => Promise<void>;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <>
      <form action={() => action("up")}>
        <IconButton label="Subir" disabled={!canUp}>
          <CaretUp className="size-4" />
        </IconButton>
      </form>
      <form action={() => action("down")}>
        <IconButton label="Bajar" disabled={!canDown}>
          <CaretDown className="size-4" />
        </IconButton>
      </form>
    </>
  );
}

function IconButton({
  children,
  label,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-[var(--radius-input)] transition-colors disabled:opacity-30 ${
        tone === "danger"
          ? "text-subtle hover:bg-danger-weak hover:text-danger-strong"
          : "text-subtle hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function TemplateEditor({ program }: { program: Program }) {
  return (
    <div className="space-y-4">
      <ConfigBar program={program} />

      {program.levels.map((level, i) => (
        <LevelNode
          key={level.id}
          level={level}
          programId={program.id}
          canUp={i > 0}
          canDown={i < program.levels.length - 1}
        />
      ))}

      <AddRow
        label="Añadir nivel"
        placeholder="Nombre del nivel (ej. Nivel intermedio)"
        onSubmit={addLevel.bind(null, program.id)}
      />
    </div>
  );
}

function ConfigBar({ program }: { program: Program }) {
  return (
    <Card className="p-4">
      <form
        action={setProgramEvalConfig.bind(null, program.id)}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Formato</label>
          <Select name="evalFormat" defaultValue={program.evalFormat}>
            {Object.entries(FORMAT_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-44">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Pasa de nivel al (%)</label>
          <Input
            name="passThreshold"
            type="number"
            min={1}
            max={100}
            defaultValue={program.passThreshold}
          />
        </div>
        <Button type="submit" size="md">
          Guardar
        </Button>
      </form>
    </Card>
  );
}

function LevelNode({
  level,
  programId,
  canUp,
  canDown,
}: {
  level: Level;
  programId: string;
  canUp: boolean;
  canDown: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-3">
        <Stack weight="fill" className="size-4 shrink-0 text-primary" />
        {editing ? (
          <form
            action={async (fd) => {
              await updateLevel(level.id, programId, fd);
              setEditing(false);
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <Input name="name" defaultValue={level.name} className="h-8 flex-1" autoFocus required />
            <Input
              name="description"
              defaultValue={level.description ?? ""}
              placeholder="Descripción (opcional)"
              className="h-8 flex-1"
            />
            <IconButton label="Guardar">
              <Check className="size-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancelar"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">
                <span className="text-subtle">Nivel {level.order}</span> · {level.name}
              </p>
              {level.description && (
                <p className="truncate text-xs text-muted">{level.description}</p>
              )}
            </div>
            <MoveButtons
              action={(dir) => moveLevel(level.id, programId, dir)}
              canUp={canUp}
              canDown={canDown}
            />
            <button
              onClick={() => setEditing(true)}
              aria-label="Editar nivel"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <PencilSimple className="size-4" />
            </button>
            <form action={cloneLevel.bind(null, level.id, programId)}>
              <IconButton label="Clonar nivel">
                <Copy className="size-4" />
              </IconButton>
            </form>
            <form
              action={deleteLevel.bind(null, level.id, programId)}
              onSubmit={confirmSubmit(
                `¿Eliminar el nivel "${level.name}" con todos sus bloques y temas? Esto también borra las calificaciones registradas en él.`,
              )}
            >
              <IconButton label="Eliminar nivel" tone="danger">
                <Trash className="size-4" />
              </IconButton>
            </form>
          </>
        )}
      </div>

      <div className="space-y-2 p-3 pl-4 sm:pl-8">
        {level.blocks.map((block, i) => (
          <BlockNode
            key={block.id}
            block={block}
            levelId={level.id}
            programId={programId}
            canUp={i > 0}
            canDown={i < level.blocks.length - 1}
          />
        ))}

        {adding ? (
          <InlineAdd
            fields={[
              { name: "code", placeholder: "Código (ej. 1.2)", width: "w-28" },
              { name: "name", placeholder: "Nombre del bloque", width: "flex-1" },
            ]}
            onSubmit={async (fd) => {
              await addBlock(level.id, programId, fd);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-1 py-1 text-sm font-semibold text-primary transition-colors hover:text-primary-strong"
          >
            <Plus weight="bold" className="size-4" />
            Añadir bloque
          </button>
        )}
      </div>
    </Card>
  );
}

function BlockNode({
  block,
  levelId,
  programId,
  canUp,
  canDown,
}: {
  block: Block;
  levelId: string;
  programId: string;
  canUp: boolean;
  canDown: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-[var(--radius-control)] border border-border">
      <div className="flex items-center gap-1.5 px-3 py-2">
        {editing ? (
          <form
            action={async (fd) => {
              await updateBlock(block.id, programId, fd);
              setEditing(false);
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <Input name="code" defaultValue={block.code ?? ""} placeholder="Código" className="h-8 w-24" />
            <Input name="name" defaultValue={block.name} className="h-8 flex-1" autoFocus required />
            <IconButton label="Guardar">
              <Check className="size-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancelar"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {block.code && <span className="text-subtle">{block.code}</span>} {block.name}
              <span className="ml-1.5 text-xs font-normal text-subtle">
                · {block.items.length} {block.items.length === 1 ? "tema" : "temas"}
              </span>
            </p>
            <MoveButtons
              action={(dir) => moveBlock(block.id, levelId, programId, dir)}
              canUp={canUp}
              canDown={canDown}
            />
            <button
              onClick={() => setEditing(true)}
              aria-label="Editar bloque"
              className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <PencilSimple className="size-4" />
            </button>
            <form
              action={deleteBlock.bind(null, block.id, programId)}
              onSubmit={confirmSubmit(
                `¿Eliminar el bloque "${block.name}" y sus temas? Esto borra las calificaciones de esos temas.`,
              )}
            >
              <IconButton label="Eliminar bloque" tone="danger">
                <Trash className="size-4" />
              </IconButton>
            </form>
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-border px-3 py-2 pl-5">
        {block.items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            blockId={block.id}
            programId={programId}
            canUp={i > 0}
            canDown={i < block.items.length - 1}
          />
        ))}

        {adding ? (
          <InlineAdd
            fields={[
              { name: "code", placeholder: "a", width: "w-16" },
              { name: "text", placeholder: "Redacción del tema (ej. Puedo contar hasta 10)", width: "flex-1" },
            ]}
            onSubmit={async (fd) => {
              await addItem(block.id, programId, fd);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:text-primary-strong"
          >
            <Plus weight="bold" className="size-3.5" />
            Añadir tema
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  blockId,
  programId,
  canUp,
  canDown,
}: {
  item: Item;
  blockId: string;
  programId: string;
  canUp: boolean;
  canDown: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          await updateItem(item.id, programId, fd);
          setEditing(false);
        }}
        className="flex flex-wrap items-center gap-2 py-1"
      >
        <Input name="code" defaultValue={item.code ?? ""} placeholder="a" className="h-8 w-16" />
        <Input name="text" defaultValue={item.text} className="h-8 flex-1" autoFocus required />
        <IconButton label="Guardar">
          <Check className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar"
          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <p className="min-w-0 flex-1 text-sm text-muted">
        {item.code && <span className="text-subtle">{item.code}) </span>}
        {item.text}
      </p>
      <MoveButtons
        action={(dir) => moveItem(item.id, blockId, programId, dir)}
        canUp={canUp}
        canDown={canDown}
      />
      <button
        onClick={() => setEditing(true)}
        aria-label="Editar tema"
        className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <PencilSimple className="size-4" />
      </button>
      <form
        action={deleteItem.bind(null, item.id, programId)}
        onSubmit={confirmSubmit(`¿Eliminar el tema "${item.text}"?`)}
      >
        <IconButton label="Eliminar tema" tone="danger">
          <Trash className="size-4" />
        </IconButton>
      </form>
    </div>
  );
}

/** Fila para añadir con uno o dos campos. */
function InlineAdd({
  fields,
  onSubmit,
  onCancel,
}: {
  fields: { name: string; placeholder: string; width: string }[];
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2 py-1">
      {fields.map((f, i) => (
        <Input
          key={f.name}
          name={f.name}
          placeholder={f.placeholder}
          className={`h-8 ${f.width}`}
          autoFocus={i === fields.length - 1}
          required={i === fields.length - 1}
        />
      ))}
      <Button type="submit" size="sm">
        Añadir
      </Button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </form>
  );
}

/** Fila simple para añadir con un solo campo de texto (usada para niveles). */
function AddRow({
  label,
  placeholder,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <Button variant="secondary" size="md" onClick={() => setAdding(true)}>
        <Plus weight="bold" className="size-4" />
        {label}
      </Button>
    );
  }
  return (
    <Card className="p-3">
      <form
        action={async (fd) => {
          await onSubmit(fd);
          setAdding(false);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input name="name" placeholder={placeholder} className="h-9 flex-1" autoFocus required />
        <Input name="description" placeholder="Descripción (opcional)" className="h-9 flex-1" />
        <Button type="submit" size="md">
          Añadir
        </Button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          aria-label="Cancelar"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] text-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </form>
    </Card>
  );
}
