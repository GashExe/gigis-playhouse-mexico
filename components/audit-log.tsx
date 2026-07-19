import Link from "next/link";
import {
  Star,
  Stack,
  ArrowFatLinesUp,
  GraduationCap,
  UserPlus,
  UserMinus,
  PencilSimple,
  ToggleLeft,
  ArrowsClockwise,
  Key,
  ClockCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { haceTiempo } from "@/lib/format";
import { roleLabel } from "@/lib/utils";

export type AuditEntry = {
  id: string;
  action: string;
  summary: string;
  actorName: string;
  actorRole: string | null;
  createdAt: Date;
  student: { id: string; firstName: string; lastName: string } | null;
};

/** Ícono y tono según la familia de la acción. */
function actionStyle(action: string): {
  icon: React.ComponentType<{ weight?: "fill" | "bold" | "regular"; className?: string }>;
  cls: string;
} {
  if (action === "calificacion.tema") return { icon: Star, cls: "bg-primary-weak text-primary" };
  if (action === "nivel.promover") return { icon: ArrowFatLinesUp, cls: "bg-success-weak text-success-strong" };
  if (action === "nivel.ubicar") return { icon: Stack, cls: "bg-info-weak text-info" };
  if (action === "nivel.quitar") return { icon: GraduationCap, cls: "bg-surface-2 text-muted" };
  if (action === "inscripcion.alta") return { icon: UserPlus, cls: "bg-success-weak text-success-strong" };
  if (action === "inscripcion.baja") return { icon: UserMinus, cls: "bg-danger-weak text-danger-strong" };
  if (action === "inscripcion.estado") return { icon: ToggleLeft, cls: "bg-warning-weak text-warning-strong" };
  if (action === "alumno.alta") return { icon: UserPlus, cls: "bg-success-weak text-success-strong" };
  if (action === "alumno.baja") return { icon: UserMinus, cls: "bg-danger-weak text-danger-strong" };
  if (action === "alumno.editar") return { icon: PencilSimple, cls: "bg-info-weak text-info" };
  if (action === "alumno.estado") return { icon: ToggleLeft, cls: "bg-warning-weak text-warning-strong" };
  if (action === "ciclo.continuidad") return { icon: ArrowsClockwise, cls: "bg-accent-weak text-accent-strong" };
  if (action === "acceso.repone-contrasena") return { icon: Key, cls: "bg-warning-weak text-warning-strong" };
  return { icon: ClockCounterClockwise, cls: "bg-surface-2 text-muted" };
}

/**
 * Lista de movimientos de la bitácora. Presentacional: la usa la página /bitacora
 * y el expediente del participante (dirección). Si `showStudent` está activo, cada
 * línea enlaza al expediente del participante involucrado.
 */
export function AuditLog({
  entries,
  showStudent = true,
}: {
  entries: AuditEntry[];
  showStudent?: boolean;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)]">
      {entries.map((e) => {
        const { icon: Icon, cls } = actionStyle(e.action);
        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] ${cls}`}
            >
              <Icon weight="fill" className="size-[1.05rem]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{e.summary}</p>
              <p className="mt-0.5 text-xs text-subtle">
                <span className="font-semibold text-muted">{e.actorName}</span>
                {e.actorRole ? ` · ${roleLabel(e.actorRole)}` : ""} · {haceTiempo(e.createdAt)}
                {showStudent && e.student ? (
                  <>
                    {" · "}
                    <Link
                      href={`/estudiantes/${e.student.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {e.student.firstName} {e.student.lastName}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
