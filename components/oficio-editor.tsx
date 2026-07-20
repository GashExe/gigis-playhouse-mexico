"use client";

import { useEffect, useRef, useState } from "react";
import {
  Printer,
  ArrowsOutSimple,
  ArrowsInSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * Generador de oficios membretados. La hoja de abajo ES el oficio: se escribe
 * directo sobre el membrete y se manda a imprimir o a "Guardar como PDF". No se
 * guarda nada: es una herramienta para sacar el oficio del momento sin abrir Word.
 *
 * El contenido fluye como texto normal (no en cajas de tamaño fijo), así que si el
 * oficio pasa de una hoja, el "Atentamente" y la firma se recorren solos a la
 * siguiente. Para que el membrete salga en TODAS las hojas se usan dos piezas:
 *
 *  - la hoja se imprime SIN márgenes de @page, así que cada 11in de documento es
 *    exactamente una hoja de papel. Por eso el membrete puede ir de mosaico
 *    (`repeat-y` cada 8.5×11in): cae clavado en cada hoja, sin irse recorriendo.
 *  - los márgenes de arriba y abajo son el `thead` y el `tfoot` de una tabla, que
 *    el navegador repite en cada hoja. Así el texto nunca se encima con el logo
 *    ni con el pie de la dirección.
 *
 * Ambas piezas están verificadas imprimiendo a PDF, no supuestas: un membrete en
 * `position: fixed` NO se repite bien (se pinta descuadrado), y con márgenes de
 * @page el fondo se desfasa hoja con hoja porque el flujo deja de ir 1:1 con el
 * papel. Si alguien cambia esto, que lo compruebe imprimiendo dos hojas.
 */

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Campo que se escribe directo sobre la hoja. Es `contentEditable` y no un input:
 * así crece con el texto, se ajusta al ancho de lo escrito y —lo importante— el
 * cuerpo puede partirse entre hojas al imprimir (un `textarea` no se parte).
 * Acepta negritas con Ctrl/⌘+B, como en Word.
 *
 * Va sin control de React a propósito: React escribe el contenido inicial y ya no
 * lo vuelve a tocar, que es lo que necesita un campo editable para no perder el
 * cursor mientras se escribe.
 */
function Campo({
  children,
  placeholder,
  bloque = false,
  className = "",
}: {
  children?: React.ReactNode;
  placeholder?: string;
  /** true = párrafo que puede ocupar varios renglones; false = una línea. */
  bloque?: boolean;
  className?: string;
}) {
  const Tag = bloque ? "div" : "span";
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      className={`oficio-campo ${bloque ? "block" : "inline-block"} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Medidas del formato, en pulgadas. */
const ALTO_HOJA = 11;
const MARGEN_SUP = 2.25;
const MARGEN_INF = 0.7;
const PX = 96; // pulgada en px de CSS

export function OficioEditor() {
  const hoy = new Date();
  const [zoom, setZoom] = useState(1);
  const hojaRef = useRef<HTMLDivElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);

  /**
   * Ajusta el mosaico del membrete a un número entero de hojas antes de imprimir.
   *
   * Hace falta porque el fondo se recorta donde termina el texto: si el oficio
   * acaba a media hoja, el pie con la dirección sale cortado. Y no se puede
   * resolver sumándole una hoja de más —eso imprime una hoja en blanco al final—,
   * así que se calcula cuántas hojas ocupa de verdad: el alto del texto entre lo
   * que cabe en cada hoja, que es la hoja menos los dos márgenes (que el navegador
   * repite en todas).
   */
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

  // Ctrl+P también debe salir bien, no solo el botón.
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

  return (
    <div>
      {/* Barra de herramientas: no se imprime */}
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Button
          onClick={() => {
            ajustarMembrete();
            window.print();
          }}
        >
          <Printer weight="fill" className="size-4" />
          Imprimir o guardar PDF
        </Button>
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
        <p className="text-xs text-muted">
          Escribe directo sobre la hoja; con{" "}
          <span className="font-semibold text-ink">Ctrl/⌘+B</span> pones
          negritas. Al imprimir elige tamaño{" "}
          <span className="font-semibold text-ink">Carta</span>, márgenes{" "}
          <span className="font-semibold text-ink">ninguno</span> y activa{" "}
          <span className="font-semibold text-ink">gráficos de fondo</span>. Si
          el oficio pasa de una hoja, aquí lo verás de corrido: el reparto en
          hojas —con su membrete y la firma completa— se arma en la vista previa
          de impresión.
        </p>
      </div>

      {/* El zoom es solo de pantalla; al imprimir se anula por CSS. */}
      <div
        className="oficio-zoom mx-auto origin-top"
        style={{ width: "8.5in", transform: `scale(${zoom})` }}
      >
        <div className="oficio-hoja" ref={hojaRef}>
          {/* El membrete. Al imprimir se vuelve mosaico y sale en cada hoja. */}
          <div className="oficio-fondo" ref={fondoRef} aria-hidden />

          <table className="oficio-tabla">
            {/* Margen superior: el navegador lo repite en cada hoja, bajo el logo. */}
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
                  {/* Ubicación y fecha, en un solo renglón */}
                  <p className="text-right">
                    <Campo placeholder="Ciudad, Estado.">
                      Santiago de Querétaro, Querétaro.
                    </Campo>
                    {", a "}
                    <Campo placeholder="10">{hoy.getDate()}</Campo>
                    {" de "}
                    <Campo placeholder="Julio">{MESES[hoy.getMonth()]}</Campo>
                    {" del "}
                    <Campo placeholder="2026">{hoy.getFullYear()}</Campo>
                  </p>

                  {/* Número de oficio */}
                  <p className="text-right">
                    {"Oficio: "}
                    <Campo placeholder="1655/GMP/D/2026">
                      {`/GMP/D/${hoy.getFullYear()}`}
                    </Campo>
                  </p>

                  {/* Destinatario */}
                  <div className="mt-6">
                    <Campo placeholder="Nombre del contacto" bloque />
                    <Campo placeholder="Empresa" bloque />
                    <p>Presente.</p>
                  </div>

                  {/* Cuerpo del oficio */}
                  <Campo
                    bloque
                    placeholder="Por medio de la presente…"
                    className="oficio-cuerpo mt-5 text-justify"
                  />

                  {/* Firma. Se mantiene entera: si ya no cabe, pasa completa a la
              hoja siguiente en lugar de partirse a la mitad. */}
                  <div className="oficio-firma mt-5">
                    <p>Atentamente,</p>
                    <div className="mt-6 text-center">
                      <p>__________________________________</p>
                      <Campo placeholder="Nombre de quien firma" bloque>
                        Eva Patricia Barba Reynoso
                      </Campo>
                      <Campo placeholder="Cargo" bloque>
                        Directora General
                      </Campo>
                      <p>GiGi&apos;s Playhouse Mexico I.A.P</p>
                      <Campo
                        placeholder="Sitio web"
                        bloque
                        className="underline"
                      >
                        http://gigisplayhouse.org/mexico/
                      </Campo>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            {/* Margen inferior: deja libre el pie con la dirección, en cada hoja. */}
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
        /* En pantalla el membrete sale UNA vez: la hoja crece como un borrador
           continuo. No se repite aquí a propósito —en pantalla no hay saltos de
           página, así que un mosaico cada 11in caería en medio del texto y daría
           una idea falsa. Al imprimir sí se pone de mosaico (ver @media print). */
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
        /* Márgenes del formato: dejan libre el logo (arriba), el pie con la
           dirección (abajo) y la banda de manos (izquierda). */
        .oficio-margen-sup { height: 2.25in; }
        .oficio-margen-inf { height: 0.7in; }
        .oficio-contenido {
          padding: 0 0.8in 0 2in;
          vertical-align: top;
        }
        /* Espacio entre párrafos del cuerpo, como en el formato de Word. */
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
          /* Sin márgenes: cada 11in de documento = una hoja, que es lo que hace
             que el mosaico del membrete caiga clavado hoja tras hoja. */
          @page { size: letter; margin: 0; }

          /* El zoom es de pantalla. Además, un transform en un ancestro descoloca
             el fondo al imprimir, así que aquí se anula. */
          .oficio-zoom {
            transform: none !important;
            margin: 0 !important;
          }
          .oficio-hoja {
            min-height: 0;
            box-shadow: none;
          }
          /* El papel es blanco hasta el borde: sin esto se cuela el fondo de la
             plataforma en lo que sobra de la última hoja. */
          html, body { background: #fff !important; }
          /* Un membrete por hoja. El alto exacto lo pone ajustarMembrete(). */
          .oficio-fondo {
            background-repeat: repeat-y;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .oficio-campo:empty::before { content: ""; }
          .oficio-campo:focus { background: none; }
        }
      `}</style>
    </div>
  );
}
