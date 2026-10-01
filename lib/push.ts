import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Notificaciones al celular de las familias (Web Push). El navegador guarda una
 * suscripción por dispositivo (tabla PushSubscription) y aquí se le manda el aviso.
 *
 * Reglas de la casa:
 * - Nunca tumba la acción que lo dispara: si algo falla, se registra y se sigue.
 * - Se manda DESPUÉS de responder (`after`), para que publicar un anuncio a 150
 *   familias no deje a la directora esperando.
 * - Sin llaves VAPID configuradas no hace nada (por ejemplo, en una copia local).
 */

export type PushPayload = {
  title: string;
  body: string;
  /** A dónde lleva al tocarla (ruta interna, ej. "/mi-espacio/mensajes"). */
  url?: string;
  /** Avisos con la misma etiqueta se reemplazan en vez de apilarse. */
  tag?: string;
};

let configurado: boolean | null = null;

function configurar(): boolean {
  if (configurado !== null) return configurado;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configurado = false;
    return false;
  }
  // El "subject" es un contacto para los servicios de push (Google, Apple, Mozilla)
  // por si una notificación da problemas.
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://gigisplayhouse.org",
    publicKey,
    privateKey,
  );
  configurado = true;
  return true;
}

export function pushDisponible(): boolean {
  return configurar();
}

async function enviarAUsuarios(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  await enviar({ userId: { in: [...new Set(userIds)] } }, payload);
}

async function enviar(
  where: { userId?: { in: string[] }; endpoint?: string },
  payload: PushPayload,
): Promise<void> {
  if (!configurar()) return;
  const subs = await prisma.pushSubscription.findMany({
    where,
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const cuerpo = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/mi-espacio",
    tag: payload.tag,
  });
  const vencidas: string[] = [];
  const entregadas: string[] = [];

  // De a 20 para no abrir cientos de conexiones a la vez.
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(
      subs.slice(i, i + 20).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            cuerpo,
            { TTL: 60 * 60 * 24 * 3, urgency: "normal" }, // si el cel está apagado, hasta 3 días
          );
          entregadas.push(s.id);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: el dispositivo ya no existe o quitó el permiso.
          if (status === 404 || status === 410) vencidas.push(s.id);
          else console.error("No se pudo mandar la notificación:", status ?? e);
        }
      }),
    );
  }

  await Promise.all([
    vencidas.length ? prisma.pushSubscription.deleteMany({ where: { id: { in: vencidas } } }) : null,
    entregadas.length
      ? prisma.pushSubscription.updateMany({
          where: { id: { in: entregadas } },
          data: { lastSentAt: new Date() },
        })
      : null,
  ]);
}

/** Programa el envío para después de responder. Nunca lanza. */
function programar(trabajo: () => Promise<string[]>, payload: PushPayload) {
  if (!configurar()) return;
  after(async () => {
    try {
      await enviarAUsuarios(await trabajo(), payload);
    } catch (e) {
      console.error("Falló el envío de notificaciones:", e);
    }
  });
}

/** Avisa solo a un dispositivo (la bienvenida al activar, para comprobar que llega). */
export function notificarDispositivo(endpoint: string, payload: PushPayload) {
  if (!configurar()) return;
  after(async () => {
    try {
      await enviar({ endpoint }, payload);
    } catch (e) {
      console.error("Falló la notificación de bienvenida:", e);
    }
  });
}

/** Cuentas de familia (rol ALUMNO, activas) de estos participantes. */
async function cuentasDeFamilia(studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { role: "ALUMNO", active: true, studentId: { in: studentIds } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Avisa a las familias de estos participantes. */
export function notificarFamilias(studentIds: string[], payload: PushPayload) {
  programar(() => cuentasDeFamilia(studentIds), payload);
}

/** Avisa a todas las familias de participantes ACTIVOS (anuncios generales, campañas). */
export function notificarFamiliasActivas(payload: PushPayload) {
  programar(async () => {
    const users = await prisma.user.findMany({
      where: { role: "ALUMNO", active: true, student: { status: "ACTIVO" } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }, payload);
}

/** Avisa a las familias con inscripción ACTIVA en un programa. */
export function notificarFamiliasDePrograma(programId: string, payload: PushPayload) {
  programar(async () => {
    const enrollments = await prisma.enrollment.findMany({
      where: { programId, status: "ACTIVA" },
      select: { studentId: true },
    });
    return cuentasDeFamilia(enrollments.map((e) => e.studentId));
  }, payload);
}

/** Recorta un texto para el cuerpo de la notificación (los celulares cortan ~120). */
export function resumen(texto: string, max = 120): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
}
