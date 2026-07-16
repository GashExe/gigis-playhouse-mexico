"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { CalendarBlank, Check, CircleNotch } from "@phosphor-icons/react";
import { activateCycle } from "@/lib/actions/programs";

type Cycle = { id: string; label: string; active: boolean; programCount: number };

/**
 * Barra de ciclos de la pantalla de programas. Sirve para dos cosas distintas:
 * ver la oferta de un ciclo (cualquiera del personal) y activar el ciclo vigente
 * (solo la directora). El ciclo activo es donde se inscribe y se califica.
 */
export function CycleBar({
  cycles,
  selectedId,
  canActivate,
}: {
  cycles: Cycle[];
  selectedId: string;
  canActivate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = cycles.find((c) => c.id === selectedId);
  const activo = cycles.find((c) => c.active);

  function ver(id: string) {
    const sp = new URLSearchParams(params);
    sp.set("ciclo", id);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-5 rounded-[var(--radius-control)] border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pr-1 text-xs font-bold text-subtle">
          <CalendarBlank weight="fill" className="size-4" />
          Ciclo
        </span>
        {cycles.map((c) => {
          const isSel = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => ver(c.id)}
              aria-current={isSel ? "true" : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-sm font-semibold transition-colors ${
                isSel
                  ? "bg-ink text-surface"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {c.label}
              {c.active && (
                <span
                  title="Ciclo activo"
                  className={`size-1.5 rounded-full ${isSel ? "bg-surface" : "bg-[#1D9E75]"}`}
                />
              )}
              <span className={`tnum text-xs ${isSel ? "opacity-70" : "text-subtle"}`}>
                {c.programCount}
              </span>
            </button>
          );
        })}

        {canActivate && selected && !selected.active && (
          <button
            onClick={() => startTransition(() => activateCycle(selected.id))}
            disabled={pending}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {pending ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              <Check weight="bold" className="size-4" />
            )}
            Activar este ciclo
          </button>
        )}
      </div>

      <p className="mt-2 px-1 text-xs leading-relaxed text-muted">
        {selected?.active ? (
          <>
            Es el ciclo <strong className="text-ink">activo</strong>: aquí se inscribe y
            se califica. Solo se puede inscribir a los {selected.programCount} programas de
            su oferta.
          </>
        ) : (
          <>
            Estás viendo la oferta de {selected?.label}. El ciclo activo es{" "}
            <strong className="text-ink">{activo?.label ?? "ninguno"}</strong>
            {canActivate ? ", y es donde se inscribe y se califica." : "."}
          </>
        )}
      </p>
    </div>
  );
}
