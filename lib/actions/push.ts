"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { notificarDispositivo } from "@/lib/push";

/**
 * Alta y baja de la suscripción a notificaciones de ESTE dispositivo. La llama el
 * aviso "Agrega a Gigi's como app" cuando la familia acepta el permiso.
 */

type SubscriptionJSON = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

export async function savePushSubscription(
  sub: SubscriptionJSON,
  userAgent: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false };

  // Por endpoint: si en ese celular antes entró otra cuenta, el dispositivo pasa a
  // la cuenta que acaba de aceptar (las notificaciones son de quien lo usa ahora).
  const yaEstaba = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth, userAgent: userAgent.slice(0, 300) },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent: userAgent.slice(0, 300) },
  });
  // Bienvenida solo la primera vez en este dispositivo: así la familia comprueba
  // al momento que sí le llegan (y no cada vez que abre la app).
  if (yaEstaba?.userId !== user.id) {
    notificarDispositivo(endpoint, {
      title: "Notificaciones activadas",
      body: "Así te llegarán los avisos de Gigi's: clases, anuncios, anotaciones y donativos.",
      url: "/mi-espacio",
      tag: "bienvenida",
    });
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}
