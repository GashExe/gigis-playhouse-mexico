"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { CycleSchema } from "@/lib/validators";
import { cycleLabel, dateOnly } from "@/lib/cycles";
import type { CycleSeason } from "@/lib/generated/prisma/client";

export type CycleFormState =
  | { errors?: Record<string, string[]>; error?: string; ok?: boolean }
  | undefined;

/** Convierte un campo de texto a entero positivo (o null si viene vacío). */
function toPositiveInt(value: string | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseCycleForm(formData: FormData) {
  return CycleSchema.safeParse({
    season: formData.get("season"),
    year: formData.get("year"),
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    maxEnrollments: formData.get("maxEnrollments") ?? "",
  });
}

/**
 * Alta de un ciclo. Antes esto solo existía como script de seed, así que abrir un
 * ciclo nuevo dependía de que alguien con la terminal lo corriera.
 *
 * Dos cosas que hace de más, y por qué:
 *  • COPIA LA OFERTA de otro ciclo (los programas activos). Sin oferta, el ciclo no
 *    sirve para nada: ni las familias ni dirección pueden inscribir, y el cambio de
 *    ciclo asistido se niega a correr. Copiarla es un `connect`: no borra ni mueve
 *    nada, y la directora destilda después lo que no corra.
 *  • NO LO ACTIVA salvo que se lo pidan, y se niega a activar uno sin oferta: el
 *    ciclo activo es donde inscriben las tres puertas, así que activarlo vacío deja
 *    a las familias con la pantalla de inscripción en blanco.
 */
export async function createCycle(
  _prev: CycleFormState,
  formData: FormData,
): Promise<CycleFormState> {
  await requireWriter("DIRECTORA");
  const parsed = parseCycleForm(formData);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const season = d.season as CycleSeason;
  const label = cycleLabel(season, d.year);

  const existing = await prisma.cycle.findUnique({
    where: { season_year: { season, year: d.year } },
    select: { id: true },
  });
  if (existing) return { error: `El ciclo ${label} ya existe.` };

  // De dónde se copia la oferta. Solo programas activos: uno apagado a propósito
  // no debe resucitar en el ciclo nuevo.
  const copyFrom = String(formData.get("copyOfferFrom") ?? "");
  const offer = copyFrom
    ? await prisma.program.findMany({
        where: { active: true, cycles: { some: { id: copyFrom } } },
        select: { id: true },
      })
    : [];

  const activar = String(formData.get("activate") ?? "") === "1";
  if (activar && offer.length === 0) {
    return {
      error:
        "Un ciclo sin programas no se puede activar: las familias se quedarían sin nada que inscribir. Copia la oferta de otro ciclo o actívalo cuando ya la tengas armada.",
    };
  }

  let cycle;
  try {
    cycle = await prisma.cycle.create({
      data: {
        season,
        year: d.year,
        label,
        startDate: dateOnly(d.startDate),
        endDate: dateOnly(d.endDate),
        maxEnrollments: toPositiveInt(d.maxEnrollments),
        programs: { connect: offer.map((p) => ({ id: p.id })) },
      },
      select: { id: true, label: true },
    });
  } catch {
    // Dos manos creando el mismo ciclo a la vez: lo atrapa el @@unique.
    return { error: `El ciclo ${label} ya existe.` };
  }

  if (activar) {
    await prisma.$transaction([
      prisma.cycle.updateMany({ where: { active: true }, data: { active: false } }),
      prisma.cycle.update({ where: { id: cycle.id }, data: { active: true } }),
    ]);
  }

  await logAudit({
    action: "ciclo.alta",
    summary: `Creó el ciclo ${label}${offer.length > 0 ? ` con ${offer.length} programa(s) en su oferta` : ""}${activar ? " y lo activó" : ""}`,
    entityType: "Cycle",
    entityId: cycle.id,
  });

  revalidatePath("/configuracion");
  revalidatePath("/programas");
  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Edición de un ciclo: fechas y tope de actividades. La temporada y el año NO se
 * tocan — definen la identidad del ciclo y de ellos sale la etiqueta, así que
 * cambiarlos convertiría "Ene–Jun 2026" en un nombre que miente o que choca con
 * otro ciclo.
 */
export async function updateCycle(
  cycleId: string,
  _prev: CycleFormState,
  formData: FormData,
): Promise<CycleFormState> {
  await requireWriter("DIRECTORA");
  const parsed = parseCycleForm(formData);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const cycle = await prisma.cycle.update({
    where: { id: cycleId },
    data: {
      startDate: dateOnly(d.startDate),
      endDate: dateOnly(d.endDate),
      maxEnrollments: toPositiveInt(d.maxEnrollments),
    },
    select: { label: true, maxEnrollments: true },
  });

  await logAudit({
    action: "ciclo.editar",
    summary: `Editó el ciclo ${cycle.label}${cycle.maxEnrollments != null ? ` (tope de ${cycle.maxEnrollments} actividades por participante)` : " (sin tope de actividades)"}`,
    entityType: "Cycle",
    entityId: cycleId,
  });

  revalidatePath("/configuracion");
  revalidatePath("/programas");
  revalidatePath("/mi-espacio");
  return { ok: true };
}

export type ContinuityState =
  | {
      ok?: boolean;
      error?: string;
      copied?: { students: number; enrollments: number; advanced: number };
      /** Quiénes se pasaban del tope del ciclo destino y qué se les dejó fuera. */
      skipped?: { studentId: string; studentName: string; programNames: string[] }[];
    }
  | undefined;

/**
 * Cambio de ciclo asistido: copia a los participantes elegidos del ciclo origen al
 * destino. Por cada alumno, para cada programa que tuvo en el origen **y que esté en
 * la oferta del destino**, crea/reactiva la inscripción y copia su ubicación de nivel
 * (el nivel donde quedó). Idempotente: correrlo dos veces no duplica nada.
 *
 * Solo copia a programas que estén en la oferta del ciclo destino: respeta la oferta
 * que arma la dirección (no la modifica por su cuenta).
 */
export async function carryOverStudents(
  fromCycleId: string,
  toCycleId: string,
  studentIds: string[],
  /// Claves "studentId:programId" que además de copiarse deben SUBIR al nivel
  /// siguiente del programa (concluyó el nivel en el ciclo que termina).
  advanceKeys: string[] = [],
): Promise<ContinuityState> {
  await requireWriter("DIRECTORA");
  if (!fromCycleId || !toCycleId || fromCycleId === toCycleId) {
    return { error: "Elige un ciclo de origen y uno de destino distintos." };
  }
  if (studentIds.length === 0) {
    return { error: "No seleccionaste a ningún participante." };
  }

  const [fromCycle, toCycle] = await Promise.all([
    prisma.cycle.findUnique({ where: { id: fromCycleId }, select: { id: true } }),
    prisma.cycle.findUnique({
      where: { id: toCycleId },
      select: { id: true, label: true, maxEnrollments: true },
    }),
  ]);
  if (!fromCycle || !toCycle) return { error: "El ciclo elegido ya no existe." };

  // Programas ofertados en el destino: a esos —y solo a esos— se copia.
  const targetPrograms = await prisma.program.findMany({
    where: { cycles: { some: { id: toCycleId } } },
    select: { id: true, name: true },
  });
  const targetOffer = new Set(targetPrograms.map((p) => p.id));
  const programName = new Map(targetPrograms.map((p) => [p.id, p.name]));
  if (targetOffer.size === 0) {
    return {
      error: "El ciclo destino no tiene programas en su oferta todavía. Ármala primero.",
    };
  }

  // Inscripciones y ubicaciones del ciclo origen de los alumnos elegidos, y lo que
  // YA tienen en el destino (esto es idempotente: puede haberse corrido antes).
  const ids = new Set(studentIds);
  const [enrolls, records, yaEnDestino, people] = await Promise.all([
    prisma.enrollment.findMany({
      where: { cycleId: fromCycleId, studentId: { in: studentIds } },
      select: { studentId: true, programId: true },
    }),
    prisma.levelRecord.findMany({
      where: { cycleId: fromCycleId, studentId: { in: studentIds } },
      select: { studentId: true, programId: true, programLevelId: true, placement: true, note: true },
    }),
    prisma.enrollment.findMany({
      where: { cycleId: toCycleId, status: "ACTIVA", studentId: { in: studentIds } },
      select: { studentId: true, programId: true },
    }),
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  // Programas por alumno en el origen (unión de inscripción + ubicación de nivel),
  // acotados a la oferta del destino.
  const programsByStudent = new Map<string, Set<string>>();
  const add = (studentId: string, programId: string) => {
    if (!ids.has(studentId) || !targetOffer.has(programId)) return;
    let set = programsByStudent.get(studentId);
    if (!set) programsByStudent.set(studentId, (set = new Set()));
    set.add(programId);
  };
  for (const e of enrolls) add(e.studentId, e.programId);
  for (const r of records) add(r.studentId, r.programId);

  // Índice de la ubicación de nivel de origen, para copiar "dónde quedó".
  const recordByKey = new Map(
    records.map((r) => [`${r.studentId}:${r.programId}`, r]),
  );

  // Nivel siguiente dentro de cada programa, para quien concluyó el suyo. Si no
  // hay siguiente (ya está en el último), se queda donde está.
  const levels = await prisma.programLevel.findMany({
    orderBy: [{ programId: "asc" }, { order: "asc" }],
    select: { id: true, order: true, programId: true },
  });
  const nextLevelId = new Map<string, string>();
  for (const l of levels) {
    const next = levels.find((n) => n.programId === l.programId && n.order > l.order);
    if (next) nextLevelId.set(l.id, next.id);
  }
  const advance = new Set(advanceKeys);

  let copiedStudents = 0;
  let copiedEnrollments = 0;
  let advancedLevels = 0;

  // Lo que cada quien ya tiene activo en el destino: cuenta para el tope.
  const yaPorAlumno = new Map<string, Set<string>>();
  for (const e of yaEnDestino) {
    let set = yaPorAlumno.get(e.studentId);
    if (!set) yaPorAlumno.set(e.studentId, (set = new Set()));
    set.add(e.programId);
  }
  const nombreAlumno = new Map(
    people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
  );
  const skipped: NonNullable<ContinuityState>["skipped"] = [];
  const copiedPairs: { studentId: string; programId: string }[] = [];

  for (const [studentId, programIds] of programsByStudent) {
    if (programIds.size === 0) continue;

    // Tope de actividades del ciclo destino. Aquí NO se aborta la corrida: una
    // persona pasada de tope dejaría sin copiar a las otras cuarenta. Se copia
    // hasta donde cabe y lo que quedó fuera se le reporta a dirección para que
    // decida a mano desde el expediente (donde sí puede autorizarlo).
    const ya = yaPorAlumno.get(studentId) ?? new Set<string>();
    // Por nombre de programa: recortar según el orden en que salieron de dos
    // consultas sería un criterio que nadie podría explicar.
    const ordenados = [...programIds].sort((a, b) =>
      (programName.get(a) ?? "").localeCompare(programName.get(b) ?? "", "es"),
    );
    const aCopiar: string[] = [];
    const dejadosFuera: string[] = [];
    let carga = ya.size;
    for (const programId of ordenados) {
      if (ya.has(programId)) {
        aCopiar.push(programId); // ya lo tiene: no añade carga
        continue;
      }
      if (toCycle.maxEnrollments != null && carga >= toCycle.maxEnrollments) {
        dejadosFuera.push(programName.get(programId) ?? "otra actividad");
        continue;
      }
      carga++;
      aCopiar.push(programId);
    }
    if (dejadosFuera.length > 0) {
      skipped.push({
        studentId,
        studentName: nombreAlumno.get(studentId) ?? "Participante",
        programNames: dejadosFuera,
      });
    }
    if (aCopiar.length === 0) continue;

    copiedStudents++;
    for (const programId of aCopiar) {
      copiedPairs.push({ studentId, programId });
      // Inscripción en el destino (reactiva si ya existía pausada/finalizada).
      await prisma.enrollment.upsert({
        where: { studentId_programId_cycleId: { studentId, programId, cycleId: toCycleId } },
        update: { status: "ACTIVA", endDate: null },
        create: { studentId, programId, cycleId: toCycleId, status: "ACTIVA" },
      });
      copiedEnrollments++;

      // Copia la ubicación de nivel donde quedó, si la tenía.
      const src = recordByKey.get(`${studentId}:${programId}`);
      if (src) {
        // Si dirección palomeó "subir de nivel" y ese programa tiene un nivel
        // más adelante, entra al ciclo nuevo en el siguiente.
        const promoted = advance.has(`${studentId}:${programId}`)
          ? nextLevelId.get(src.programLevelId)
          : undefined;
        if (promoted) advancedLevels++;
        const levelId = promoted ?? src.programLevelId;
        await prisma.levelRecord.upsert({
          where: { studentId_programId_cycleId: { studentId, programId, cycleId: toCycleId } },
          update: { programLevelId: levelId, placement: src.placement },
          create: {
            studentId,
            programId,
            cycleId: toCycleId,
            programLevelId: levelId,
            placement: src.placement,
            note: src.note,
          },
        });
      }
    }
  }

  // Quien ya quedó inscrito no sigue esperando esa actividad: cierra sus solicitudes
  // de lista de espera. Va en una sola escritura al final —y no por alumno con
  // `enrollStudent`— para no dejar una línea de bitácora por cada copia.
  if (copiedPairs.length > 0) {
    await prisma.waitlistRequest.updateMany({
      where: {
        cycleId: toCycleId,
        status: "EN_ESPERA",
        OR: copiedPairs.map((p) => ({ studentId: p.studentId, programId: p.programId })),
      },
      data: { status: "ACEPTADA", decidedAt: new Date() },
    });
  }

  await logAudit({
    action: "ciclo.continuidad",
    summary: `Trajo ${copiedStudents} participante(s) al ciclo ${toCycle.label} (${copiedEnrollments} inscripción/es${advancedLevels > 0 ? `, ${advancedLevels} subida(s) de nivel` : ""}${skipped.length > 0 ? `; ${skipped.length} con actividades fuera del tope` : ""})`,
    entityType: "Cycle",
    entityId: toCycleId,
  });

  revalidatePath("/programas");
  revalidatePath("/programas/continuidad");
  revalidatePath("/panel");
  return {
    ok: true,
    copied: {
      students: copiedStudents,
      enrollments: copiedEnrollments,
      advanced: advancedLevels,
    },
    skipped,
  };
}
