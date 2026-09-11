/**
 * Rellena `Volunteer.searchKey` de los prestadores que ya están en la base.
 *
 *   npm run db:servicio-claves
 *
 * Hace falta UNA vez, después de agregar la columna: los prestadores importados
 * antes de que existiera la tienen vacía, y con la clave vacía no aparecen al
 * buscarlos aunque estén ahí. De ahí en adelante la plataforma y el importador la
 * escriben solos en cada guardado.
 *
 * Correrlo de más no hace daño: recalcula lo mismo.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clavesDePrestador } from "../lib/servicio";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  const prestadores = await prisma.volunteer.findMany({
    select: { id: true, name: true, school: true, nameKey: true, searchKey: true },
  });

  let cambiados = 0;
  for (const p of prestadores) {
    const claves = clavesDePrestador(p.name, p.school);
    if (claves.nameKey === p.nameKey && claves.searchKey === p.searchKey) continue;
    await prisma.volunteer.update({ where: { id: p.id }, data: claves });
    cambiados++;
  }

  console.log(`Prestadores revisados: ${prestadores.length} · claves escritas: ${cambiados}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
