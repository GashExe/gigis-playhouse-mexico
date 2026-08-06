/**
 * Una hoja carta con el membrete de la casa, para documentos que salen impresos y
 * se llenan o se firman a mano.
 *
 * El truco de la tabla es el mismo del editor de oficios (components/oficio-editor):
 * el contenido va dentro de una <table> cuyo thead y tfoot son los márgenes, para
 * que el navegador los repita en CADA hoja cuando el documento crece. Un div con
 * padding no lo hace: la segunda hoja se subiría encima del membrete.
 *
 * Está duplicado a propósito y no extraído del editor de oficios: aquel es un flujo
 * de documento con folio y aprobación, y tocarlo para ahorrar treinta líneas de CSS
 * arriesga algo que ya funciona. SI CAMBIA EL MEMBRETE, hay que cambiarlo en los dos.
 */
export function HojaMembretada({
  children,
  /** Impresión sobre papel membretado preimpreso: deja el espacio pero no pinta la imagen. */
  membrete = true,
  /** La última hoja no fuerza salto de página. */
  saltoDePagina = false,
}: {
  children: React.ReactNode;
  membrete?: boolean;
  saltoDePagina?: boolean;
}) {
  return (
    <div className={`doc-hoja ${saltoDePagina ? "doc-salto" : ""}`}>
      {membrete && <div aria-hidden className="doc-fondo" />}
      <table className="doc-tabla">
        <thead>
          <tr>
            <td>
              <div className="doc-margen-sup" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="doc-contenido">{children}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div className="doc-margen-inf" />
            </td>
          </tr>
        </tfoot>
      </table>
      <style>{`
        .doc-hoja {
          position: relative;
          width: 8.5in;
          min-height: 11in;
          margin: 0 auto 1.5rem;
          background: #fff;
          color: #111827;
          font-family: Calibri, "Segoe UI", system-ui, sans-serif;
          font-size: 11pt;
          line-height: 1.3;
          box-shadow: var(--shadow-lg);
        }
        .doc-fondo {
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
        .doc-tabla {
          position: relative;
          width: 100%;
          border-collapse: collapse;
        }
        .doc-margen-sup { height: 2.25in; }
        .doc-margen-inf { height: 0.7in; }
        .doc-contenido {
          padding: 0 0.8in;
          vertical-align: top;
        }

        @media print {
          @page { size: letter; margin: 0; }
          html, body { background: #fff !important; }
          .doc-hoja {
            min-height: 0;
            margin: 0 auto;
            box-shadow: none;
          }
          .doc-salto { break-after: page; }
          .doc-fondo {
            background-repeat: repeat-y;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
