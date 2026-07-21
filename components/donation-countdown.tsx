"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "@phosphor-icons/react";

/**
 * Cuenta regresiva hasta la fecha límite de un donativo obligatorio. Antes de que
 * llegue, la familia todavía puede apartar clases; el reloj le avisa cuánto le
 * queda. `target` es la fecha límite (medianoche UTC del día, igual que bloquea el
 * servidor).
 */
export function DonationCountdown({ target }: { target: string }) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // En el servidor y primer render no pintamos números (evita desajuste de hidratación).
  if (now == null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
        <Hourglass weight="fill" className="size-3.5" />
        Contando…
      </span>
    );
  }

  const diff = targetMs - now;
  if (diff <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger-strong">
        <Hourglass weight="fill" className="size-3.5" />
        Se pausó apartar clases — recarga la página
      </span>
    );
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <span className="flex flex-col items-center">
      <span className="min-w-[2ch] rounded-[var(--radius-input)] bg-warning-weak px-1.5 py-1 text-center text-base font-extrabold tabular-nums text-warning-strong">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </span>
    </span>
  );

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
        <Hourglass weight="fill" className="size-3.5" />
        Tiempo para cumplir el donativo
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {days > 0 && <Unit value={days} label="días" />}
        <Unit value={hours} label="hrs" />
        <Unit value={minutes} label="min" />
        <Unit value={seconds} label="seg" />
      </div>
    </div>
  );
}
