import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Siembra el organigrama del equipo de Querétaro tal como lo tiene la casa en su
 * lámina (agosto 2026). Corre con `npm run db:seed-organigrama`.
 *
 * Se escribe aquí y no a mano en la pantalla porque son 30 cajas y así queda
 * versionado: si alguien lo desacomoda, se vuelve a correr. Es IDEMPOTENTE por
 * nombre + cargo: correrlo dos veces no duplica nada, solo reacomoda.
 *
 * Cada caja se liga a su cuenta de la plataforma cuando el nombre coincide (sin
 * fijarse en acentos ni en el segundo nombre), y así muestra su rol y sus
 * programas al día. Quien no tiene cuenta —la mayoría— entra igual: para eso el
 * organigrama se arma a mano.
 *
 * Se respeta la lámina TAL CUAL, incluso donde una persona aparece dos veces
 * (Nadia Díaz en comunicación y en lenguaje; Jorge Galván en servicio social y en
 * danza): son dos funciones distintas y así las dibuja la casa.
 */

type Caja = {
  name: string;
  title?: string;
  /** Nombre del jefe en esta misma lista. Sin esto, va hasta arriba. */
  jefe?: string;
};

const ORGANIGRAMA: Caja[] = [
  // Arriba
  { name: "Eva Barba", title: "Directora" },
  { name: "Karyna Ordoñez", title: "C. local del Centro", jefe: "Eva Barba" },

  // Segunda fila: cuelga de la dirección
  { name: "Nadia Díaz", title: "Líder de Comunicación", jefe: "Eva Barba" },
  { name: "Mallely Martínez", title: "Desarrollo Institucional", jefe: "Eva Barba" },
  { name: "Paula Tornell", title: "C. de Programas", jefe: "Eva Barba" },
  { name: "Dayra Moreno", title: "Gestora de Familia y Operaciones", jefe: "Eva Barba" },
  { name: "Jorge Galván", title: "C. Servicio Social y Voluntariado", jefe: "Eva Barba" },
  { name: "Reyna Huerta", title: "Auxiliar Contable", jefe: "Eva Barba" },

  // Programas: cuelgan de la coordinación de programas
  { name: "Terapeuta Ocupacional", jefe: "Paula Tornell" },
  { name: "Mariana Martínez", title: "T. Líder de Programas Educacionales", jefe: "Paula Tornell" },
  { name: "Alejandra González", title: "Cocina", jefe: "Paula Tornell" },
  { name: "Jorge Galván", title: "Danza", jefe: "Paula Tornell" },
  {
    name: "Verónica García",
    title: "T. Líder de Vida Independiente y Hab. Sociales",
    jefe: "Paula Tornell",
  },
  { name: "Cecilia Morvillo", title: "T. Líder de Lenguaje", jefe: "Paula Tornell" },
  { name: "Diana Santos", title: "Terapeuta Sensorial, física", jefe: "Paula Tornell" },

  // Danza
  { name: "Iván Miranda", title: "Danza", jefe: "Jorge Galván|Danza" },

  // Programas educacionales
  { name: "Guadalupe Bárcenas", title: "Terapeuta de lectura", jefe: "Mariana Martínez" },
  { name: "Valeria Caraveo", title: "Terapeuta de Matemáticas", jefe: "Mariana Martínez" },
  {
    name: "Fernanda Vargas",
    title: "Terapeuta de lectura y Matemáticas",
    jefe: "Mariana Martínez",
  },
  { name: "Ligia Azuara", title: "Terapeuta de Matemáticas", jefe: "Mariana Martínez" },
  {
    name: "Adrián Carrillo",
    title: "Terapeuta de escritura y Matemáticas",
    jefe: "Mariana Martínez",
  },

  // Lenguaje
  { name: "Rosa Becerra", title: "Terapeuta Orofacial", jefe: "Cecilia Morvillo" },
  { name: "Nadia Díaz", title: "Terapeuta de Lenguaje", jefe: "Cecilia Morvillo" },
  { name: "Gabriela Aristoy", title: "Terapeuta de Lenguaje", jefe: "Cecilia Morvillo" },
  { name: "Catalina Palacio", title: "Terapeuta de Lenguaje", jefe: "Cecilia Morvillo" },
  { name: "Isabel Dorantes", title: "Terapeuta de Lenguaje", jefe: "Cecilia Morvillo" },
  { name: "Regina Cavazos", title: "Terapeuta de Lenguaje", jefe: "Cecilia Morvillo" },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Para comparar nombres sin tropezar con acentos ni mayúsculas. */
const normaliza = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** La clave de una caja: nombre + cargo, porque hay quien sale dos veces. */
const clave = (c: { name: string; title?: string | null }) =>
  `${normaliza(c.name)}|${normaliza(c.title ?? "")}`;

async function main() {
  const cuentas = await prisma.user.findMany({
    where: { role: { not: "ALUMNO" } },
    select: { id: true, name: true },
  });

  /**
   * Liga la caja con su cuenta si el nombre coincide. Acepta que la cuenta traiga
   * más nombres o apellidos ("Paula Tornell Pantoja" ↔ "Paula Tornell"), pero pide
   * que TODAS las palabras de la lámina estén en la cuenta: así "Nadia Díaz" no se
   * pega a cualquiera que se llame Nadia.
   */
  const cuentaDe = (nombre: string) => {
    const partes = normaliza(nombre).split(/\s+/);
    const match = cuentas.find((u) => {
      const suyo = normaliza(u.name).split(/\s+/);
      return partes.every((p) => suyo.includes(p));
    });
    return match ?? null;
  };

  const existentes = await prisma.orgNode.findMany({
    select: { id: true, name: true, title: true },
  });
  const porClave = new Map(existentes.map((n) => [clave(n), n.id]));

  // Primera pasada: crear o actualizar cada caja, todavía sin jefe.
  const idDe = new Map<string, string>();
  let orden = 0;
  for (const caja of ORGANIGRAMA) {
    const k = clave(caja);
    const cuenta = cuentaDe(caja.name);
    const datos = {
      name: caja.name,
      title: caja.title ?? null,
      userId: cuenta?.id ?? null,
      order: orden++,
    };
    const existente = porClave.get(k);
    const node = existente
      ? await prisma.orgNode.update({ where: { id: existente }, data: datos, select: { id: true } })
      : await prisma.orgNode.create({ data: datos, select: { id: true } });
    idDe.set(k, node.id);
    console.log(
      `  ${caja.name}${caja.title ? ` — ${caja.title}` : ""}${cuenta ? `  [cuenta: ${cuenta.name}]` : ""}`,
    );
  }

  // Segunda pasada: colgar cada quien de su jefe (ya existen todos los ids).
  for (const caja of ORGANIGRAMA) {
    if (!caja.jefe) continue;
    // "Jorge Galván|Danza" cuando hay que distinguir entre dos cajas del mismo nombre.
    const [nombreJefe, cargoJefe] = caja.jefe.split("|");
    const claveJefe = cargoJefe
      ? clave({ name: nombreJefe, title: cargoJefe })
      : [...idDe.keys()].find((k) => k.startsWith(`${normaliza(nombreJefe)}|`));
    const parentId = claveJefe ? idDe.get(claveJefe) : undefined;
    if (!parentId) {
      console.warn(`  ⚠ no encontré al jefe de ${caja.name}: ${caja.jefe}`);
      continue;
    }
    await prisma.orgNode.update({ where: { id: idDe.get(clave(caja))! }, data: { parentId } });
  }

  const total = await prisma.orgNode.count();
  const ligadas = await prisma.orgNode.count({ where: { userId: { not: null } } });
  console.log(`\n${total} cajas en el organigrama, ${ligadas} ligadas a una cuenta.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
