import { requireRole } from "@/lib/dal";
import { listUsers } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { UsersManager } from "@/components/users-manager";

export const metadata = { title: "Equipo" };

export default async function UsersPage() {
  const me = await requireRole("DIRECTORA");
  const users = await listUsers();

  return (
    <div>
      <PageHeader
        title="Equipo"
        subtitle="Cuentas del equipo. Solo la directora puede administrarlas."
      />
      <UsersManager users={users} currentUserId={me.id} />
    </div>
  );
}
