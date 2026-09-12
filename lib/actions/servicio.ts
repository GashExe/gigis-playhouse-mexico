"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireServiceManager, requireVolunteer } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { ensureVolunteerAccount } from "@/lib/accounts";
import {
  claveDeCorreo,
  clavesDePrestador,
  cuentaPalabras,
  seParecen,
  horasLabel,
  MAX_PALABRAS_ACTIVIDADES,
  parseHorasAMinutos,
} from "@/lib/servicio";

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

/**
 * La institución que se escogió, con su nombre tal como está en el catálogo.
 *
 * El formulario manda el id, no el texto: así lo que queda guardado es siempre
 * uno de los nombres de la lista, y el conteo de voluntarios por institución
 * cuadra. Si el id no existe o está retirado, se devuelve vacío y quien llama
 * decide —nunca se inventa una institución con lo que venga en el campo.
 */
async function resuelveInstitucion(
  schoolId: string | null,
): Promise<{ schoolId: string; school: string } | null> {
  if (!schoolId) return null;
  const inst = await prisma.serviceSchool.findFirst({
    where: { id: schoolId, active: true },
    select: { id: true, name: true },
  });
  return inst ? { schoolId: inst.id, school: inst.name } : null;
}

async function camposPrestador(formData: FormData) {
  const name = texto(formData.get("name"));
  const inst = await resuelveInstitucion(opcional(formData.get("schoolId")));
  // Al editar una ficha vieja, la institución puede ser una que no está en el
  // catálogo: en ese caso se respeta el texto que ya tenía en vez de vaciárselo.
  const school = inst?.school ?? texto(formData.get("school"));
  return {
    name,
    school,
    schoolId: inst?.schoolId ?? null,
    // Se recalculan en cada guardado: si el nombre cambia y las claves se quedan
    // con el viejo, la persona deja de aparecer al buscarla y los reportes que
    // lleguen por la liga le abrirían una ficha nueva, sin que nadie sepa por qué.
    ...clavesDePrestador(name, school, texto(formData.get("email"))),
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
  const data = await camposPrestador(formData);
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
  const data = await camposPrestador(formData);
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

/**
 * Lo que la liga abierta contesta al validar un correo. Solo lleva lo que el
 * formulario necesita para rellenarse: el nombre y los tres ids de sus listas.
 * Nada de horas, ni de historial, ni del resto del expediente.
 */
export type ValidaCorreoState =
  | { estado: "nuevo" }
  | {
      estado: "encontrado";
      name: string;
      schoolId: string | null;
      areaId: string | null;
      leaderId: string | null;
    }
  | { estado: "invalido" }
  | undefined;

/**
 * Busca al prestador por su correo para rellenarle el formulario.
 *
 * Es deliberadamente cortita: pide el correo COMPLETO y exacto, no busca por
 * nombre ni por partes, y solo devuelve lo que se va a pintar en los campos.
 * Aun así, sí dice si un correo está registrado o no —no hay manera de rellenar
 * un formulario sin decirlo—, y eso lo pidió la casa a sabiendas: quien ya
 * conoce el correo de alguien puede confirmar que colabora aquí. Por eso la
 * coincidencia es exacta: sirve para reconocerse, no para ir probando.
 */
export async function validarCorreo(
  _prev: ValidaCorreoState,
  formData: FormData,
): Promise<ValidaCorreoState> {
  const emailKey = claveDeCorreo(texto(formData.get("email")));
  if (!emailKey) return { estado: "invalido" };

  const prestador = await prisma.volunteer.findFirst({
    where: { emailKey },
    select: { name: true, schoolId: true, areaId: true, leaderId: true },
  });
  if (!prestador) return { estado: "nuevo" };

  return {
    estado: "encontrado",
    name: prestador.name,
    schoolId: prestador.schoolId,
    areaId: prestador.areaId,
    leaderId: prestador.leaderId,
  };
}

export type ReporteState =
  | {
      error?: string;
      ok?: boolean;
      /** A nombre de quién quedó el reporte, para devolvérselo a quien lo mandó. */
      nombre?: string;
      /**
       * Cuántos van en esta sesión. Suena a adorno y no lo es: es lo que le
       * permite al formulario saber que hubo un envío NUEVO y limpiar los campos
       * de la semana. Sin un valor que cambie, el segundo envío se ve igual que
       * el primero y el formulario se queda lleno, invitando a mandarlo de nuevo.
       */
      enviados?: number;
    }
  | undefined;

/**
 * Lo que revisa cualquier reporte, venga de una cuenta o de la liga abierta.
 * Está en un solo lugar para que las dos puertas pidan exactamente lo mismo: si
 * una fuera más laxa, esa sería la que todo mundo acabaría usando.
 */
function revisaReporte(input: {
  weekStart: Date | null;
  weekEnd: Date | null;
  horasTexto: string;
  activities: string;
}): { error: string } | { minutos: number; weekStart: Date; weekEnd: Date } {
  if (!input.weekStart || !input.weekEnd) {
    return { error: "Elige la fecha de inicio y la de término." };
  }
  if (input.weekEnd < input.weekStart) {
    return { error: "La fecha de término no puede ser anterior a la de inicio." };
  }
  const minutos = parseHorasAMinutos(input.horasTexto);
  if (minutos == null) return { error: "Escribe las horas como un número: 6, 8.5 o 10:30." };
  if (minutos === 0) return { error: "Un reporte de 0 horas no hace falta mandarlo." };
  // Tope de una semana completa. Frena el dedazo de quien captura tres semanas
  // juntas —en la hoja vieja ya pasó— antes de que llegue a la coordinación.
  if (minutos > 100 * 60) {
    return { error: "Son demasiadas horas para una semana. Repórtala semana por semana." };
  }
  if (!input.activities) return { error: "Cuenta qué hiciste esta semana." };
  const palabras = cuentaPalabras(input.activities);
  if (palabras > MAX_PALABRAS_ACTIVIDADES) {
    return {
      error: `Resume tus actividades en ${MAX_PALABRAS_ACTIVIDADES} palabras o menos (llevas ${palabras}).`,
    };
  }
  // Devuelve las fechas ya comprobadas, y no solo los minutos, para que quien
  // llama no tenga que volver a jurar que no son nulas.
  return { minutos, weekStart: input.weekStart, weekEnd: input.weekEnd };
}

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

  const revision = revisaReporte({ weekStart, weekEnd, horasTexto, activities });
  if ("error" in revision) return revision;
  const { minutos, weekStart: inicio, weekEnd: fin } = revision;

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
      weekStart: inicio,
      weekEnd: fin,
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
 * El reporte que llega por la LIGA ABIERTA, sin cuenta. Es el Google Form tal
 * cual: cualquiera con la liga escribe su nombre y manda su semana.
 *
 * Por eso lo que se puede hacer aquí está acotado a propósito:
 *
 *  - Solo CREA reportes, y siempre PENDIENTES. Nada se autoriza solo y nadie
 *    puede editar ni borrar lo que ya está: quien manda no está identificado.
 *  - No lee ni devuelve nada del padrón. Un formulario abierto que contestara
 *    "ese prestador no existe" sería una manera de averiguar quién colabora aquí.
 *  - Reconoce a la persona por `nameKey` —el nombre sin acentos ni mayúsculas— y
 *    cae en la ficha que ya existe. Es la única defensa contra lo que pasó en la
 *    hoja vieja, donde el mismo prestador acabó repartido en tres fichas por
 *    escribir su nombre distinto. No alcanza para todo: quien hoy pone su nombre
 *    completo y mañana el corto sigue abriendo ficha aparte, y eso lo junta la
 *    coordinación desde «Juntar con otra ficha».
 *  - Si la ficha nace aquí, nace ACTIVO y sin meta de horas: la meta la marca su
 *    escuela y este formulario no tiene manera de saberla.
 */
export async function submitPublicServiceLog(
  _prev: ReporteState,
  formData: FormData,
): Promise<ReporteState> {
  const name = texto(formData.get("name"));
  const emailKey = claveDeCorreo(texto(formData.get("email")));
  const institucion = await resuelveInstitucion(opcional(formData.get("schoolId")));
  const weekStart = parseDateInput(formData.get("weekStart"));
  const weekEnd = parseDateInput(formData.get("weekEnd"));
  const horasTexto = texto(formData.get("hours"));
  const activities = textoLargo(formData.get("activities"));
  const areaId = opcional(formData.get("areaId"));
  const leaderId = opcional(formData.get("leaderId"));

  if (name.length < 5 || name.split(" ").length < 2) {
    return { error: "Escribe tu nombre completo, con apellidos." };
  }
  if (name.length > 120) return { error: "Revisa tu nombre: es demasiado largo." };
  if (!institucion) {
    return {
      error:
        "Escoge tu institución de la lista. Si no está, pídele a la coordinación que la agregue.",
    };
  }
  const school = institucion.school;
  if (!emailKey) return { error: "Escribe tu correo. Con él reconocemos que eres tú." };
  if (!areaId || !leaderId) return { error: "Escoge el área y tu líder de área." };

  const revision = revisaReporte({ weekStart, weekEnd, horasTexto, activities });
  if ("error" in revision) return revision;
  const { minutos, weekStart: inicio, weekEnd: fin } = revision;

  // El área y el líder tienen que ser de los que se ofrecen HOY: así lo que llega
  // de fuera no puede sembrar una fila apuntando a un catálogo que ya se retiró.
  const [area, leader] = await Promise.all([
    prisma.serviceArea.findFirst({ where: { id: areaId, active: true }, select: { id: true } }),
    prisma.serviceLeader.findFirst({ where: { id: leaderId, active: true }, select: { id: true } }),
  ]);
  if (!area || !leader) return { error: "Escoge el área y tu líder de área." };

  const claves = clavesDePrestador(name, school, emailKey);

  // A quién se le acreditan estas horas. Se busca en tres pasos, del más seguro
  // al menos seguro, y el primero que da algo manda:
  //
  //   1. El MISMO correo. Quien escribió "Paul Ramirz" pero puso su correo de
  //      siempre es la misma persona, y su reporte cae en SU ficha.
  //
  //   2. El MISMO nombre, para quien todavía no ha dado correo. Casi todas las
  //      fichas vienen de la hoja del formulario y ninguna trae uno.
  //
  //   3. Un nombre que se PARECE, y solo si hay exactamente una candidata. Este
  //      paso existe porque los dos primeros fallan juntos más seguido de lo que
  //      parece: basta un dedazo en el correo —"paul.ramirezij@" en vez de
  //      "paul.ramirezji@"— para que el paso 1 no encuentre nada, y entonces
  //      "Paul Ramirez" tampoco empata con "Paul Francisco Ramirez Jimenez". Así
  //      nació una ficha repetida de alguien que ya estaba.
  //
  // Si se parecen DOS o más, no se escoge ninguna: con varias candidatas, cargarle
  // las horas a la que tocó sería quitárselas a la otra.
  let prestador = await prisma.volunteer.findFirst({
    where: { emailKey },
    select: { id: true, name: true, emailKey: true },
  });
  const reconocidoPorCorreo = prestador != null;
  if (!prestador) {
    prestador = await prisma.volunteer.findFirst({
      where: { nameKey: claves.nameKey },
      select: { id: true, name: true, emailKey: true },
    });
  }
  if (!prestador) {
    // Se acota por el primer nombre para no bajar el padrón entero.
    const primerNombre = claves.nameKey.split(" ")[0] ?? "";
    const cercanas = primerNombre
      ? await prisma.volunteer.findMany({
          where: { nameKey: { startsWith: `${primerNombre} ` } },
          select: { id: true, name: true, nameKey: true, emailKey: true },
        })
      : [];
    const parecidas = cercanas.filter((c) => seParecen(c.nameKey, claves.nameKey));
    if (parecidas.length === 1) prestador = parecidas[0];
  }
  // Se le guarda el correo la primera vez que lo da: de ahí en adelante ya se le
  // reconoce por ahí aunque escriba su nombre distinto. No se le pisa el que ya
  // tenga: si son dos distintos, eso lo mira una persona.
  if (prestador && !prestador.emailKey) {
    await prisma.volunteer.update({
      where: { id: prestador.id },
      data: { email: texto(formData.get("email")), emailKey },
    });
  }

  const volunteerId =
    prestador?.id ??
    (
      await prisma.volunteer.create({
        data: {
          name,
          school,
          schoolId: institucion.schoolId,
          email: texto(formData.get("email")),
          ...claves,
          areaId,
          leaderId,
          startDate: inicio,
        },
        select: { id: true },
      })
    ).id;

  // Qué nombre queda. Cuando se le reconoció POR SU CORREO —identidad fuerte, la
  // tecleó él mismo y empató exacta— se le hace caso si lo corrigió: nadie más
  // que uno sabe cómo se escribe su nombre. Cuando se le reconoció por parecido
  // de nombre, NO: ahí la identidad es una suposición, y dejar que reescriba el
  // nombre de otra ficha con lo de hoy es justo cómo se echa a perder el que ya
  // servía.
  const porCorreo = prestador != null && reconocidoPorCorreo;
  const nombreEnFicha = porCorreo ? name : (prestador?.name ?? name);
  if (prestador && porCorreo && prestador.name !== name) {
    await prisma.volunteer.update({
      where: { id: prestador.id },
      data: { name, ...clavesDePrestador(name, school, emailKey) },
    });
  }

  // Guarda contra el doble envío: el mismo reporte, mandado dos veces porque la
  // página tardó o alguien le dio dos veces al botón, no debe contar doble.
  const repetido = await prisma.serviceLog.findFirst({
    where: { volunteerId, weekStart: inicio, weekEnd: fin, activities },
    select: { id: true },
  });
  if (repetido) {
    return { ok: true, nombre: nombreEnFicha, enviados: (_prev?.enviados ?? 0) + 1 };
  }

  await prisma.serviceLog.create({
    data: {
      volunteerId,
      areaId,
      leaderId,
      weekStart: inicio,
      weekEnd: fin,
      reportedMinutes: minutos,
      activities,
      source: "LIGA_PUBLICA",
    },
  });

  // Sin logAudit: la bitácora atribuye movimientos a una CUENTA, y aquí no hay
  // ninguna. De dónde vino queda en `source`, que es lo honesto que se puede decir.
  revalidatePath("/servicio-social");
  // Se le devuelve a nombre de quién quedó: es la única manera de que se dé
  // cuenta, ahí mismo, de que escribió su nombre distinto o el correo de alguien
  // más. Solo después de un envío completo y válido, nunca mientras teclea.
  return { ok: true, nombre: nombreEnFicha, enviados: (_prev?.enviados ?? 0) + 1 };
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
type TipoCatalogo = "area" | "lider" | "escuela";

const CATALOGO_LABEL: Record<TipoCatalogo, string> = {
  area: "las áreas",
  lider: "los líderes",
  escuela: "las instituciones",
};

function esTipo(v: string): v is TipoCatalogo {
  return v === "area" || v === "lider" || v === "escuela";
}

/**
 * Los tres catálogos se manejan igual, así que comparten estas acciones en vez de
 * estar escritas tres veces. Prisma no deja indexar sus delegados con un tipo
 * suelto sin perder los tipos de cada modelo, por eso el `switch`: es explícito y
 * el compilador sigue cuidando cada rama.
 */
async function upsertCatalogo(tipo: TipoCatalogo, name: string) {
  const datos = { where: { name }, update: { active: true }, create: { name, order: 500 } };
  if (tipo === "area") return prisma.serviceArea.upsert({ ...datos, select: { id: true } });
  if (tipo === "lider") return prisma.serviceLeader.upsert({ ...datos, select: { id: true } });
  return prisma.serviceSchool.upsert({ ...datos, select: { id: true } });
}

async function activaCatalogo(tipo: TipoCatalogo, id: string, active: boolean) {
  const datos = { where: { id }, data: { active }, select: { name: true } };
  if (tipo === "area") return prisma.serviceArea.update(datos);
  if (tipo === "lider") return prisma.serviceLeader.update(datos);
  return prisma.serviceSchool.update(datos);
}

async function borraCatalogo(tipo: TipoCatalogo, id: string) {
  const datos = { where: { id }, select: { name: true } };
  if (tipo === "area") return prisma.serviceArea.delete(datos);
  if (tipo === "lider") return prisma.serviceLeader.delete(datos);
  return prisma.serviceSchool.delete(datos);
}

/** ¿Alguien está usando esta entrada? Lo que se usa no se borra: se desactiva. */
async function usosCatalogo(tipo: TipoCatalogo, id: string): Promise<number> {
  if (tipo === "escuela") return prisma.volunteer.count({ where: { schoolId: id } });
  const [logs, prestadores] = await Promise.all([
    prisma.serviceLog.count({ where: tipo === "area" ? { areaId: id } : { leaderId: id } }),
    prisma.volunteer.count({ where: tipo === "area" ? { areaId: id } : { leaderId: id } }),
  ]);
  return logs + prestadores;
}

function refrescaCatalogos() {
  revalidatePath("/servicio-social/catalogos");
  revalidatePath("/servicio-social");
  // /reportar no se refresca aquí: se arma en cada visita, así que ya sale con
  // estas listas al día.
}

/**
 * Las áreas, los líderes y las instituciones son catálogos y no listas fijas en
 * el código: las tres han cambiado varias veces y la casa las mueve sola. Lo que
 * ya no se ofrece se desactiva en vez de borrarse cuando tiene algo colgando —los
 * reportes siguen nombrando áreas que hoy ya no se usan.
 */
export async function createServiceCatalogEntry(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const name = texto(formData.get("name"));
  if (!name || !esTipo(tipo)) return;

  await upsertCatalogo(tipo, name);
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `Agregó «${name}» a ${CATALOGO_LABEL[tipo]} de servicio social`,
  });
  refrescaCatalogos();
}

export async function setServiceCatalogActive(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const id = texto(formData.get("id"));
  const active = texto(formData.get("active")) === "true";
  if (!id || !esTipo(tipo)) return;

  const entry = await activaCatalogo(tipo, id, active);
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `${active ? "Reactivó" : "Desactivó"} «${entry.name}» en servicio social`,
  });
  refrescaCatalogos();
}

/**
 * Borra una entrada del catálogo. Solo se puede si no la usa nadie: si ya tiene
 * reportes o prestadores colgando se desactiva, que para eso está.
 */
export async function deleteServiceCatalogEntry(formData: FormData) {
  await requireServiceManager();
  const tipo = texto(formData.get("tipo"));
  const id = texto(formData.get("id"));
  if (!id || !esTipo(tipo)) return;

  if ((await usosCatalogo(tipo, id)) > 0) return;

  const entry = await borraCatalogo(tipo, id);
  await logAudit({
    action: "servicio.catalogo.editar",
    summary: `Quitó «${entry.name}» del catálogo de servicio social`,
  });
  refrescaCatalogos();
}
