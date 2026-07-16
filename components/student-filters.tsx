"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

type Counts = { ACTIVO: number; INACTIVO: number; EGRESADO: number; TOTAL: number };

const TABS: { value: string; label: string; key: keyof Counts }[] = [
  { value: "", label: "Todos", key: "TOTAL" },
  { value: "ACTIVO", label: "Activos", key: "ACTIVO" },
  { value: "INACTIVO", label: "Inactivos", key: "INACTIVO" },
  { value: "EGRESADO", label: "Egresados", key: "EGRESADO" },
];

/** Filtro por estado. Conserva la búsqueda: filtrar y buscar se combinan. */
export function StudentFilters({ counts }: { counts: Counts }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = params.get("estado") ?? "";

  function select(value: string) {
    const sp = new URLSearchParams(params);
    if (value) sp.set("estado", value);
    else sp.delete("estado");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Filtrar por estado"
      data-pending={pending ? "" : undefined}
      className="flex flex-wrap items-center gap-1"
    >
      {TABS.map((t) => {
        const active = current === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => select(t.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-ink text-surface"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t.label}
            <span
              className={`tnum text-xs font-bold ${active ? "opacity-70" : "text-subtle"}`}
            >
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
