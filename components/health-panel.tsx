import Link from "next/link";
import {
  Heartbeat,
  PencilSimple,
  Warning,
  Phone,
  Pill,
  Drop,
  Stethoscope,
  ForkKnife,
  HandHeart,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";

type Health = {
  bloodType: string | null;
  allergies: string | null;
  medications: string | null;
  medicalConditions: string | null;
  therapies: string | null;
  dietaryRestrictions: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  notes: string | null;
};

/**
 * Historial médico del participante. Lo llena el tutor en su onboarding, o la
 * directora desde aquí cuando el tutor todavía no ha entrado.
 */
export function HealthPanel({
  studentId,
  health,
  canEdit = true,
}: {
  studentId: string;
  health: Health | null;
  /** La maestra consulta la salud pero no la captura ni la edita. */
  canEdit?: boolean;
}) {
  const href = `/estudiantes/${studentId}/salud`;

  if (!health) {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-surface-2 text-muted">
            <Heartbeat weight="fill" className="size-[1.05rem]" />
          </span>
          <h2 className="text-sm font-bold text-ink">Historial médico</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {canEdit
            ? "Sin registrar. Lo llena el tutor en su primer ingreso, o puedes capturarlo tú."
            : "Sin registrar. Lo llena el tutor en su primer ingreso."}
        </p>
        {canEdit && (
        <Link
          href={href}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border border-border-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <PencilSimple weight="bold" className="size-4" />
          Capturar historial
        </Link>
        )}
      </Card>
    );
  }

  const alergias = health.allergies?.trim();
  // "Ninguna" es una respuesta válida y no debe gritar como una alerta.
  const sinAlergias = !alergias || /^(ninguna?|no|n\/a)\.?$/i.test(alergias);

  const rows: { icon: typeof Drop; label: string; value: string | null }[] = [
    { icon: Drop, label: "Tipo de sangre", value: health.bloodType },
    { icon: Pill, label: "Medicamentos", value: health.medications },
    { icon: Stethoscope, label: "Condiciones médicas", value: health.medicalConditions },
    { icon: HandHeart, label: "Terapias externas", value: health.therapies },
    { icon: ForkKnife, label: "Restricciones alimentarias", value: health.dietaryRestrictions },
    {
      icon: Stethoscope,
      label: "Médico de cabecera",
      value: [health.doctorName, health.doctorPhone].filter(Boolean).join(" · ") || null,
    },
  ].filter((r) => r.value);

  const emergencia = [health.emergencyName, health.emergencyRelation]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-input)] bg-surface-2 text-muted">
          <Heartbeat weight="fill" className="size-[1.05rem]" />
        </span>
        <h2 className="text-sm font-bold text-ink">Historial médico</h2>
        {canEdit && (
          <Link
            href={href}
            aria-label="Editar historial médico"
            title="Editar historial médico"
            className="ml-auto flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <PencilSimple className="size-[1.05rem]" />
          </Link>
        )}
      </div>

      {/* Alergias primero y destacadas: es el dato que hay que ver de un vistazo. */}
      {!sinAlergias && (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-input)] border border-border bg-danger-weak px-3 py-2">
          <Warning weight="fill" className="mt-0.5 size-4 shrink-0 text-danger-strong" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-danger-strong">Alergias</p>
            <p className="break-words text-sm font-semibold text-ink">{alergias}</p>
          </div>
        </div>
      )}
      {sinAlergias && (
        <p className="mb-3 text-sm text-muted">
          Alergias: <span className="font-semibold text-ink">Ninguna</span>
        </p>
      )}

      {/* Contacto de emergencia: el otro dato que se busca con prisa. */}
      {emergencia && (
        <div className="mb-3 flex items-start gap-3 rounded-[var(--radius-input)] bg-surface-2 px-3 py-2">
          <Phone weight="fill" className="mt-0.5 size-4 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-subtle">Contacto de emergencia</p>
            <p className="break-words text-sm font-semibold text-ink">{emergencia}</p>
            {health.emergencyPhone && (
              <a
                href={`tel:${health.emergencyPhone}`}
                className="select-all text-sm font-bold text-primary hover:underline"
              >
                {health.emergencyPhone}
              </a>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="space-y-3">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-surface-2 text-muted">
                  <Icon className="size-[1.05rem]" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-subtle">{row.label}</dt>
                  <dd className="break-words text-sm font-semibold text-ink">{row.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      )}

      {health.notes && (
        <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-sm leading-relaxed text-muted">
          {health.notes}
        </p>
      )}
    </Card>
  );
}
