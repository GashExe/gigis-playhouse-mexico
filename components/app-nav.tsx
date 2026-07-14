"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  House,
  UsersThree,
  Books,
  UserGear,
  SignOut,
  List,
  X,
} from "@phosphor-icons/react";
import { cn, initials } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand";
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

function NavLinks({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((i) => !i.roles || i.roles.includes(role)).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
              className={cn("size-[1.15rem]", active ? "text-primary" : "text-subtle group-hover:text-ink")}
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
        <p className="text-xs font-medium text-muted">
          {role === "DIRECTORA" ? "Directora" : "Maestra"}
        </p>
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

export function AppNav({ name, role }: { name: string; role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-sidebar/95 px-4 backdrop-blur lg:hidden">
        <span aria-hidden className="rainbow-strip absolute inset-x-0 top-0 h-1" />
        <Logo showText={false} />
        <span className="text-sm font-extrabold tracking-tight text-ink">
          Gigi&apos;s Playhouse
        </span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="flex size-9 items-center justify-center rounded-[var(--radius-input)] text-ink hover:bg-surface-2"
        >
          <List className="size-5" />
        </button>
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
        <UserCard name={name} role={role} />
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-6 border-r border-border bg-sidebar px-4 py-5 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="flex size-9 items-center justify-center rounded-[var(--radius-input)] text-ink hover:bg-surface-2"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks role={role} onNavigate={() => setOpen(false)} />
            </div>
            <UserCard name={name} role={role} />
          </div>
        </div>
      )}
    </>
  );
}
