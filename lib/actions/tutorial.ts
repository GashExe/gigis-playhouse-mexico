"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

/**
 * Marca que esta cuenta ya vio el video tutorial. A partir de aquí el tutorial deja
 * de abrirse solo al entrar, y queda a la mano desde la pantalla de inicio.
 *
 * La marca vive en la cuenta y no en el navegador a propósito: si la maestra entra
 * desde el celular y luego desde la computadora de Gigi's, el video ya lo vio ella,
 * no ese aparato. Cualquier cuenta con sesión puede marcar la suya (incluido el rol
 * Lector: cerrar su propio tutorial no es modificar la plataforma).
 */
export async function markTutorialSeen() {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { tutorialSeenAt: new Date() },
  });
}
