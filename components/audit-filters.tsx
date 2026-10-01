"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { AUDIT_CATEGORIES, AUDIT_PERIODS, type AuditCategory } from "@/lib/audit-categories";
import { SearchInput } from "@/components/search-input";
import { Select } from "@/components/ui/field";

/**
 * Filtros de la bitácora. Todo vive en la URL (?tipo, ?persona, ?periodo, ?q) para
 * que la dirección pueda volver atrás o compartir la vista filtrada, y se combinan
 * entre sí: escoger "Donativos" y luego una persona deja ambos puestos.
 */
export function AuditFilters({
  categoryCounts,
  allCount,
  actors,
}: {
  categoryCounts: Record<AuditCategory, number>;
  allCount: number;
  actors: { name: string; count: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const tipo = params.get("tipo") ?? "";
  const persona = params.get("persona") ?? "";
  const periodo = params.get("periodo") ?? "30";

  function set(key: string, value: string, fallback = "") {
    const sp = new URLSearchParams(params);
    if (value && value !== fallback) sp.set(key, value);
    else sp.delete(key);
    sp.delete("n"); // al cambiar filtros se vuelve a la primera página
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  // La persona elegida se queda en la lista aunque con los demás filtros no tenga
  // movimientos: si desapareciera, el filtro quedaría puesto sin poder quitarse.
  const actorOptions =
    persona && !actors.some((a) => a.name === persona)
      ? [{ name: persona, count: 0 }, ...actors]
      : actors;

  const tabs = [
    { value: "", label: "Todo", count: allCount },
    ...AUDIT_CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: categoryCounts[c.value] })),
  ];

  return (
    <div className="mb-5 space-y-3" data-pending={pending ? "" : undefined}>
      <div role="tablist" aria-label="Filtrar por tipo de movimiento" className="flex flex-wrap items-center gap-1">
        {tabs.map((t) => {
          const active = tipo === t.value;
          return (
            <button
              key={t.value || "todo"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => set("tipo", t.value)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-sm font-semibold transition-colors ${
                active ? "bg-ink text-surface" : "text-muted hover:bg-surface-2 hover:text-ink"
              } ${!active && t.count === 0 ? "opacity-60" : ""}`}
            >
              {t.label}
              <span className={`tnum text-xs font-bold ${active ? "opacity-70" : "text-subtle"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Buscar movimiento o participante…" className="sm:max-w-none sm:flex-1" />
        <Select
          aria-label="Persona que hizo el cambio"
          value={persona}
          onChange={(e) => set("persona", e.target.value)}
          className="sm:max-w-52"
        >
          <option value="">Todo el equipo</option>
          {actorOptions.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} ({a.count})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Periodo"
          value={periodo}
          onChange={(e) => set("periodo", e.target.value, "30")}
          className="sm:max-w-40"
        >
          {AUDIT_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
