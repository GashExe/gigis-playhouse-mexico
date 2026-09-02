import { requireRole } from "@/lib/dal";
import { coordinationScope, isReadOnly } from "@/lib/roles";
import { getActiveCycle, listWaitlistByProgram } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { WaitlistBoard } from "@/components/waitlist-board";

export const metadata = { title: "Lista de espera" };

/**
 * Quién está formado esperando lugar, por actividad y en orden de llegada. Darle
 * lugar lo inscribe en el mismo movimiento.
 */
export default async function ListaEsperaPage() {
  const me = await requireRole("DIRECTORA", "COORDINADOR", "GESTORA_OPERACIONES");
  const soloLectura = isReadOnly(me.role);

  const cycle = await getActiveCycle();
  const groups = cycle
    ? await listWaitlistByProgram(cycle.id, coordinationScope(me))
    : [];
  const total = groups.reduce((n, g) => n + g.requests.length, 0);

  return (
    <div>
      <PageHeader
        title="Lista de espera"
        subtitle={
          cycle
            ? `${total} solicitud${total === 1 ? "" : "es"} en el ciclo ${cycle.label}. Están en orden de llegada: darle lugar a alguien lo inscribe de una vez.`
            : "No hay un ciclo activo todavía."
        }
      />
      <WaitlistBoard
        canDecide={!soloLectura}
        groups={groups.map((g) => ({
          program: g.program,
          occupied: g.occupied,
          capacity: g.capacity,
          requests: g.requests.map((r) => ({
            id: r.id,
            requestedAt: r.requestedAt.toISOString(),
            message: r.message,
            ageOk: r.ageOk,
            load: r.load,
            student: {
              id: r.student.id,
              firstName: r.student.firstName,
              lastName: r.student.lastName,
              matricula: r.student.matricula,
              birthDate: r.student.birthDate ? r.student.birthDate.toISOString() : null,
            },
          })),
        }))}
      />
    </div>
  );
}
