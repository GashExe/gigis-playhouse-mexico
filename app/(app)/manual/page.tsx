import { getCurrentUser } from "@/lib/dal";
import { canManage, isReadOnly } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import {
  ManualEntrar,
  ManualTerapeuta,
  ManualCoordinacion,
  ManualDireccion,
} from "@/components/manual-sections";

export const metadata = { title: "Manual" };

/**
 * Manual de uso del equipo. Cada quien ve las secciones de su rol: las terapeutas lo
 * docente; coordinación y operación además la gestión; la directora todo. El lector,
 * que ve toda la plataforma, también lee el manual completo.
 */
export default async function ManualPage() {
  const me = await getCurrentUser();
  const soloLectura = isReadOnly(me.role);
  const veGestion = canManage(me.role) || soloLectura;
  const veDireccion = me.role === "DIRECTORA" || soloLectura;

  const subtitle = soloLectura
    ? "Guía completa de la plataforma. Tu cuenta ve todo y no modifica nada."
    : veDireccion
      ? "Guía completa de la plataforma: consulta, calificaciones, gestión y dirección."
      : veGestion
        ? "Guía de gestión: padrón, inscripciones, actividades y ciclos."
        : "Guía del trabajo docente: consultar expedientes y calificar a tu grupo.";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Manual de la plataforma" subtitle={subtitle} />
      <div className="space-y-8">
        <ManualEntrar />
        <ManualTerapeuta soloAsignados={!veGestion} />
        {veGestion && <ManualCoordinacion />}
        {veDireccion && <ManualDireccion />}
      </div>
    </div>
  );
}
