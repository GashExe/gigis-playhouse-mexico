"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Printer,
  ArrowsOutSimple,
  ArrowsInSimple,
  FloppyDisk,
  SealCheck,
  Lock,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { saveOficio, approveOficio } from "@/lib/actions/oficios";

/**
 * Editor de oficios membretados con persistencia. La hoja de abajo ES el oficio: se
 * escribe directo sobre el membrete. A diferencia de antes, el oficio SE GUARDA y su
 * número lo asigna la dirección al aprobarlo; hasta entonces no se puede imprimir.
 *
 * Detalles del membrete (mosaico por hoja, márgenes como thead/tfoot de una tabla)
 * están verificados imprimiendo a PDF; si alguien los cambia, que lo compruebe con
 * dos hojas. Los campos van sin control de React (contentEditable): React escribe el
 * contenido inicial una vez y ya no lo toca, para no perder el cursor al escribir.
 */

type Zona = "DIRECCION" | "OPERACION";

type Oficio = {
  id: string;
  zona: Zona;
  status: "BORRADOR" | "APROBADO";
  year: number;
  folio: number | null;
  lugarFecha: string | null;
  destinatario: string | null;
  cuerpo: string;
  firmante: string | null;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Firma por defecto de un oficio de dirección (la de Eva). */
const FIRMA_DIRECCION =
  "<div>Eva Patricia Barba Reynoso</div>" +
  "<div>Directora General</div>" +
  "<div>GiGi's Playhouse Mexico I.A.P</div>" +
  '<div class="underline">http://gigisplayhouse.org/mexico/</div>';

/** Medidas del formato, en pulgadas. */
const ALTO_HOJA = 11;
const MARGEN_SUP = 2.25;
const MARGEN_INF = 0.7;
const PX = 96;

export function OficioEditor({
  oficio,
  proximoFolio,
  canApprove,
}: {
  oficio: Oficio;
  /** Folio que tomaría en cada zona al aprobarse (mayor emitido + 1). */
  proximoFolio: Record<Zona, number>;
  /** Solo la dirección (Eva) puede aprobar. */
  canApprove: boolean;
}) {
  const hoy = new Date();
  const aprobado = oficio.status === "APROBADO";
  const [zoom, setZoom] = useState(1);
  const [zona, setZona] = useState<Zona>(oficio.zona);
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  const hojaRef = useRef<HTMLDivElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);
  const lugarFechaRef = useRef<HTMLDivElement>(null);
  const destinatarioRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const firmanteRef = useRef<HTMLDivElement>(null);

  // Contenido inicial de los campos: se escribe UNA vez al montar.
  useEffect(() => {
    const lugarDefault = `Santiago de Querétaro, Querétaro., a ${hoy.getDate()} de ${
      MESES[hoy.getMonth()]
    } del ${hoy.getFullYear()}`;
    if (lugarFechaRef.current) {
      lugarFechaRef.current.innerText = oficio.lugarFecha ?? lugarDefault;
    }
    if (destinatarioRef.current) {
      destinatarioRef.current.innerHTML = oficio.destinatario ?? "";
    }
    if (cuerpoRef.current) {
      cuerpoRef.current.innerHTML = oficio.cuerpo ?? "";
    }
    if (firmanteRef.current) {
      firmanteRef.current.innerHTML =
        oficio.firmante ?? (oficio.zona === "DIRECCION" ? FIRMA_DIRECCION : "");
    }
    // Solo al montar / cuando cambia el oficio (tras aprobar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oficio.id, oficio.status]);

  const zonaCode = zona === "OPERACION" ? "O" : "D";
  const folioMostrar = aprobado ? oficio.folio : proximoFolio[zona];
  const numero = `${folioMostrar}/GMP/${zonaCode}/${oficio.year}`;

  function ajustarMembrete() {
    const hoja = hojaRef.current;
    const fondo = fondoRef.current;
    if (!hoja || !fondo) return;
    fondo.style.height = "";
    const margenes = (MARGEN_SUP + MARGEN_INF) * PX;
    const texto = hoja.scrollHeight - margenes;
    const porHoja = ALTO_HOJA * PX - margenes;
    const hojas = Math.max(1, Math.ceil(texto / porHoja));
    fondo.style.height = `${hojas * ALTO_HOJA * PX}px`;
  }

  useEffect(() => {
    const limpiar = () => {
      if (fondoRef.current) fondoRef.current.style.height = "";
    };
    window.addEventListener("beforeprint", ajustarMembrete);
    window.addEventListener("afterprint", limpiar);
    return () => {
      window.removeEventListener("beforeprint", ajustarMembrete);
      window.removeEventListener("afterprint", limpiar);
    };
  }, []);

  function leerCampos() {
    return {
      zona,
      lugarFecha: lugarFechaRef.current?.innerText ?? "",
      destinatario: destinatarioRef.current?.innerHTML ?? "",
      cuerpo: cuerpoRef.current?.innerHTML ?? "",
      firmante: firmanteRef.current?.innerHTML ?? "",
    };
  }

  function guardar() {
    startTransition(async () => {
      await saveOficio(oficio.id, leerCampos());
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    });
  }

  function aprobar() {
    startTransition(async () => {
      // Guarda primero para no aprobar una versión vieja, luego asigna folio.
      await saveOficio(oficio.id, leerCampos());
      await approveOficio(oficio.id);
    });
  }

  function imprimir() {
    ajustarMembrete();
    window.print();
  }

  return (
    <div>
      {/* Barra de herramientas: no se imprime */}
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        {!aprobado && (
          <>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              Zona
              <select
                value={zona}
                onChange={(e) => setZona(e.target.value as Zona)}
                className="h-9 rounded-[var(--radius-input)] border border-border bg-surface px-2 text-sm"
              >
                <option value="DIRECCION">Dirección</option>
                <option value="OPERACION">Operación</option>
              </select>
            </label>
            <Button variant="secondary" onClick={guardar} loading={pending}>
              <FloppyDisk weight="fill" className="size-4" />
              Guardar
            </Button>
            {guardado && (
              <span className="text-xs font-semibold text-success-strong">Guardado ✓</span>
            )}
            {canApprove && (
              <Button onClick={aprobar} loading={pending}>
                <SealCheck weight="fill" className="size-4" />
                Aprobar y asignar folio
              </Button>
            )}
          </>
        )}

        {aprobado ? (
          <Button onClick={imprimir}>
            <Printer weight="fill" className="size-4" />
            Imprimir o guardar PDF
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-warning bg-warning-weak/40 px-3 py-2 text-xs font-semibold text-warning-strong">
            <Lock weight="fill" className="size-4" />
            La impresión se habilita cuando la dirección lo apruebe
          </span>
        )}

        <button
          type="button"
          onClick={() => setZoom((z) => (z === 1 ? 0.72 : 1))}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {zoom === 1 ? (
            <ArrowsInSimple className="size-4" />
          ) : (
            <ArrowsOutSimple className="size-4" />
          )}
          {zoom === 1 ? "Ver hoja completa" : "Tamaño real"}
        </button>
      </div>

      {!aprobado && (
        <p className="mb-4 text-xs text-muted print:hidden">
          Escribe directo sobre la hoja; con{" "}
          <span className="font-semibold text-ink">Ctrl/⌘+B</span> pones negritas. El
          número que ves ({numero}) es el que tomará al aprobarse; puede cambiar si se
          aprueba otro oficio de la misma zona antes. Al imprimir elige tamaño{" "}
          <span className="font-semibold text-ink">Carta</span>, márgenes{" "}
          <span className="font-semibold text-ink">ninguno</span> y activa{" "}
          <span className="font-semibold text-ink">gráficos de fondo</span>.
        </p>
      )}

      {/* El zoom es solo de pantalla; al imprimir se anula por CSS. */}
      <div
        className="oficio-zoom mx-auto origin-top"
        style={{ width: "8.5in", transform: `scale(${zoom})` }}
      >
        <div className={`oficio-hoja ${aprobado ? "" : "oficio-draft"}`} ref={hojaRef}>
          {/* El membrete. Al imprimir se vuelve mosaico y sale en cada hoja. */}
          <div className="oficio-fondo" ref={fondoRef} aria-hidden />

          <table className="oficio-tabla">
            <thead>
              <tr>
                <td>
                  <div className="oficio-margen-sup" />
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="oficio-contenido">
                  {/* Ubicación y fecha */}
                  <div
                    ref={lugarFechaRef}
                    contentEditable={!aprobado}
                    suppressContentEditableWarning
                    data-ph="Ciudad, Estado., a 10 de Julio del 2026"
                    className="oficio-campo block text-right"
                  />

                  {/* Número de oficio (no editable: lo define la zona y el folio) */}
                  <p className="mt-1 text-right">
                    Oficio: <span className="font-semibold">{numero}</span>
                  </p>

                  {/* Destinatario */}
                  <div className="mt-6">
                    <div
                      ref={destinatarioRef}
                      contentEditable={!aprobado}
                      suppressContentEditableWarning
                      data-ph="Nombre del contacto y empresa"
                      className="oficio-campo block"
                    />
                    <p>Presente.</p>
                  </div>

                  {/* Cuerpo del oficio */}
                  <div
                    ref={cuerpoRef}
                    contentEditable={!aprobado}
                    suppressContentEditableWarning
                    data-ph="Por medio de la presente…"
                    className="oficio-campo oficio-cuerpo mt-5 block text-justify"
                  />

                  {/* Firma: se mantiene entera (no se parte a la mitad entre hojas). */}
                  <div className="oficio-firma mt-5">
                    <p>Atentamente,</p>
                    <div className="mt-6 text-center">
                      <p>__________________________________</p>
                      <div
                        ref={firmanteRef}
                        contentEditable={!aprobado}
                        suppressContentEditableWarning
                        data-ph="Nombre y cargo de quien firma"
                        className="oficio-campo block"
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <div className="oficio-margen-inf" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`
        .oficio-hoja {
          position: relative;
          width: 8.5in;
          min-height: 11in;
          background: #fff;
          color: #111;
          font-family: Calibri, "Segoe UI", system-ui, sans-serif;
          font-size: 11pt;
          line-height: 1.22;
          box-shadow: var(--shadow-lg);
        }
        .oficio-fondo {
          position: absolute;
          top: 0;
          left: 0;
          width: 8.5in;
          height: 100%;
          background-image: url("/membrete-gigis.jpg");
          background-size: 8.5in 11in;
          background-repeat: no-repeat;
          pointer-events: none;
        }
        .oficio-tabla {
          position: relative;
          width: 100%;
          border-collapse: collapse;
        }
        .oficio-margen-sup { height: 2.25in; }
        .oficio-margen-inf { height: 0.7in; }
        .oficio-contenido {
          padding: 0 0.8in 0 2in;
          vertical-align: top;
        }
        .oficio-cuerpo { min-height: 2.5in; }
        .oficio-cuerpo p { margin: 0 0 0.45em; }
        .oficio-cuerpo p:last-child { margin-bottom: 0; }
        .oficio-firma { break-inside: avoid; }

        .oficio-campo:focus {
          outline: none;
          background: #fff8d8;
        }
        .oficio-campo:empty::before {
          content: attr(data-ph);
          color: #9ca3af;
        }

        @media print {
          @page { size: letter; margin: 0; }
          .oficio-zoom {
            transform: none !important;
            margin: 0 !important;
          }
          .oficio-hoja {
            min-height: 0;
            box-shadow: none;
          }
          html, body { background: #fff !important; }
          .oficio-fondo {
            background-repeat: repeat-y;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .oficio-campo:empty::before { content: ""; }
          .oficio-campo:focus { background: none; }
          /* Un borrador sin aprobar no debe imprimirse como oficio válido. */
          .oficio-draft::after {
            content: "BORRADOR · SIN FOLIO";
            position: absolute;
            top: 45%;
            left: 0;
            right: 0;
            text-align: center;
            transform: rotate(-24deg);
            font-size: 48pt;
            font-weight: 800;
            color: rgba(200, 0, 0, 0.18);
            letter-spacing: 0.1em;
          }
        }
      `}</style>
    </div>
  );
}
