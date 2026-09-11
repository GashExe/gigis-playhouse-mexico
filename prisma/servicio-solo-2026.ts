/**
 * Deja en servicio social únicamente los reportes de 2026 en adelante y borra lo
 * anterior, junto con los prestadores que se queden sin nada.
 *
 *   npm run db:servicio-solo-2026 -- [--commit] [--desde 2026]
 *
 * Hace falta porque la primera importación trajo la hoja completa (2021→hoy) y
 * la casa pidió quedarse solo con el año corriente: los de 2025 para atrás se
 * liberaron hace años y con ellos dentro el padrón de hoy no se puede leer.
 *
 * Como los demás, va en SIMULACIÓN por defecto y solo escribe con --commit.
 *
 * ESTO BORRA Y NO SE DESHACE. Lo que se va sigue estando en la hoja del
 * formulario de Google, que es de donde salió: si algún día se quiere de vuelta,
 * se vuelve a importar con `--desde <año>`. Aun así, saque respaldo de la base
 * antes de correrlo con --commit.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  const args = process.argv.slice(2);
  const dry = !args.includes("--commit");
  const desdeArg = args[args.indexOf("--desde") + 1];
  const desde =
    args.includes("--desde") && /^\d{4}$/.test(desdeArg ?? "") ? Number(desdeArg) : 2026;

  // El corte va por la semana REPORTADA, no por cuándo se capturó: una semana de
  // diciembre que se mandó en enero sigue siendo de ese diciembre.
  const corte = new Date(Date.UTC(desde, 0, 1));

  const viejos = await prisma.serviceLog.count({ where: { weekEnd: { lt: corte } } });
  const total = await prisma.serviceLog.count();

  // Prestadores que se quedarían sin un solo reporte: los que solo existen por lo
  // que se va. Quien tenga aunque sea una semana de 2026 se queda con su ficha.
  const candidatos = await prisma.volunteer.findMany({
    where: { logs: { none: { weekEnd: { gte: corte } } } },
    select: { id: true, name: true, _count: { select: { logs: true } } },
  });

  console.log(
    `Reportes en la base: ${total}\n` +
      `Anteriores a ${desde} (se borran): ${viejos}\n` +
      `Quedan de ${desde} en adelante: ${total - viejos}\n` +
      `Prestadores que se quedan sin reportes (se borran): ${candidatos.length}`,
  );

  if (dry) {
    console.log(
      `\n[SIMULACIÓN — nada se borró; corre otra vez con --commit]` +
        (candidatos.length
          ? `\n\nSe irían, por ejemplo:\n` +
            candidatos
              .slice(0, 15)
              .map((v) => `  · ${v.name} (${v._count.logs} reportes)`)
              .join("\n") +
            (candidatos.length > 15 ? `\n  … y ${candidatos.length - 15} más` : "")
          : ""),
    );
    return;
  }

  await prisma.serviceLog.deleteMany({ where: { weekEnd: { lt: corte } } });

  // Las cuentas de acceso se van con su ficha: sin ficha no tienen a dónde entrar.
  const ids = candidatos.map((v) => v.id);
  if (ids.length) {
    await prisma.user.deleteMany({ where: { volunteerId: { in: ids } } });
    await prisma.volunteer.deleteMany({ where: { id: { in: ids } } });
  }

  // Áreas y líderes que solo existían por lo que se acaba de ir. Se buscan
  // DESPUÉS de borrar a propósito: hasta hace un momento seguían teniendo
  // reportes colgando, y es al irse esos cuando quedan sueltas. Los que sigan en
  // uso en 2026 se quedan, aunque el menú del formulario ya no los ofrezca.
  const areasSueltas = await prisma.serviceArea.findMany({
    where: { logs: { none: {} }, volunteers: { none: {} } },
    select: { id: true, name: true },
  });
  const lideresSueltos = await prisma.serviceLeader.findMany({
    where: { logs: { none: {} }, volunteers: { none: {} } },
    select: { id: true, name: true },
  });
  await prisma.serviceArea.deleteMany({ where: { id: { in: areasSueltas.map((a) => a.id) } } });
  await prisma.serviceLeader.deleteMany({
    where: { id: { in: lideresSueltos.map((l) => l.id) } },
  });

  console.log(
    `\nListo. Reportes borrados: ${viejos} · prestadores borrados: ${candidatos.length}` +
      `\nÁreas que se quedaron sin usar y se quitaron: ${areasSueltas.length}` +
      (areasSueltas.length ? `\n  ${areasSueltas.map((a) => a.name).join(", ")}` : "") +
      `\nLíderes que se quedaron sin usar y se quitaron: ${lideresSueltos.length}` +
      (lideresSueltos.length ? `\n  ${lideresSueltos.map((l) => l.name).join(", ")}` : ""),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
