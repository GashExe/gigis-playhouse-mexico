import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Borra los datos que quedaron de las pruebas de la plataforma y deja el padrón
 * real del ciclo Sep–Dic 2026 tal como se importó.
 *
 * Uso:
 *   npm run db:limpieza-pruebas -- [--commit]
 *
 * DRY-RUN por defecto, igual que los importadores: imprime todo lo que haría y no
 * escribe nada. Con --commit borra, y antes de borrar guarda en exports/ un JSON
 * con cada renglón que se lleva, para poder devolverlo si hiciera falta.
 *
 * Lo que NO toca: los 151 participantes con matrícula, Diego Barrón (alta real del
 * 2 de septiembre), las 150 inscripciones y 150 ubicaciones de nivel del import,
 * el horario, el organigrama, los ciclos, las cuentas del equipo y los textos legales.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const COMMIT = process.argv.includes("--commit");

// El import del ciclo Sep–Dic corrió el 23 de agosto: lo de antes es el padrón real,
// lo que se creó después en ese ciclo salió de las pruebas.
const CORTE_IMPORT = new Date("2026-08-24T00:00:00Z");

// Participante inventado para probar (sin matrícula, tutor "Prueba").
const PARTICIPANTE_PRUEBA = { firstName: "Paul", lastName: "Ramirez" };

// Programas inventados para probar.
const PROGRAMAS_PRUEBA = ["prueba", "Programa de Prueba"];

// Participantes reales a los que las pruebas les metieron datos de familia basura.
const MATRICULAS_BASURA = ["2026111", "2026146"];

const respaldo: Record<string, unknown> = {};
const plan: string[] = [];
const linea = (s: string) => { plan.push(s); console.log(s); };

async function main() {
  console.log(COMMIT ? "=== LIMPIEZA (--commit: SÍ escribe) ===\n" : "=== LIMPIEZA (DRY-RUN: no escribe nada) ===\n");

  const cicloEneJun = await prisma.cycle.findFirst({ where: { season: "ENE_JUN", year: 2026 } });
  if (!cicloEneJun) throw new Error("No encontré el ciclo Ene–Jun 2026");

  // ── 1. Participante de prueba ────────────────────────────────────────────────
  const paul = await prisma.student.findFirst({
    where: { matricula: null, firstName: PARTICIPANTE_PRUEBA.firstName, lastName: PARTICIPANTE_PRUEBA.lastName },
    include: { account: true, health: true },
  });
  if (paul) {
    respaldo.participantePrueba = paul;
    linea(`Participante de prueba: ${paul.firstName} ${paul.lastName} (cuenta ${paul.account?.username ?? "—"}, cuestionario de salud ${paul.health ? "sí" : "no"})`);
  } else {
    linea("Participante de prueba: no está (ya se borró)");
  }

  // ── 2. Programas de prueba ───────────────────────────────────────────────────
  const progsPrueba = await prisma.program.findMany({
    where: { name: { in: PROGRAMAS_PRUEBA } },
    include: { _count: { select: { enrollments: true, levelRecords: true, scheduleSlots: true, classSessions: true } } },
  });
  respaldo.programasPrueba = progsPrueba;
  for (const p of progsPrueba) linea(`Programa de prueba: «${p.name}» (${p._count.scheduleSlots} horarios, ${p._count.classSessions} clases, ${p._count.enrollments} inscripciones)`);

  // ── 3. Inscripciones de prueba ───────────────────────────────────────────────
  const inscPrueba = await prisma.enrollment.findMany({
    where: { OR: [{ cycleId: cicloEneJun.id }, { createdAt: { gt: CORTE_IMPORT } }] },
    include: { student: { select: { firstName: true, lastName: true } }, program: { select: { name: true } }, cycle: { select: { label: true } } },
  });
  respaldo.inscripciones = inscPrueba;
  linea(`\nInscripciones a borrar: ${inscPrueba.length}`);
  for (const e of inscPrueba) linea(`   · ${e.student.firstName} ${e.student.lastName} — ${e.program.name} (${e.cycle.label})`);

  // ── 4. Ubicaciones de nivel de prueba ────────────────────────────────────────
  const nivPrueba = await prisma.levelRecord.findMany({
    where: { OR: [{ cycleId: cicloEneJun.id }, { createdAt: { gt: CORTE_IMPORT } }] },
    include: { student: { select: { firstName: true, lastName: true } }, program: { select: { name: true } } },
  });
  respaldo.ubicaciones = nivPrueba;
  linea(`\nUbicaciones de nivel a borrar: ${nivPrueba.length}`);

  // ── 5. Calificaciones puestas en pruebas sobre ubicaciones del import ────────
  const califPrueba = await prisma.levelRecord.findMany({
    where: {
      createdAt: { lt: CORTE_IMPORT },
      cycleId: { not: cicloEneJun.id },
      OR: [{ initialScore: { not: null } }, { finalScore: { not: null } }],
    },
    include: { student: { select: { firstName: true, lastName: true } }, program: { select: { name: true } } },
  });
  respaldo.calificacionesLimpiadas = califPrueba;
  linea(`\nCalificaciones a quitar (la ubicación se queda): ${califPrueba.length}`);
  for (const r of califPrueba) linea(`   · ${r.student.firstName} ${r.student.lastName} — ${r.program.name} (inicial ${r.initialScore}, final ${r.finalScore})`);

  // ── 6. Todo lo demás que nació de las pruebas ────────────────────────────────
  respaldo.listaEspera = await prisma.waitlistRequest.findMany({ include: { student: { select: { firstName: true, lastName: true } }, program: { select: { name: true } } } });
  respaldo.reservas = await prisma.reservation.findMany({ include: { student: { select: { firstName: true, lastName: true } }, program: { select: { name: true } } } });
  respaldo.enviosInscripcion = await prisma.enrollmentSubmission.findMany();
  respaldo.avisos = await prisma.announcement.findMany({ include: { recipients: true } });
  respaldo.eventosCalendario = await prisma.calendarEvent.findMany();
  respaldo.clases = await prisma.classSession.findMany({ include: { attendance: true } });
  respaldo.anotaciones = await prisma.studentNote.findMany({ include: { student: { select: { firstName: true, lastName: true } } } });
  respaldo.oficios = await prisma.oficio.findMany();
  respaldo.bitacora = await prisma.auditLog.findMany();
  respaldo.campanas = await prisma.donationCampaign.findMany({ include: { contributions: true } });

  const n = (k: string) => (respaldo[k] as unknown[]).length;
  linea("");
  linea(`Lista de espera:        ${n("listaEspera")}`);
  linea(`Reservas:               ${n("reservas")}`);
  linea(`Envíos de inscripción:  ${n("enviosInscripcion")}`);
  linea(`Avisos:                 ${n("avisos")}`);
  linea(`Eventos de calendario:  ${n("eventosCalendario")}`);
  linea(`Clases (con asistencia):${n("clases")}`);
  linea(`Anotaciones:            ${n("anotaciones")}`);
  linea(`Oficios:                ${n("oficios")}`);
  linea(`Campañas de donativos:  ${n("campanas")}`);
  linea(`Bitácora (movimientos): ${n("bitacora")}`);

  // ── 7. Datos de familia basura ───────────────────────────────────────────────
  const basura = await prisma.student.findMany({ where: { matricula: { in: MATRICULAS_BASURA } }, include: { health: true } });
  respaldo.datosFamiliaBasura = basura;
  linea(`\nDatos de familia a limpiar (y onboarding a resetear): ${basura.length}`);
  for (const s of basura) linea(`   · ${s.firstName} ${s.lastName} — tutor "${s.guardianName}", tel "${s.guardianPhone}"${s.health ? ", cuestionario de salud de prueba" : ""}`);

  // ── Resumen de lo que queda ──────────────────────────────────────────────────
  const quedan = {
    participantes: (await prisma.student.count()) - (paul ? 1 : 0),
    inscripciones: (await prisma.enrollment.count()) - inscPrueba.length,
    ubicaciones: (await prisma.levelRecord.count()) - nivPrueba.length,
    programas: (await prisma.program.count()) - progsPrueba.length,
  };
  linea(`\nDespués de la limpieza quedan: ${quedan.participantes} participantes · ${quedan.inscripciones} inscripciones · ${quedan.ubicaciones} ubicaciones de nivel · ${quedan.programas} programas`);

  if (!COMMIT) {
    linea("\nDRY-RUN: no se escribió nada. Corre con --commit para aplicarlo.");
    return;
  }

  // ── Respaldo antes de borrar ─────────────────────────────────────────────────
  const dir = path.join(process.cwd(), "exports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const archivo = path.join(dir, `limpieza-pruebas-${stamp}.json`);
  fs.writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
  console.log(`\nRespaldo guardado en ${archivo}`);

  // ── Borrado ──────────────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({});
    await tx.attendanceRecord.deleteMany({});
    await tx.classSession.deleteMany({});
    await tx.studentNote.deleteMany({});
    await tx.announcementRecipient.deleteMany({});
    await tx.announcement.deleteMany({});
    await tx.calendarEvent.deleteMany({});
    await tx.oficio.deleteMany({});
    await tx.donationContribution.deleteMany({});
    await tx.donationCampaign.deleteMany({});
    await tx.enrollmentSubmission.deleteMany({});
    await tx.reservation.deleteMany({});
    await tx.waitlistRequest.deleteMany({});

    await tx.enrollment.deleteMany({ where: { OR: [{ cycleId: cicloEneJun.id }, { createdAt: { gt: CORTE_IMPORT } }] } });
    await tx.levelRecord.deleteMany({ where: { OR: [{ cycleId: cicloEneJun.id }, { createdAt: { gt: CORTE_IMPORT } }] } });

    // La ubicación se queda; solo se le quita la calificación de prueba.
    for (const r of califPrueba) {
      await tx.levelRecord.update({
        where: { id: r.id },
        data: { initialScore: null, finalScore: null, gradedAt: r.createdAt },
      });
    }

    if (progsPrueba.length) await tx.program.deleteMany({ where: { id: { in: progsPrueba.map((p) => p.id) } } });

    if (paul) {
      if (paul.account) await tx.user.delete({ where: { id: paul.account.id } });
      await tx.student.delete({ where: { id: paul.id } });
    }

    for (const s of basura) {
      if (s.health) await tx.healthProfile.delete({ where: { id: s.health.id } });
      await tx.student.update({
        where: { id: s.id },
        data: {
          guardianName: null, guardianPhone: null, guardianEmail: null, address: null,
          onboardingCompletedAt: null, privacyAcceptedAt: null, rulesAcceptedAt: null, consentVersion: null,
        },
      });
    }
  }, { timeout: 60_000 });

  console.log("\nListo: la plataforma queda con el padrón real del ciclo Sep–Dic 2026.");
}

main().finally(() => prisma.$disconnect());
