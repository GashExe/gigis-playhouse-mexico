import { requireRole } from "@/lib/dal";
import { listUsers } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { UsersManager } from "@/components/users-manager";

export const metadata = { title: "Equipo" };

export default async function UsersPage() {
  const me = await requireRole("DIRECTORA");
  const users = await listUsers();
  // La contraseña inicial es confidencial: la ve la directora y nadie más (al rol
  // Lector esta pantalla se le muestra, y ahí no tiene nada que hacer una contraseña).
  const esDirectora = me.role === "DIRECTORA";

  return (
    <div>
      <PageHeader
        title="Equipo"
        subtitle="Cuentas del equipo. Solo la directora puede administrarlas."
      />
      <UsersManager
        users={users.map((u) => ({
          ...u,
          initialPassword: esDirectora ? u.initialPassword : null,
        }))}
        currentUserId={me.id}
        canManage={esDirectora}
      />
    </div>
  );
}
