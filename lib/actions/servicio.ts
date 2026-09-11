"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireServiceManager, requireVolunteer } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { ensureVolunteerAccount } from "@/lib/accounts";
import { horasLabel, parseHorasAMinutos } from "@/lib/servicio";

/**
 * Servicio social: alta de prestadores, su reporte semanal de horas y la
 * autorización de la coordinación.
 *
 * Quién puede qué:
 *   - `requireServiceManager` → dirección y coordinación de servicio social.
 *   - `requireVolunteer`      → el prestador, y SOLO sobre sus propios reportes.
 *
 * La regla que sostiene todo lo demás: un reporte ya resuelto no lo vuelve a
 * tocar el prestador. Si pudiera editarlo después de autorizado podría subirse
 * las horas sin que nadie lo viera, y la constancia dejaría de valer.
 */

/** "YYYY-MM-DD" → Date a medianoche UTC (convención @db.Date del proyecto). */
function parseDateInput(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

const texto = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();
const textoLargo = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const opcional = (v: FormDataEntryValue | null) => texto(v) || null;

function parseEntero(v: FormDataEntryValue | null): number | null {
  const s = texto(v).replace(/[^\d]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ── Prestadores ───────────────────────────────────────────────────────────── */

function camposPrestador(formData: FormData) {
  return {
    name: texto(formData.get("name")),
    school: texto(formData.get("school")),
    areaId: opcional(formData.get("areaId")),
    leaderId: opcional(formData.get("leaderId")),
    // La meta la marca la escuela de cada quien, por eso va por prestador.
    requiredHours: parseEntero(formData.get("requiredHours")),
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    email: opcional(formData.get("email")),
    phone: opcional(formData.get("phone")),
    notes: textoLargo(formData.get("notes")) || null,
  };
}

export async function createVolunteer(formData: FormData) {
  await requireServiceManager();
  const data = camposPrestador(formData);
  if (!data.name || !data.school) return;
  const volunteer = await prisma.volunteer.create({ data, select: { id: true, name: true } });
  await logAudit({
    action: "servicio.prestador.alta",
    summary: `Dio de alta al prestador de servicio social ${volunteer.name}`,
    entityType: "Volunteer",
    entityId: volunteer.id,
  });
  revalidatePath("/servicio-social");
  redirect(`/servicio-social/${volunteer.id}`);
}

export async function updateVolunteer(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  const data = camposPrestador(formData);
  if (!id || !data.name || !data.school) return;
  await prisma.volunteer.update({ where: { id }, data });
  await logAudit({
    action: "servicio.prestador.editar",
    summary: `Editó la ficha del prestador ${data.name}`,
    entityType: "Volunteer",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${id}`);
}

export async function setVolunteerStatus(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  const status = texto(formData.get("status"));
  if (!id || !["ACTIVO", "CONCLUIDO", "BAJA"].includes(status)) return;
  const volunteer = await prisma.volunteer.update({
    where: { id },
    data: { status: status as "ACTIVO" | "CONCLUIDO" | "BAJA" },
    select: { name: true },
  });
  await logAudit({
    action: "servicio.prestador.estado",
    summary: `Puso a ${volunteer.name} como ${status.toLowerCase()}`,
    entityType: "Volunteer",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${id}`);
}

export async function deleteVolunteer(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  if (!id) return;
  // La cuenta de acceso se va con él: sin ficha no tiene a dónde entrar.
  await prisma.user.deleteMany({ where: { volunteerId: id } });
  const volunteer = await prisma.volunteer.delete({ where: { id }, select: { name: true } });
  await logAudit({
    action: "servicio.prestador.baja",
    summary: `Eliminó al prestador ${volunteer.name} y sus reportes`,
    entityType: "Volunteer",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  redirect("/servicio-social");
}

/** Le genera usuario y contraseña para que reporte sus horas desde la plataforma. */
export async function createVolunteerAccess(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  if (!id) return;
  const volunteer = await prisma.volunteer.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!volunteer) return;
  const cuenta = await ensureVolunteerAccount(volunteer);
  if (cuenta) {
    await logAudit({
      action: "servicio.prestador.acceso",
      summary: `Generó el acceso de ${volunteer.name} (usuario ${cuenta.username})`,
      entityType: "Volunteer",
      entityId: id,
    });
  }
  revalidatePath(`/servicio-social/${id}`);
}

/**
 * Junta dos fichas de la misma persona en una sola: los reportes se pasan a la
 * que se queda y la otra se borra.
 *
 * Existe porque la hoja del formulario venía con el nombre escrito de varias
 * maneras y el importador solo junta lo que está seguro de que es lo mismo
 * («David Hernández» y «David Hernández Garcilazo» pueden ser dos personas). Lo
 * que quedó separado de más se arregla aquí, con una persona mirando.
 */
export async function mergeVolunteers(formData: FormData) {
  await requireServiceManager();
  const keepId = texto(formData.get("keepId"));
  const mergeId = texto(formData.get("mergeId"));
  if (!keepId || !mergeId || keepId === mergeId) return;

  const [queda, sale] = await Promise.all([
    prisma.volunteer.findUnique({ where: { id: keepId }, select: { name: true } }),
    prisma.volunteer.findUnique({ where: { id: mergeId }, select: { name: true } }),
  ]);
  if (!queda || !sale) return;

  await prisma.$transaction([
    prisma.serviceLog.updateMany({ where: { volunteerId: mergeId }, data: { volunteerId: keepId } }),
    prisma.user.deleteMany({ where: { volunteerId: mergeId } }),
    prisma.volunteer.delete({ where: { id: mergeId } }),
  ]);

  await logAudit({
    action: "servicio.prestador.fusion",
    summary: `Juntó la ficha de ${sale.name} con la de ${queda.name}`,
    entityType: "Volunteer",
    entityId: keepId,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${keepId}`);
  redirect(`/servicio-social/${keepId}`);
}

/* ── Reportes de horas ─────────────────────────────────────────────────────── */

export type ReporteState = { error?: string; ok?: boolean } | undefined;

/**
 * El prestador manda su reporte de la semana. Es el formulario de Google, pero
 * en casa: su nombre y su escuela ya los trae la ficha, así que solo captura el
 * área, el líder, la semana, las horas y lo que hizo.
 */
export async function submitServiceLog(
  _prev: ReporteState,
  formData: FormData,
): Promise<ReporteState> {
  const me = await requireVolunteer();

  const weekStart = parseDateInput(formData.get("weekStart"));
  const weekEnd = parseDateInput(formData.get("weekEnd"));
  const horasTexto = texto(formData.get("hours"));
  const activities = textoLargo(formData.get("activities"));

  if (!weekStart || !weekEnd) return { error: "Elige la fecha de inicio y la de término." };
  if (weekEnd < weekStart) {
    return { error: "La fecha de término no puede ser anterior a la de inicio." };
  }
  const minutos = parseHorasAMinutos(horasTexto);
  if (minutos == null) {
    return { error: "Escribe las horas como un número: 6, 8.5 o 10:30." };
  }
  if (minutos === 0) return { error: "Un reporte de 0 horas no hace falta mandarlo." };
  // Tope de una semana completa. Frena el dedazo de quien captura tres semanas
  // juntas —en la hoja vieja ya pasó— antes de que llegue a la coordinación.
  if (minutos > 100 * 60) {
    return { error: "Son demasiadas horas para una semana. Repórtala semana por semana." };
  }
  if (!activities) return { error: "Cuenta qué hiciste esta semana." };

  const volunteer = await prisma.volunteer.findUnique({
    where: { id: me.volunteerId },
    select: { name: true, areaId: true, leaderId: true },
  });
  if (!volunteer) return { error: "No encontramos tu ficha. Avisa a la coordinación." };

  const log = await prisma.serviceLog.create({
    data: {
      volunteerId: me.volunteerId,
      areaId: opcional(formData.get("areaId")) ?? volunteer.areaId,
      leaderId: opcional(formData.get("leaderId")) ?? volunteer.leaderId,
      weekStart,
      weekEnd,
      reportedMinutes: minutos,
      activities,
      source: "PLATAFORMA",
    },
    select: { id: true },
  });

  await logAudit({
    action: "servicio.reporte.envio",
    summary: `${volunteer.name} reportó ${horasLabel(minutos)} de servicio social`,
    entityType: "ServiceLog",
    entityId: log.id,
  });
  revalidatePath("/mi-servicio");
  revalidatePath("/servicio-social");
  return { ok: true };
}

/**
 * La coordinación autoriza o rechaza un reporte. Al autorizar puede contar menos
 * horas de las que se reportaron (en la hoja vieja eso se escribía a mano como
 * "se autorizan 20"): lo reportado NO se toca —es lo que la persona dijo que
 * hizo— y el recorte se guarda aparte, con su razón.
 */
export async function decideServiceLog(formData: FormData) {
  const me = await requireServiceManager();
  const id = texto(formData.get("id"));
  const decision = texto(formData.get("decision"));
  if (!id || !["AUTORIZADO", "NO_AUTORIZADO", "PENDIENTE"].includes(decision)) return;

  const log = await prisma.serviceLog.findUnique({
    where: { id },
    select: { reportedMinutes: true, volunteer: { select: { id: true, name: true } } },
  });
  if (!log) return;

  const recorteTexto = texto(formData.get("approvedHours"));
  const recorte = recorteTexto ? parseHorasAMinutos(recorteTexto) : null;
  const nota = textoLargo(formData.get("decisionNote")) || null;

  await prisma.serviceLog.update({
    where: { id },
    data: {
      status: decision as "AUTORIZADO" | "NO_AUTORIZADO" | "PENDIENTE",
      // Solo se guarda el recorte cuando de verdad es distinto de lo reportado.
      approvedMinutes:
        decision === "AUTORIZADO" && recorte != null && recorte !== log.reportedMinutes
          ? recorte
          : null,
      decisionNote: nota,
      decidedAt: decision === "PENDIENTE" ? null : new Date(),
      decidedById: decision === "PENDIENTE" ? null : me.id,
    },
  });

  const cuantas =
    decision === "AUTORIZADO" && recorte != null && recorte !== log.reportedMinutes
      ? ` (${horasLabel(recorte)} de las ${horasLabel(log.reportedMinutes)} reportadas)`
      : ` (${horasLabel(log.reportedMinutes)})`;
  await logAudit({
    action: decision === "AUTORIZADO" ? "servicio.reporte.autoriza" : "servicio.reporte.rechaza",
    summary:
      decision === "PENDIENTE"
        ? `Regresó a revisión el reporte de ${log.volunteer.name}`
        : `${decision === "AUTORIZADO" ? "Autorizó" : "No autorizó"} el reporte de ${log.volunteer.name}${cuantas}`,
    entityType: "ServiceLog",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${log.volunteer.id}`);
}

/**
 * Corrige a mano las horas de un reporte. Es para los que llegaron de la hoja
 * vieja con algo que no era un número ("1 hora y 15" sí se entendió; un párrafo
 * de actividades en el campo de horas, no): entraron en cero y con su texto
 * original a la vista para que alguien los lea y ponga el número bueno.
 */
export async function updateServiceLogHours(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  const minutos = parseHorasAMinutos(texto(formData.get("hours")));
  if (!id || minutos == null) return;

  const log = await prisma.serviceLog.update({
    where: { id },
    data: { reportedMinutes: minutos, rawHours: null },
    select: { volunteer: { select: { id: true, name: true } } },
  });
  await logAudit({
    action: "servicio.reporte.horas",
    summary: `Corrigió a ${horasLabel(minutos)} un reporte de ${log.volunteer.name}`,
    entityType: "ServiceLog",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${log.volunteer.id}`);
}

export async function deleteServiceLog(formData: FormData) {
  await requireServiceManager();
  const id = texto(formData.get("id"));
  if (!id) return;
  const log = await prisma.serviceLog.delete({
    where: { id },
    select: { weekStart: true, volunteer: { select: { id: true, name: true } } },
  });
  await logAudit({
    action: "servicio.reporte.baja",
    summary: `Eliminó un reporte de ${log.volunteer.name}`,
    entityType: "ServiceLog",
    entityId: id,
  });
  revalidatePath("/servicio-social");
  revalidatePath(`/servicio-social/${log.volunteer.id}`);
}

/* ── Catálogos de áreas y líderes ──────────────────────────────────────────── */

/**
 * Las áreas y los líderes son un catálogo y no una lista fija en el código: en el
 * formulario de Google han cambiado varias veces y algunas áreas traen el nombre
 * de quien las lleva. Se desactivan en vez de borrarse cuando ya tienen reportes
 * colgando: los de 2021 siguen nombrando áreas que hoy ya no se ofrecen.
 */
export async function createServiceCatalogEntry(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const name = texto(formData.get("name"));
  if (!name || (tipo !== "area" && tipo !== "lider")) return;

  if (tipo === "area") {
    await prisma.serviceArea.upsert({
      where: { name },
      update: { active: true },
      create: { name, order: 500 },
    });
  } else {
    await prisma.serviceLeader.upsert({
      where: { name },
      update: { active: true },
      create: { name, order: 500 },
    });
  }
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `Agregó «${name}» a ${tipo === "area" ? "las áreas" : "los líderes"} de servicio social`,
  });
  revalidatePath("/servicio-social/catalogos");
}

export async function setServiceCatalogActive(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const id = texto(formData.get("id"));
  const active = texto(formData.get("active")) === "true";
  if (!id || (tipo !== "area" && tipo !== "lider")) return;

  const entry =
    tipo === "area"
      ? await prisma.serviceArea.update({ where: { id }, data: { active }, select: { name: true } })
      : await prisma.serviceLeader.update({
          where: { id },
          data: { active },
          select: { name: true },
        });
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `${active ? "Reactivó" : "Desactivó"} «${entry.name}» en servicio social`,
  });
  revalidatePath("/servicio-social/catalogos");
}

/**
 * Borra una entrada del catálogo. Solo se puede si no la usa nadie: si ya tiene
 * reportes o prestadores colgando se desactiva, que para eso está.
 */
export async function deleteServiceCatalogEntry(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const id = texto(formData.get("id"));
  if (!id || (tipo !== "area" && tipo !== "lider")) return;

  const enUso = await prisma.serviceLog.count({
    where: tipo === "area" ? { areaId: id } : { leaderId: id },
  });
  if (enUso > 0) return;

  const entry =
    tipo === "area"
      ? await prisma.serviceArea.delete({ where: { id }, select: { name: true } })
      : await prisma.serviceLeader.delete({ where: { id }, select: { name: true } });
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `Quitó «${entry.name}» del catálogo de servicio social`,
  });
  revalidatePath("/servicio-social/catalogos");
}
