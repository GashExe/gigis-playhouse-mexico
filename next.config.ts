import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 (query compiler) + better-sqlite3 (módulo nativo) deben quedar
  // fuera del bundle del servidor.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
  // El service worker de notificaciones no se cachea: si cambia, el celular debe
  // tomar la versión nueva en la siguiente visita (ver public/sw.js).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
