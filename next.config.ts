import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 (query compiler) + better-sqlite3 (módulo nativo) deben quedar
  // fuera del bundle del servidor.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;
