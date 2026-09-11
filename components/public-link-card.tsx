"use client";

import { useEffect, useState } from "react";
import { Link as LinkIcon, Copy, Check, ArrowSquareOut } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";

/**
 * La liga que se le comparte a los prestadores para que reporten sus horas.
 *
 * La dirección llega ya armada desde el servidor, sacada de la petición, y no de
 * una variable de entorno: así la liga que se copia es SIEMPRE la del lugar donde
 * está abierta la plataforma. Una variable mal puesta da una liga que se ve bien,
 * se comparte por WhatsApp y no lleva a ningún lado.
 */
export function PublicLinkCard({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles (pasa en algunos navegadores): que al menos
      // quede seleccionada para copiarla a mano.
      const campo = document.getElementById("liga-publica") as HTMLInputElement | null;
      campo?.select();
    }
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        <LinkIcon weight="bold" className="size-4 text-primary" />
        Liga para reportar horas
      </h2>
      <p className="mt-1 text-xs text-muted">
        Compártesela a los prestadores. Se llena sin cuenta y sin contraseña, igual que el
        formulario de Google: lo que mandan cae aquí, siempre por revisar.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id="liga-publica"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-input)] border border-border bg-surface-2 px-3 font-mono text-sm text-ink"
        />
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          {copiado ? (
            <>
              <Check weight="bold" className="size-4 text-success-strong" />
              Copiada
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copiar
            </>
          )}
        </button>
        <a
          href="/reportar"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ArrowSquareOut className="size-4" />
          Abrir
        </a>
      </div>

      <p className="mt-3 text-xs text-subtle">
        Cualquiera con la liga puede mandar un reporte, y nadie verifica quién lo escribió:
        por eso llegan marcados y ninguno cuenta hasta que lo autorices.
      </p>
    </Card>
  );
}
