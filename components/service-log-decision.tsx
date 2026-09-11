import { CheckCircle, XCircle, Clock, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { decideServiceLog, updateServiceLogHours } from "@/lib/actions/servicio";
import { Button } from "@/components/ui/button";
import { horasLabel } from "@/lib/servicio";

/**
 * Los botones con los que la coordinación resuelve un reporte de horas.
 *
 * Autorizar es un botón y ya: es lo que pasa en casi todos los casos y pedir una
 * razón para lo normal solo hace que nadie escriba nada. Recortar las horas o
 * rechazar sí piden abrir el detalle y escribir por qué, porque eso es lo que el
 * prestador va a leer cuando no le cuadre su constancia.
 *
 * Va en el servidor a propósito: son formularios sueltos, sin estado que guardar
 * entre uno y otro, y así funciona también con el JavaScript apagado.
 */
export function ServiceLogDecision({
  id,
  reportedMinutes,
  rawHours,
  status,
}: {
  id: string;
  reportedMinutes: number;
  rawHours: string | null;
  status: "PENDIENTE" | "AUTORIZADO" | "NO_AUTORIZADO";
}) {
  // Las horas que no se dejaron leer al importar la hoja vieja entraron en cero.
  // Autorizar un cero no le sirve a nadie: primero hay que poner el número bueno.
  if (rawHours) {
    return (
      <div className="rounded-[var(--radius-control)] border border-warning-weak bg-warning-weak/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-warning-strong">
          <PencilSimple className="size-3.5" />
          Estas horas hay que capturarlas
        </p>
        <p className="mt-1 text-xs text-muted">
          En el formulario se escribió «{rawHours}», que no es una cantidad de horas.
          Escribe cuántas fueron para poder autorizarlas.
        </p>
        <form action={updateServiceLogHours} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="hours"
            required
            placeholder="Ej. 6, 8.5 o 10:30"
            className="h-9 flex-1 rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="secondary">
            Guardar horas
          </Button>
        </form>
      </div>
    );
  }

  if (status !== "PENDIENTE") {
    return (
      <form action={decideServiceLog}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="PENDIENTE" />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-subtle transition-colors hover:text-ink"
        >
          <Clock className="size-3.5" />
          Regresar a revisión
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={decideServiceLog}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="AUTORIZADO" />
          <Button type="submit" size="sm">
            <CheckCircle weight="fill" className="size-4" />
            Autorizar {horasLabel(reportedMinutes)}
          </Button>
        </form>

        <details className="group">
          <summary className="cursor-pointer list-none rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink">
            Autorizar menos horas o no autorizar
          </summary>
          <div className="mt-2 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3">
            <form action={decideServiceLog} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="decision" value="AUTORIZADO" />
              <label className="block text-xs font-semibold text-ink">
                Autorizar solo estas horas
                <input
                  name="approvedHours"
                  required
                  placeholder={`Menos de ${horasLabel(reportedMinutes)}`}
                  className="mt-1 h-9 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm font-normal"
                />
              </label>
              <input
                name="decisionNote"
                required
                placeholder="Por qué se le cuentan menos (lo lee el prestador)"
                className="h-9 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm"
              />
              <Button type="submit" size="sm" variant="secondary">
                Autorizar con recorte
              </Button>
            </form>

            <form action={decideServiceLog} className="space-y-2 border-t border-border pt-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="decision" value="NO_AUTORIZADO" />
              <input
                name="decisionNote"
                required
                placeholder="Por qué no se autoriza (lo lee el prestador)"
                className="h-9 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3 text-sm"
              />
              <Button type="submit" size="sm" variant="danger">
                <XCircle weight="fill" className="size-4" />
                No autorizar
              </Button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
