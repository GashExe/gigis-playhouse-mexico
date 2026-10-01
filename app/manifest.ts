import type { MetadataRoute } from "next";

/**
 * Hace a la plataforma instalable en el celular ("Agregar a pantalla de inicio").
 * Instalada abre sin barra del navegador, con el ícono de Gigi's, y en iPhone es
 * requisito para poder recibir notificaciones (iOS 16.4+ solo las permite a apps
 * agregadas a la pantalla de inicio).
 *
 * `start_url` es "/": la raíz manda a cada quien a su lugar (familias a Mi espacio,
 * equipo al panel).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Gigi's Playhouse México",
    short_name: "Gigi's",
    description:
      "Avisos, clases, donativos y avances de tu participante en Gigi's Playhouse México.",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
