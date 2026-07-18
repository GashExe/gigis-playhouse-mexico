import { getCurrentUser } from "@/lib/dal";
import {
  listPrograms,
  listTeachers,
  listCycles,
  getActiveCycle,
  listTemplateSources,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ProgramsManager } from "@/components/programs-manager";
import { CycleBar } from "@/components/cycle-bar";
import { CycleOffer } from "@/components/cycle-offer";
import { listPresets } from "@/lib/templates";

export const metadata = { title: "Programas" };

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const { ciclo } = await searchParams;
  const [cycles, activeCycle, me] = await Promise.all([
    listCycles(),
    getActiveCycle(),
    getCurrentUser(),
  ]);

  // Se ve el ciclo pedido; si no hay o no existe, el activo.
  const selected =
    cycles.find((c) => c.id === ciclo) ?? activeCycle ?? cycles[0] ?? null;

  const [programs, teachers, allPrograms, presets, copySources] = await Promise.all([
    selected ? listPrograms(selected.id) : listPrograms(),
    listTeachers(),
    // La oferta se arma eligiendo de TODOS los programas, no solo de los del ciclo.
    listPrograms(),
    listPresets(),
    listTemplateSources(),
  ]);

  const isDirectora = me.role === "DIRECTORA";
  const canManage = me.role !== "MAESTRA";
  // La maestra solo ve los programas a su cargo; gestión ve la oferta completa.
  const visiblePrograms = canManage
    ? programs
    : programs.filter((prog) => prog.teacherId === me.id);

  return (
    <div>
      <PageHeader
        title="Programas y actividades"
        subtitle={
          canManage
            ? "Cada programa es una actividad con horario, cupo y un maestro a cargo."
            : "Los programas a tu cargo en este ciclo. Desde aquí se califica a tu grupo."
        }
      />

      {selected && (
        <CycleBar
          cycles={cycles.map((c) => ({
            id: c.id,
            label: c.label,
            active: c.active,
            programCount: allPrograms.filter((p) =>
              p.cycles.some((x) => x.id === c.id),
            ).length,
          }))}
          selectedId={selected.id}
          canActivate={isDirectora}
        />
      )}

      {isDirectora && selected && (
        <CycleOffer
          cycleId={selected.id}
          cycleLabel={selected.label}
          programs={allPrograms.map((p) => ({
            id: p.id,
            name: p.name,
            area: p.area,
            color: p.color,
            offered: p.cycles.some((x) => x.id === selected.id),
            enrollments: p._count.enrollments,
          }))}
        />
      )}

      <ProgramsManager
        programs={visiblePrograms}
        teachers={teachers}
        cycleLabel={selected?.label}
        canEditTemplate={isDirectora || me.role === "COORDINADOR"}
        canManage={canManage}
        presets={presets}
        copySources={copySources}
      />
    </div>
  );
}
