import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generatePassword } from "../lib/credentials";

/**
 * Da de alta las cuentas de LECTOR: ven toda la plataforma y no pueden modificar
 * nada. Hoy son Mallely Martínez y Reyna Huerta.
 *
 * Uso: npm run db:seed-lectores
 *
 * Idempotente: si la cuenta ya existe solo le asegura el rol LECTOR y la deja
 * activa — NO le repone la contraseña, para no tirar la que ya esté usando. La
 * contraseña inicial se guarda en `initialPassword` y se imprime aquí para que la
 * dirección se la entregue; si alguien la pierde, se repone desde Equipo.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

const LECTORAS = [
  { name: "Mallely Martínez", username: "mallely", firstName: "Mallely", lastName: "Martinez" },
  { name: "Reyna Huerta", username: "reyna", firstName: "Reyna", lastName: "Huerta" },
];

async function main() {
  const year = new Date().getFullYear();
  console.log("👀 Cuentas de Lector (ven todo, no modifican nada)\n");

  for (const l of LECTORAS) {
    const existente = await prisma.user.findUnique({
      where: { username: l.username },
      select: { id: true, role: true },
    });

    if (existente) {
      await prisma.user.update({
        where: { id: existente.id },
        data: { name: l.name, role: "LECTOR", active: true },
      });
      console.log(
        `   • ${l.name} — ya existía (rol anterior: ${existente.role}); ahora es LECTOR. Su contraseña no se tocó.`,
      );
      continue;
    }

    const password = generatePassword(l.firstName, l.lastName, year);
    await prisma.user.create({
      data: {
        name: l.name,
        username: l.username,
        passwordHash: await bcrypt.hash(password, 10),
        role: "LECTOR",
        initialPassword: password,
      },
    });
    console.log(`   • ${l.name} — usuario "${l.username}"  /  ${password}`);
  }

  console.log("\n✅ Listo. Entrega las credenciales y pídeles cambiar la contraseña.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
