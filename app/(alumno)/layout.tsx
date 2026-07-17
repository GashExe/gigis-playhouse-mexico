import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, SignOut } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/lib/actions/auth";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AlumnoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Este espacio es exclusivo de las cuentas de alumno.
  if (user.role !== "ALUMNO") redirect("/panel");

  return (
    <div className="min-h-[100dvh] bg-bg">
      <span aria-hidden className="rainbow-strip fixed inset-x-0 top-0 z-20 h-1.5" />
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-6">
          <Logo className="h-7" />
          <div className="flex items-center gap-1">
            <ThemeToggle className="size-9" />
            <Link
              href="/mi-espacio/manual"
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <BookOpenText className="size-[1.1rem]" />
              Manual
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <SignOut className="size-[1.1rem]" />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:px-6 lg:pt-9">
        {children}
      </main>
    </div>
  );
}
