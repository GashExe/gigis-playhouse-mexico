import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  // Cada quien a su lugar: alumnos a su espacio, personal al panel.
  redirect(session?.role === "ALUMNO" ? "/mi-espacio" : "/panel");
}
