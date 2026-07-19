import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { listAuditLog } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AuditLog } from "@/components/audit-log";

export const metadata = { title: "Bitácora" };

export default async function BitacoraPage() {
  // La bitácora es un control de dirección: quién movió qué en la plataforma.
  await requireRole("DIRECTORA");
  const entries = await listAuditLog({ take: 200 });

  return (
    <div>
      <PageHeader
        title="Bitácora de cambios"
        subtitle="Quién movió qué: calificaciones, inscripciones, niveles y datos de los participantes. Solo la dirección la ve."
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise weight="fill" className="size-6" />}
          title="Todavía no hay movimientos registrados"
          description="En cuanto el equipo empiece a calificar, inscribir o editar, cada cambio quedará aquí con su autor y su fecha."
        />
      ) : (
        <AuditLog entries={entries} />
      )}
    </div>
  );
}
