"use client";

import { Sun, MoonStars } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Botón claro/oscuro. No usa estado de React: el ícono se decide por CSS según
 * `data-theme` (así no hay parpadeo de hidratación) y al hacer clic se cambia
 * el atributo y se guarda la elección en localStorage ("tema").
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("tema", next);
    } catch {
      // Sin almacenamiento (modo privado): el cambio aplica solo a esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar entre tema claro y oscuro"
      className={cn(
        "flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <MoonStars className="size-[1.1rem] dark:hidden" />
      <Sun className="hidden size-[1.1rem] dark:block" />
    </button>
  );
}
