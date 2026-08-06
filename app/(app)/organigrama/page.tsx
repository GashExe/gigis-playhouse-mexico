import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/dal";
import { getOrgChart, listOrgNodes } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { OrgChart } from "@/components/org-chart";

export const metadata = { title: "Organigrama" };

/**
 * Cómo está organizada la casa. Lo ve todo el equipo; solo la dirección lo arma.
 */
export default async function OrganigramaPage() {
  const me = await requireStaff();
  const puedeEditar = me.role === "DIRECTORA";

  const [tree, flat, accounts] = await Promise.all([
    getOrgChart(),
    listOrgNodes(),
    prisma.user.findMany({
      where: { active: true, role: { not: "ALUMNO" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Organigrama"
        subtitle={
          puedeEditar
            ? "Cómo está organizada la casa. Puedes poner también a quien no tiene cuenta en la plataforma: patronato, voluntariado, administración."
            : "Cómo está organizada la casa."
        }
      />
      <OrgChart tree={tree} flat={flat} accounts={accounts} canEdit={puedeEditar} />
    </div>
  );
}
