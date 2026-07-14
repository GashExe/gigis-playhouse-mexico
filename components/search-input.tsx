"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MagnifyingGlass, CircleNotch, X } from "@phosphor-icons/react";

export function SearchInput({ placeholder = "Buscar…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function push(next: string) {
    const sp = new URLSearchParams(params);
    if (next) sp.set("q", next);
    else sp.delete("q");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 250);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius-input)] border border-border-strong bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--primary-ring)]"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <CircleNotch className="size-4 animate-spin text-subtle" />
        ) : value ? (
          <button
            onClick={() => {
              setValue("");
              push("");
            }}
            aria-label="Limpiar búsqueda"
            className="text-subtle hover:text-ink"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </span>
    </div>
  );
}
