"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  CircleNotch,
  UsersThree,
  Books,
  ArrowRight,
} from "@phosphor-icons/react";

type StudentHit = {
  id: string;
  name: string;
  matricula: string | null;
  status: string;
  href: string;
};
type ProgramHit = {
  id: string;
  name: string;
  area: string | null;
  color: string | null;
  active: boolean;
  href: string;
};
type Results = { students: StudentHit[]; programs: ProgramHit[] };

const EMPTY: Results = { students: [], programs: [] };

/** Evento con el que la lupa de la barra abre el buscador (además del atajo ⌘/Ctrl+K). */
export const OPEN_SEARCH_EVENT = "gph:open-search";

/**
 * Búsqueda global rápida. Se abre con ⌘/Ctrl+K o con la lupa de la barra, encuentra
 * participantes y programas al vuelo y lleva directo a su expediente o panel. Vive en
 * el layout del personal; las familias no tienen esta vista.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lista plana (para navegar con el teclado y saber a dónde va cada opción).
  const items: { href: string }[] = [
    ...results.students.map((s) => ({ href: s.href })),
    ...results.programs.map((p) => ({ href: p.href })),
  ];

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    setActive(0);
  }, []);

  // Abrir con ⌘/Ctrl+K (o con el evento de la lupa) y cerrar con Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Al abrir, enfocar el campo.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Buscar con debounce cada vez que cambia el texto. Todo el estado se ajusta dentro
  // del temporizador (nunca de forma síncrona en el cuerpo del efecto).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      if (q.length < 2) {
        setResults(EMPTY);
        setLoading(false);
        return;
      }
      setLoading(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as Results;
        setResults(data);
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[active];
      if (target) go(target.href);
    }
  }

  if (!open) return null;

  const q = query.trim();
  const hasResults = results.students.length > 0 || results.programs.length > 0;
  // Índice del primer programa en la lista plana (para resaltar el activo).
  const programOffset = results.students.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[8vh] sm:pt-[12vh]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda global"
        className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-border-strong bg-surface shadow-[var(--shadow-lg)]"
      >
        {/* Campo de búsqueda. Va con margen propio dentro del modal: el anillo de foco
            global se dibuja 2px por fuera del campo y, a ras del borde, se recortaría. */}
        <div className="border-b border-border p-3">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-subtle" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Buscar participantes y programas…"
              className="h-11 w-full rounded-[var(--radius-input)] border border-border-strong bg-surface-2 pl-10 pr-12 text-base text-ink placeholder:text-subtle"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <CircleNotch className="size-4 animate-spin text-subtle" />
              ) : (
                <kbd className="hidden rounded-[var(--radius-input)] border border-border px-1.5 py-0.5 text-[0.7rem] font-semibold text-subtle sm:block">
                  esc
                </kbd>
              )}
            </span>
          </div>
        </div>

        {/* Resultados */}
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">
              Escribe al menos 2 letras para buscar.
            </p>
          ) : !hasResults && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">
              Sin resultados para «{q}».
            </p>
          ) : (
            <>
              {results.students.length > 0 && (
                <div className="mb-1">
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-subtle">
                    <UsersThree weight="fill" className="size-3.5" />
                    Participantes
                  </p>
                  {results.students.map((s, i) => (
                    <Row
                      key={s.id}
                      active={active === i}
                      onClick={() => go(s.href)}
                      onHover={() => setActive(i)}
                      icon={
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary-weak text-xs font-bold text-primary-strong">
                          {s.name
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                      }
                      title={s.name}
                      subtitle={
                        s.matricula
                          ? `Matrícula ${s.matricula}`
                          : s.status === "ACTIVO"
                            ? "Activo"
                            : s.status.toLowerCase()
                      }
                    />
                  ))}
                </div>
              )}

              {results.programs.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-subtle">
                    <Books weight="fill" className="size-3.5" />
                    Programas
                  </p>
                  {results.programs.map((p, i) => (
                    <Row
                      key={p.id}
                      active={active === programOffset + i}
                      onClick={() => go(p.href)}
                      onHover={() => setActive(programOffset + i)}
                      icon={
                        <span
                          className="flex size-8 items-center justify-center rounded-[var(--radius-input)]"
                          style={{
                            backgroundColor: (p.color ?? "var(--primary)") + "22",
                            color: p.color ?? "var(--primary)",
                          }}
                        >
                          <Books weight="fill" className="size-4" />
                        </span>
                      }
                      title={p.name}
                      subtitle={p.area ?? (p.active ? "Programa" : "Inactivo")}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  active,
  onClick,
  onHover,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={onHover}
      className={`flex w-full items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-left transition-colors ${
        active ? "bg-primary-weak" : "hover:bg-surface-2"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
      <ArrowRight
        weight="bold"
        className={`size-4 shrink-0 transition-opacity ${active ? "text-primary opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}
