/* Service worker de Gigi's Playhouse México.
 *
 * Solo hace dos cosas: mostrar las notificaciones que manda el servidor
 * (lib/push.ts) y abrir la plataforma en la pantalla correcta al tocarlas.
 * No guarda páginas en caché a propósito: la plataforma siempre debe mostrar
 * datos al día (calificaciones, cupos, suspensiones).
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gigi's Playhouse", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gigi's Playhouse";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/mi-espacio" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/mi-espacio", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si la app ya está abierta, se reutiliza esa ventana en vez de abrir otra.
      for (const w of ventanas) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
