import { getCurrentUser } from "@/lib/dal";
import { PageHeader } from "@/components/ui/page-header";
import {
  ManualEntrar,
  ManualMaestro,
  ManualCoordinacion,
  ManualDireccion,
} from "@/components/manual-sections";

export const metadata = { title: "Manual" };

/**
 * Manual de uso del personal. Cada quien ve solo las secciones de su rol:
 * maestras lo docente; coordinación además las plantillas; la directora todo.
 */
export default async function ManualPage() {
  const me = await getCurrentUser();
  const veCoordinacion = me.role === "COORDINADOR" || me.role === "DIRECTORA";
  const veDireccion = me.role === "DIRECTORA";

  const subtitle = veDireccion
    ? "Guía completa de la plataforma: consulta, calificaciones, gestión y dirección."
    : veCoordinacion
      ? "Guía de calificaciones, gestión del padrón, actividades y plantillas."
      : "Guía del trabajo docente: consultar expedientes y calificar a tu grupo.";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Manual de la plataforma" subtitle={subtitle} />
      <div className="space-y-8">
        <ManualEntrar />
        <ManualMaestro soloAsignados={!veCoordinacion} />
        {veCoordinacion && <ManualCoordinacion />}
        {veDireccion && <ManualDireccion />}
      </div>
    </div>
  );
}
