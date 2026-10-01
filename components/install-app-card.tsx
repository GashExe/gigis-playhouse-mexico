"use client";

import { useEffect, useState } from "react";
import {
  BellRinging,
  BellSlash,
  CheckCircle,
  DeviceMobile,
  DownloadSimple,
  Export,
  PlusSquare,
  X,
} from "@phosphor-icons/react";
import { savePushSubscription } from "@/lib/actions/push";

/**
 * Aviso "Agrega a Gigi's como app" en Mi espacio. Cambia según el celular:
 *
 * - Android (Chrome): botón "Instalar" con la ventana nativa del navegador, y la
 *   opción de solo activar notificaciones (Android las permite sin instalar).
 * - iPhone en el navegador: Apple no deja instalar con un botón ni mandar
 *   notificaciones a una página; se explican los dos toques (Compartir → Agregar a
 *   inicio). Ya instalada, aparece "Activar notificaciones".
 * - Instalada o en computadora: "Activar notificaciones".
 *
 * Desaparece cuando el dispositivo ya está suscrito. "Ahora no" lo esconde 7 días
 * en ese dispositivo (localStorage: es una comodidad, no un dato que importe).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const OCULTO_KEY = "gigis-aviso-app-oculto-hasta";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function ocultoVigente(): boolean {
  try {
    const hasta = Number(localStorage.getItem(OCULTO_KEY));
    return Number.isFinite(hasta) && hasta > Date.now();
  } catch {
    return false;
  }
}

type Estado = {
  listo: boolean; // ya se revisó el dispositivo (antes no se pinta nada)
  soportaPush: boolean;
  ios: boolean;
  instalada: boolean;
  permiso: NotificationPermission | "no-disponible";
  suscrito: boolean;
};

export function InstallAppCard() {
  const [estado, setEstado] = useState<Estado>({
    listo: false,
    soportaPush: false,
    ios: false,
    instalada: false,
    permiso: "no-disponible",
    suscrito: false,
  });
  const [instalable, setInstalable] = useState<BeforeInstallPromptEvent | null>(null);
  const [oculto, setOculto] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recienActivado, setRecienActivado] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS se presenta como Mac; se distingue por la pantalla táctil.
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const soportaPush =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID);
    const permiso = "Notification" in window ? Notification.permission : "no-disponible";

    const onPrompt = (e: Event) => {
      e.preventDefault(); // la ventana se abre cuando la familia toca "Instalar"
      setInstalable(e as BeforeInstallPromptEvent);
    };
    const onInstalada = () => {
      setInstalable(null);
      setEstado((s) => ({ ...s, instalada: true }));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalada);

    let cancelado = false;
    (async () => {
      let suscrito = false;
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
          const sub = await reg.pushManager?.getSubscription();
          suscrito = Boolean(sub) && permiso === "granted";
          // Si el navegador conserva la suscripción, se vuelve a mandar al servidor:
          // cubre el caso de que se haya borrado allá o que ahora entre otra cuenta.
          if (sub && suscrito) await savePushSubscription(sub.toJSON(), navigator.userAgent);
        } catch {
          // Sin service worker no hay notificaciones, pero instalar sigue sirviendo.
        }
      }
      if (cancelado) return;
      setOculto(ocultoVigente());
      setEstado({ listo: true, soportaPush, ios, instalada, permiso, suscrito });
    })();

    return () => {
      cancelado = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalada);
    };
  }, []);

  async function activarNotificaciones() {
    if (!VAPID) return;
    setTrabajando(true);
    setError(null);
    try {
      // En iPhone el permiso SOLO se puede pedir como respuesta a un toque: por eso
      // va aquí y no al cargar la página.
      const permiso = await Notification.requestPermission();
      setEstado((s) => ({ ...s, permiso }));
      if (permiso !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(VAPID),
        }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!res.ok) throw new Error("no guardó");
      setEstado((s) => ({ ...s, suscrito: true }));
      setRecienActivado(true);
    } catch {
      setError("No se pudieron activar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function instalar() {
    if (!instalable) return;
    await instalable.prompt();
    const { outcome } = await instalable.userChoice;
    if (outcome === "accepted") setInstalable(null);
  }

  function ahoraNo() {
    try {
      localStorage.setItem(OCULTO_KEY, String(Date.now() + 7 * 86_400_000));
    } catch {
      // sin almacenamiento, solo se oculta mientras dure la visita
    }
    setOculto(true);
  }

  if (!estado.listo) return null;

  if (recienActivado) {
    return (
      <Marco>
        <div className="flex items-start gap-3">
          <CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-success" />
          <div>
            <p className="font-semibold text-ink">Listo, las notificaciones están activadas</p>
            <p className="mt-0.5 text-sm text-muted">
              Te llegarán aquí los avisos de la dirección, las clases suspendidas, las anotaciones
              de las terapeutas y lo de donativos.
            </p>
          </div>
        </div>
      </Marco>
    );
  }

  // Ya quedó todo: nada que pedir.
  if (estado.suscrito) return null;
  if (oculto) return null;

  const iphoneSinInstalar = estado.ios && !estado.instalada;
  const puedeActivar = estado.soportaPush && estado.permiso !== "denied";

  // Navegadores sin notificaciones y sin forma de instalar (ej. iPhone muy viejo).
  if (!iphoneSinInstalar && !puedeActivar && !instalable && estado.permiso !== "denied") return null;

  return (
    <Marco onClose={ahoraNo}>
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[30%] bg-primary-weak text-primary-strong">
          <DeviceMobile weight="fill" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold leading-snug text-ink">
            Agrega a Gigi&apos;s como app y recibe todas las notificaciones más rápido y fácil
          </p>
          <p className="mt-1 text-sm text-muted">
            Avisos de la dirección, clases suspendidas, anotaciones de las terapeutas y donativos,
            directo en tu celular.
          </p>
        </div>
      </div>

      {estado.permiso === "denied" ? (
        <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-input)] bg-warning-weak px-3 py-2.5 text-sm text-warning-strong">
          <BellSlash weight="fill" className="mt-0.5 size-4 shrink-0" />
          Las notificaciones están bloqueadas para Gigi&apos;s. Actívalas en los ajustes de tu
          celular (Notificaciones → Gigi&apos;s) y vuelve a abrir la app.
        </p>
      ) : iphoneSinInstalar ? (
        <ol className="mt-4 space-y-2.5 text-sm text-ink">
          <Paso n={1}>
            Toca el botón <strong className="font-semibold">Compartir</strong>
            <Export className="mx-1 inline size-[1.1rem] -translate-y-px text-primary-strong" aria-hidden />
            en la barra de Safari.
          </Paso>
          <Paso n={2}>
            Elige <strong className="font-semibold">Agregar a pantalla de inicio</strong>
            <PlusSquare className="mx-1 inline size-[1.1rem] -translate-y-px text-primary-strong" aria-hidden />
            y luego <strong className="font-semibold">Agregar</strong>.
          </Paso>
          <Paso n={3}>
            Abre Gigi&apos;s desde el ícono nuevo y toca{" "}
            <strong className="font-semibold">Activar notificaciones</strong>.
          </Paso>
        </ol>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {instalable && !estado.instalada && (
            <button
              type="button"
              onClick={instalar}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-primary-hover active:translate-y-px"
            >
              <DownloadSimple weight="bold" className="size-4" />
              Instalar Gigi&apos;s
            </button>
          )}
          {puedeActivar && (
            <button
              type="button"
              onClick={activarNotificaciones}
              disabled={trabajando}
              className={`inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-colors active:translate-y-px disabled:opacity-60 ${
                instalable && !estado.instalada
                  ? "border border-border-strong bg-surface text-ink hover:bg-surface-2"
                  : "bg-primary text-on-brand hover:bg-primary-hover"
              }`}
            >
              <BellRinging weight="fill" className="size-4" />
              {trabajando
                ? "Activando…"
                : instalable && !estado.instalada
                  ? "Solo activar notificaciones"
                  : "Activar notificaciones"}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-medium text-danger-strong">{error}</p>}
    </Marco>
  );
}

function Marco({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <section
      aria-label="Instalar Gigi's y activar notificaciones"
      className="relative mb-6 rounded-[var(--radius-card)] border border-primary/25 bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Ahora no"
          title="Ahora no"
          className="tap absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
      {children}
    </section>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}
