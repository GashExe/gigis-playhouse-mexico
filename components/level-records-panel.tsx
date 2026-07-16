"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Plus, PencilSimple, Trash, GraduationCap, Stack, ListChecks } from "@phosphor-icons/react";
import { setLevelRecord, removeLevelRecord } from "@/lib/actions/level-records";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { fecha } from "@/lib/format";

type Placement = "REGULAR" | "PROBATORIO" | "POSIBLE_GRADUADO";

const PLACEMENT_LABEL: Record<Placement, string> = {
  REGULAR: "Regular",
  PROBATORIO: "Probatorio",
  POSIBLE_GRADUADO: "Posible graduado",
};
const PLACEMENT_TONE: Record<Placement, string> = {
  REGULAR: "bg-surface-2 text-muted",
  PROBATORIO: "bg-warning-weak text-warning-strong",
  POSIBLE_GRADUADO: "bg-success-weak text-success-strong",
};

type LevelOption = { id: string; name: string; order: number };
type ProgramWithLevels = {
  id: string;
  name: string;
  color: string | null;
  area: string | null;
  levels: LevelOption[];
};
type RecordItem = {
  id: string;
  placement: Placement;
  note: string | null;
  gradedAt: Date;
  program: { id: string; name: string; color: string | null; area: string | null };
  level: { id: string; name: string; order: number };
};
type Cycle = { id: string; label: string; active: boolean };

export function LevelRecordsPanel({
  studentId,
  records,
  programs,
  cycles,
  selectedCycleId,
}: {
  studentId: string;
  records: RecordItem[];
  programs: ProgramWithLevels[];
  cycles: Cycle[];
  selectedCycleId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);

  const usedProgramIds = new Set(records.map((r) => r.program.id));
  const available = programs.filter((p) => !usedProgramIds.has(p.id));

  function changeCycle(cycleId: string) {
    const qs = new URLSearchParams({ ciclo: cycleId });
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nivel por programa</CardTitle>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Ciclo"
            value={selectedCycleId}
            onChange={(e) => changeCycle(e.target.value)}
            className="h-9 w-auto text-sm"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.active ? " · actual" : ""}
              </option>
            ))}
          </Select>
          {available.length > 0 && !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus weight="bold" className="size-4" />
              Ubicar
            </Button>
          )}
        </div>
      </CardHeader>

      {adding && (
        <AddForm
          studentId={studentId}
          cycleId={selectedCycleId}
          programs={available}
          onDone={() => setAdding(false)}
        />
      )}

      {records.length === 0 && !adding ? (
        <div className="p-4">
          <EmptyState
            icon={<Stack weight="fill" className="size-6" />}
            title="Sin nivel registrado en este ciclo"
            description="Ubica a este participante en un nivel de sus programas."
            action={
              available.length > 0 ? (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus weight="bold" className="size-4" />
                  Ubicar en un nivel
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {records.map((r) => {
            const program = programs.find((p) => p.id === r.program.id);
            return (
              <LevelRow
                key={r.id}
                record={r}
                studentId={studentId}
                cycleId={selectedCycleId}
                levels={program?.levels ?? [r.level]}
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PlacementBadge({ placement }: { placement: Placement }) {
  if (placement === "REGULAR") return null;
  return (
    <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-block ${PLACEMENT_TONE[placement]}`}>
      {PLACEMENT_LABEL[placement]}
    </span>
  );
}

function LevelRow({
  record: r,
  studentId,
  cycleId,
  levels,
}: {
  record: RecordItem;
  studentId: string;
  cycleId: string;
  levels: LevelOption[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)]"
          style={{ backgroundColor: (r.program.color ?? "var(--primary)") + "22", color: r.program.color ?? "var(--primary)" }}
        >
          <GraduationCap weight="fill" className="size-[1.1rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{r.program.name}</p>
          <p className="text-xs text-muted">
            Nivel: <span className="font-semibold text-ink">{r.level.name}</span>
            {r.note ? ` · ${r.note}` : ""} · {fecha(r.gradedAt)}
          </p>
        </div>
        <PlacementBadge placement={r.placement} />
        <Link
          href={`/estudiantes/${studentId}/calificar/${r.program.id}?ciclo=${cycleId}`}
          aria-label="Calificar por bloques"
          title="Calificar por bloques"
          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ListChecks className="size-4" />
        </Link>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-label="Editar nivel"
          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <PencilSimple className="size-4" />
        </button>
      </div>

      {editing && (
        <form
          action={async (fd) => {
            await setLevelRecord(studentId, fd);
            setEditing(false);
          }}
          className="mt-2 flex w-full flex-col gap-2 rounded-[var(--radius-control)] bg-surface-2/60 p-2.5 sm:pl-12"
        >
          <input type="hidden" name="programId" value={r.program.id} />
          <input type="hidden" name="cycleId" value={cycleId} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select name="programLevelId" defaultValue={r.level.id} className="sm:w-44" required>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select name="placement" defaultValue={r.placement} className="sm:w-44">
              <option value="REGULAR">Regular</option>
              <option value="PROBATORIO">Probatorio</option>
              <option value="POSIBLE_GRADUADO">Posible graduado</option>
            </Select>
            <Input name="note" placeholder="Nota (opcional)" defaultValue={r.note ?? ""} className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Guardar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            {/* formAction envía a removeLevelRecord sin anidar otro <form> (HTML inválido). */}
            <Button
              type="submit"
              formAction={removeLevelRecord.bind(null, r.id, studentId)}
              variant="ghost"
              size="sm"
              className="ml-auto text-danger-strong"
            >
              <Trash className="size-4" />
              Quitar
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function AddForm({
  studentId,
  cycleId,
  programs,
  onDone,
}: {
  studentId: string;
  cycleId: string;
  programs: ProgramWithLevels[];
  onDone: () => void;
}) {
  const [programId, setProgramId] = useState("");
  const levels = programs.find((p) => p.id === programId)?.levels ?? [];

  return (
    <form
      action={async (fd) => {
        await setLevelRecord(studentId, fd);
        onDone();
      }}
      className="flex flex-col gap-2 border-b border-border bg-surface-2/60 px-5 py-4"
    >
      <input type="hidden" name="cycleId" value={cycleId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Programa</label>
          <Select
            name="programId"
            required
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="" disabled>Selecciona un programa…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Nivel</label>
          <Select name="programLevelId" required defaultValue="" disabled={!programId}>
            <option value="" disabled>{programId ? "Selecciona un nivel…" : "Elige un programa primero"}</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Situación</label>
          <Select name="placement" defaultValue="REGULAR">
            <option value="REGULAR">Regular</option>
            <option value="PROBATORIO">Probatorio</option>
            <option value="POSIBLE_GRADUADO">Posible graduado</option>
          </Select>
        </div>
        <Input name="note" placeholder="Nota (opcional)" className="flex-1" />
        <div className="flex gap-2">
          <Button type="submit" size="md">Guardar</Button>
          <Button type="button" variant="ghost" size="md" onClick={onDone}>Cancelar</Button>
        </div>
      </div>
    </form>
  );
}
