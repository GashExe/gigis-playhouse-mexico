import { requireStaff } from "@/lib/dal";
import { AppNav } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Solo personal (DIRECTORA/MAESTRA). Un ALUMNO se redirige a /mi-espacio.
  const user = await requireStaff();

  return (
    <div className="min-h-[100dvh]">
      {/* Al imprimir, el armazón de la app no va al papel: solo el contenido. */}
      <div className="print:hidden">
        <AppNav name={user.name} role={user.role} />
        <CommandPalette />
      </div>
      <div className="lg:pl-64 print:pl-0">
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-6 lg:px-10 lg:pt-9 lg:pb-9 print:m-0 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
