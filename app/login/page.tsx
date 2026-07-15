import type { Metadata } from "next";
import { Heart, Sparkle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Logo, LogoLockup } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <span aria-hidden className="rainbow-strip absolute inset-x-0 top-0 z-10 h-1.5" />
      {/* Panel de marca */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-on-brand lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(50rem 50rem at 12% 8%, var(--brand-blue), transparent 45%), radial-gradient(44rem 44rem at 92% 22%, var(--brand-pink), transparent 40%), radial-gradient(48rem 48rem at 96% 100%, var(--brand-yellow), transparent 42%), radial-gradient(40rem 40rem at 30% 108%, var(--brand-green), transparent 45%)",
          }}
        />
        <div className="relative">
          <LogoLockup tone="white" className="w-52 xl:w-60" />
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight">
            Cada avance cuenta. Cada niño, también.
          </h1>
          <p className="text-pretty text-[0.975rem] leading-relaxed text-on-brand/85">
            La plataforma donde el equipo de Gigi&apos;s Playhouse México registra
            participantes, programas y el progreso de cada pequeño, en un solo lugar.
          </p>
          <ul className="space-y-3 pt-2 text-sm font-medium text-on-brand/90">
            <li className="flex items-center gap-3">
              <span
                className="flex size-8 items-center justify-center rounded-full text-white shadow-[var(--shadow-sm)]"
                style={{ backgroundColor: "var(--brand-pink)" }}
              >
                <UsersThree weight="fill" className="size-[1.1rem]" />
              </span>
              Expediente completo de cada participante
            </li>
            <li className="flex items-center gap-3">
              <span
                className="flex size-8 items-center justify-center rounded-full text-white shadow-[var(--shadow-sm)]"
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                <Sparkle weight="fill" className="size-[1.1rem]" />
              </span>
              Programas, inscripciones y evaluaciones
            </li>
            <li className="flex items-center gap-3">
              <span
                className="flex size-8 items-center justify-center rounded-full text-white shadow-[var(--shadow-sm)]"
                style={{ backgroundColor: "var(--brand-purple)" }}
              >
                <Heart weight="fill" className="size-[1.1rem]" />
              </span>
              Historial de progreso a lo largo del tiempo
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-on-brand/70">
          Hecho con cariño para el equipo de Gigi&apos;s Playhouse México.
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center bg-bg px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo tone="rainbow" className="h-8" />
          </div>
          <div className="mb-7 space-y-1.5">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              Bienvenid@ de nuevo
            </h2>
            <p className="text-sm text-muted">
              Entra con tu cuenta para continuar.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 rounded-[var(--radius-input)] border border-border bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-muted">
            ¿No tienes cuenta o la olvidaste? Solicítala a la{" "}
            <span className="font-semibold text-ink">persona encargada</span>, quien
            administra las cuentas del equipo.
          </p>

          {/* Crédito de diseño — MexNodus */}
          <div className="mt-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 shadow-[var(--shadow-sm)]">
              <span className="text-[0.7rem] font-medium text-[#6B667B]">
                Diseñada por
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/mexnodus.svg"
                alt="MexNodus"
                className="h-3.5 w-auto"
              />
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
