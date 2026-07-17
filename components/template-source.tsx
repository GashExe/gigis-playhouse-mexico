"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";

export type CopySource = { id: string; name: string; levels: number; items: number };
export type PresetSource = {
  id: string;
  name: string;
  description: string | null;
  levels: number;
  blocks: number;
  items: number;
};

type Mode = "blank" | "copy" | "preset";

/**
 * De dónde sale la evaluación de un programa nuevo: en blanco, copiando la de otro
 * programa, o desde una plantilla base. Solo aparece al crear: cambiar la plantilla
 * de un programa que ya califica alumnos es otra cosa, y se hace desde su editor.
 */
export function TemplateSource({
  programs,
  presets,
}: {
  programs: CopySource[];
  presets: PresetSource[];
}) {
  const [mode, setMode] = useState<Mode>("blank");
  const [copyId, setCopyId] = useState(programs[0]?.id ?? "");
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");

  const value =
    mode === "copy" && copyId
      ? `copy:${copyId}`
      : mode === "preset" && presetId
        ? `preset:${presetId}`
        : "";

  const options: { mode: Mode; label: string; hint: string; disabled?: boolean }[] = [
    { mode: "blank", label: "En blanco", hint: "La armas tú desde el editor." },
    {
      mode: "copy",
      label: "Copiar de otro programa",
      hint: programs.length ? "Se copia su estructura completa." : "No hay programas con plantilla.",
      disabled: programs.length === 0,
    },
    {
      mode: "preset",
      label: "Plantilla base",
      hint: presets.length
        ? "De la biblioteca."
        : "La biblioteca está vacía: guarda la plantilla de un programa para reutilizarla.",
      disabled: presets.length === 0,
    },
  ];

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface-2/40 p-3">
      <input type="hidden" name="templateSource" value={value} />
      <p className="mb-2 text-xs font-bold text-ink">Evaluación del programa</p>

      <div className="grid gap-1.5 sm:grid-cols-3">
        {options.map((o) => {
          const active = mode === o.mode;
          return (
            <button
              key={o.mode}
              type="button"
              disabled={o.disabled}
              onClick={() => setMode(o.mode)}
              aria-pressed={active}
              className={`rounded-[var(--radius-input)] border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "border-primary bg-surface" : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-primary bg-primary text-surface" : "border-border-strong"
                  }`}
                >
                  {active && <Check weight="bold" className="size-2" />}
                </span>
                <span className="text-sm font-semibold text-ink">{o.label}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>

      {mode === "copy" && programs.length > 0 && (
        <select
          value={copyId}
          onChange={(e) => setCopyId(e.target.value)}
          aria-label="Programa del que copiar la plantilla"
          className="mt-2 h-10 w-full rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.levels} niveles, {p.items} temas
            </option>
          ))}
        </select>
      )}

      {mode === "preset" && presets.length > 0 && (
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          aria-label="Plantilla base"
          className="mt-2 h-10 w-full rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.levels} niveles, {p.blocks} bloques, {p.items} temas
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
