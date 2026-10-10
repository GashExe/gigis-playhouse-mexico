import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generatePassword, usernameFromName } from "../lib/credentials";

/**
 * Da de alta las cuentas del equipo de terapeutas de la casa (septiembre 2026),
 * con la misma regla de siempre: el usuario es nombre + apellido sin acentos
 * (como dayramoreno o marianamartinez) y la contraseña inicial la arma
 * `generatePassword` (3 letras del nombre + 3 del apellido + año).
 *
 * Uso: npm run db:seed-terapeutas
 *
 * Idempotente por usuario: si la cuenta ya existe solo le asegura el rol y la
 * deja activa — NO le repone la contraseña, para no tirar la que ya esté usando.
 * La inicial se guarda en `initialPassword` y se imprime aquí para que la
 * dirección la entregue; si alguien la pierde, se repone desde Equipo.
 *
 * El área de cada quien queda como comentario porque la cuenta no la guarda: lo
 * que amarra a la terapeuta con lo que da son sus programas, y eso se asigna
 * desde Programas. Cecilia Morvillo lleva la coordinación de lenguaje, así que
 * su cuenta va con rol COORDINADOR y coordinación LENGUAJE.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

type Alta = {
  /** Nombre de pila (el primero es el que arma el usuario y la contraseña). */
  firstName: string;
  /** Apellido paterno. */
  lastName: string;
  /** Nombre completo tal como se ve en la plataforma. */
  name?: string;
  /** Área que atiende. No se guarda: es para saber quién es quién en esta lista. */
  area: string;
  role?: "TERAPEUTA" | "COORDINADOR";
  coordination?: "LENGUAJE" | "EDUCACIONAL";
};

const EQUIPO: Alta[] = [
  { firstName: "Elena", lastName: "Zabal", area: "Computación" },
  {
    firstName: "Cecilia",
    lastName: "Morvillo",
    area: "Coordinación de lenguaje",
    role: "COORDINADOR",
    coordination: "LENGUAJE",
  },
  { firstName: "Rosa", lastName: "Becerra", area: "Orofacial" },
  { firstName: "Mariana", lastName: "Carbajal", area: "Lenguaje" },
  { firstName: "Gabriela", lastName: "Aristoy", area: "Lenguaje" },
  { firstName: "Regina", lastName: "Cavazos", area: "Lenguaje" },
  {
    firstName: "Alma",
    lastName: "Dorantes",
    name: "Alma Isabel Dorantes",
    area: "Lenguaje",
  },
  { firstName: "Diana", lastName: "Santos", area: "Terapia física y sensorial" },
  { firstName: "Mariana", lastName: "Mendoza", area: "Ocupacional" },
  { firstName: "Guadalupe", lastName: "Bárcenas", area: "Lectura" },
  { firstName: "Mariana", lastName: "Martínez", area: "Lectura y matemáticas" },
  { firstName: "Valeria", lastName: "Caraveo", area: "Matemáticas" },
  { firstName: "Adrián", lastName: "Carrillo", area: "Matemáticas" },
  // Octubre 2026.
  {
    firstName: "Diana",
    lastName: "Guerrero",
    name: "Diana Guadalupe Guerrero Terrazas",
    area: "Terapia educacional",
  },
  {
    firstName: "Ana",
    lastName: "Paniagua",
    name: "Ana Ximena Paniagua Nieto",
    area: "Coordinación de programas educacionales",
    role: "COORDINADOR",
    coordination: "EDUCACIONAL",
  },
];

/**
 * La cuenta de quien ya está se busca por usuario y, si no, por nombre: hay
 * cuentas viejas con el usuario escrito de otra forma (Cecilia Morvillo entró
 * como "cecimorvillo") y volver a crearla dejaría a la misma persona partida en
 * dos. Se compara sin acentos y pidiendo que el nombre y el apellido estén en la
 * cuenta, como hace el organigrama.
 */
const normaliza = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .trim();

async function main() {
  const year = new Date().getFullYear();
  console.log("🧑‍🏫 Cuentas del equipo de terapeutas\n");

  const cuentas = await prisma.user.findMany({
    where: { role: { notIn: ["ALUMNO", "VOLUNTARIO"] } },
    select: { id: true, name: true, username: true, role: true },
  });

  for (const p of EQUIPO) {
    const name = p.name ?? `${p.firstName} ${p.lastName}`;
    const role = p.role ?? "TERAPEUTA";
    const username = usernameFromName(p.firstName, p.lastName);

    const partes = [normaliza(p.firstName), normaliza(p.lastName)];
    const existente =
      cuentas.find((u) => u.username === username) ??
      cuentas.find((u) => {
        const suyo = normaliza(u.name).split(/\s+/);
        return partes.every((x) => suyo.includes(x));
      });

    if (existente) {
      await prisma.user.update({
        where: { id: existente.id },
        data: {
          role,
          coordination: role === "COORDINADOR" ? (p.coordination ?? null) : null,
          active: true,
        },
      });
      console.log(
        `   • ${name} (${p.area}) — ya existía como "${existente.username}"` +
          `${existente.role === role ? "" : `; era ${existente.role} y ahora es ${role}`}` +
          `. Su contraseña no se tocó.`,
      );
      continue;
    }

    const password = generatePassword(p.firstName, p.lastName, year);
    await prisma.user.create({
      data: {
        name,
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        coordination: role === "COORDINADOR" ? (p.coordination ?? null) : null,
        initialPassword: password,
      },
    });
    console.log(`   • ${name} (${p.area}) — usuario "${username}"  /  ${password}`);
  }

  console.log(
    "\n✅ Listo. Entrega las credenciales, pídeles cambiar la contraseña y" +
      " asígnales sus programas desde Programas.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
