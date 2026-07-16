"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  UsersThree,
  Books,
  UserGear,
  SignOut,
} from "@phosphor-icons/react";
import { cn, initials, roleLabel } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { logout } from "@/lib/actions/auth";
import type { Role } from "@/lib/generated/prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ weight?: "regular" | "fill" | "bold"; className?: string }>;
  roles?: Role[];
};

const NAV: NavItem[] = [
  { href: "/panel", label: "Panel", icon: House },
  { href: "/estudiantes", label: "Participantes", icon: UsersThree },
  { href: "/programas", label: "Programas", icon: Books },
  { href: "/usuarios", label: "Equipo", icon: UserGear, roles: ["DIRECTORA"] },
];

function useVisibleNav(role: Role) {
  return NAV.filter((i) => !i.roles || i.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/* ---------- Escritorio: barra lateral ---------- */

function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = useVisibleNav(role);
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-primary-weak text-primary-strong"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon
              weight={active ? "fill" : "regular"}
              className={cn(
                "size-[1.15rem]",
                active ? "text-primary" : "text-subtle group-hover:text-ink",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ name, role }: { name: string; role: Role }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-weak text-sm font-bold text-primary-strong"
      >
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{name}</p>
        <p className="text-xs font-medium text-muted">{roleLabel(role)}</p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Cerrar sesión"
          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
        >
          <SignOut className="size-[1.1rem]" />
        </button>
      </form>
    </div>
  );
}

/** Crédito discreto de MexNodus al pie de la navegación. */
function MexNodusCredit() {
  return (
    <a
      href="https://www.mexnodus.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 px-2 pt-0.5 text-[0.7rem] font-medium text-subtle transition-colors hover:text-ink"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mexnodus-icon.svg" alt="" className="size-3.5" />
      <span>
        Diseñada por <span className="font-semibold">MexNodus</span>
      </span>
    </a>
  );
}

/* ---------- Móvil: barra flotante "liquid glass" ---------- */

function GlassTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = useVisibleNav(role);
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "liquid-glass fixed inset-x-0 bottom-0 z-40 mx-auto flex w-[min(92%,26rem)]",
        "items-stretch justify-around gap-1 rounded-[1.6rem] p-1.5 lg:hidden",
      )}
      // Separación del borde inferior respetando la barra de gestos (Android/iOS).
      style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 0.6rem)" }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[1.2rem] px-1 py-2 transition-colors",
              active ? "text-primary-strong" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-[1.2rem] bg-primary-weak shadow-[inset_0_1px_0_oklch(1_0_0_/_0.5)]"
              />
            )}
            <Icon
              weight={active ? "fill" : "regular"}
              className={cn("relative size-[1.4rem]", active ? "text-primary" : "text-subtle")}
            />
            <span className="relative whitespace-nowrap text-[0.62rem] font-semibold leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppNav({ name, role }: { name: string; role: Role }) {
  return (
    <>
      {/* Barra superior móvil (respeta el notch con safe-area arriba) */}
      <header
        className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span aria-hidden className="rainbow-strip absolute inset-x-0 top-0 h-1" />
        <div className="flex h-14 items-center justify-between px-4">
          <Logo className="h-7" />
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-primary-weak text-xs font-bold text-primary-strong"
            >
              {initials(name)}
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex size-9 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
              >
                <SignOut className="size-[1.2rem]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border bg-sidebar px-4 py-5 lg:flex">
        <span aria-hidden className="rainbow-strip absolute inset-x-0 top-0 h-1" />
        <div className="px-2">
          <Logo />
        </div>
        <div className="flex-1">
          <NavLinks role={role} />
        </div>
        <div className="flex flex-col gap-3">
          <UserCard name={name} role={role} />
          <MexNodusCredit />
        </div>
      </aside>

      {/* Barra flotante liquid glass (solo móvil) */}
      <GlassTabBar role={role} />
    </>
  );
}
