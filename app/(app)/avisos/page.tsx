import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { listAnnouncements } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementsManager } from "@/components/announcements-manager";

export const metadata = { title: "Avisos" };

export default async function AvisosPage() {
  // Los avisos a las familias son voz de la dirección.
  await requireRole("DIRECTORA");

  const [students, announcements] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVO" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    listAnnouncements(),
  ]);

  return (
    <div>
      <PageHeader
        title="Avisos a las familias"
        subtitle="Publica anuncios para todos los participantes activos o solo para quien elijas. Aparecen en el espacio de cada familia."
      />
      <AnnouncementsManager
        students={students}
        announcements={announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          toAllActive: a.toAllActive,
          createdAt: a.createdAt.toISOString(),
          authorName: a.author?.name ?? null,
          recipients: a.recipients.map((r) => r.student),
        }))}
      />
    </div>
  );
}
