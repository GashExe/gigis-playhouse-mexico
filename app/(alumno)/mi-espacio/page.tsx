import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sparkle,
  Confetti,
  Clock,
  ChatCircleText,
  ListChecks,
  Megaphone,
  CalendarX,
  ChartLineUp,
  CaretRight,
  HandHeart,
  Hourglass,
  Lock,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getStudentSpace,
  getActiveCycle,
  getFamilyOffer,
  listFamilyMessages,
  listUpcomingSuspensionsFor,
  listFamilyCampaigns,
} from "@/lib/queries";
import { getLegalConfig, needsOnboarding } from "@/lib/legal";
import { hasSurveyResponse } from "@/lib/survey";
import { slotsLabel, slotsForLevel } from "@/lib/schedule";
import { fecha, fechaDia } from "@/lib/format";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DonationCountdown } from "@/components/donation-countdown";
import { TutorialVideo } from "@/components/tutorial-video";
import { FamilyEnrollmentPicker } from "@/components/family-enrollment-picker";

export const metadata: Metadata = { title: "Mi espacio" };

export default async function MiEspacioPage() {
  const user = await getCurrentUser();
  const cycle = await getActiveCycle();
  const student = user.studentId
    ? await getStudentSpace(user.studentId, cycle?.id)
    : null;

  // Compuerta: sin datos básicos + salud + aviso/reglamento aceptados, no hay acceso a clases.
  if (student && needsOnboarding(student, (await getLegalConfig()).version)) {
    redirect("/mi-espacio/bienvenida");
  }

  // Compuerta de fin de ciclo: si la encuesta está abierta y la familia no la ha
  // contestado, se le pide antes de seguir usando Mi espacio.
  if (student && cycle?.surveyOpen && user.studentId) {
    if (!(await hasSurveyResponse(user.studentId, cycle.id))) {
      redirect("/mi-espacio/encuesta");
    }
  }

  // Nivel del alumno por programa en el ciclo activo, para mostrar el horario de SU nivel.
  const levelByProgram = new Map(
    (student?.levelRecords ?? []).map((r) => [r.programId, r.programLevelId]),
  );

  const [offer, messages, suspensions, campaigns] = user.studentId
    ? await Promise.all([
        cycle
          ? getFamilyOffer(user.studentId, cycle.id)
          : Promise.resolve(null),
        // Una sola bandeja: avisos de dirección y anotaciones del equipo juntos.
        listFamilyMessages(user.studentId),
        listUpcomingSuspensionsFor(user.studentId),
        listFamilyCampaigns(user.studentId),
      ])
    : [null, [], [], []];

  const firstName = (student?.firstName ?? user.name).split(" ")[0];
  const programs = student?.enrollments ?? [];
  const attendance = student?.attendance ?? [];
  // En la pantalla va solo el último; el resto está en el historial.
  const ultimoMensaje = messages[0] ?? null;
  const sinLeer = user.messagesSeenAt
    ? messages.filter((m) => m.createdAt > user.messagesSeenAt!).length
    : messages.length;
  // Compuerta de donativos: una campaña obligatoria sin cumplir bloquea apartar clases.
  const blockingCampaigns = campaigns.filter((c) => c.blocking);
  const donationBlocked = blockingCampaigns.length > 0;

  const pesos = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(n);

  const ATTENDANCE_LABEL: Record<string, { text: string; cls: string }> = {
    PRESENTE: { text: "Presente", cls: "bg-success-weak text-success-strong" },
    RETARDO: { text: "Retardo", cls: "bg-warning-weak text-warning-strong" },
    JUSTIFICADO: { text: "Justificado", cls: "bg-info-weak text-info" },
    AUSENTE: { text: "Ausente", cls: "bg-danger-weak text-danger-strong" },
  };

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <section>
        <p className="text-sm font-semibold text-primary-strong">Hola de nuevo</p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          ¡Bienvenid@, {firstName}!
        </h1>
        {student?.matricula && (
          <p className="mt-2 text-sm text-muted">
            Matrícula:{" "}
            <span className="font-semibold text-ink">{student.matricula}</span>
          </p>
        )}
      </section>

      {/* Video tutorial: se abre solo la primera vez y queda siempre a la mano */}
      <TutorialVideo
        src="/tutoriales/tutorial-familias.mp4"
        title="Video tutorial para las familias"
        description="Cómo usar tu espacio de Gigi's. Puedes volver a verlo cuando quieras."
        autoOpen={user.tutorialSeenAt === null}
      />

      {/* Ver el proceso del niño */}
      <Link
        href="/mi-espacio/proceso"
        className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-weak text-primary-strong">
          <ChartLineUp weight="fill" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">El proceso de {firstName}</span>
          <span className="block text-sm text-muted">
            Mira cómo va en cada programa: su nivel y qué tanto lleva avanzado.
          </span>
        </span>
        <CaretRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>

      {/* Campañas de donativos */}
      {campaigns.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <HandHeart weight="fill" className="size-5 text-primary" />
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Campañas de Gigi&apos;s
            </h2>
          </div>
          {donationBlocked && (
            <div className="rounded-[var(--radius-card)] border border-warning bg-warning-weak/40 p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-warning-strong">
                <Lock weight="fill" className="size-4" />
                La inscripción está en pausa
              </p>
              <p className="mt-1 text-sm text-ink">
                Para volver a inscribir actividades, primero hay que cumplir el donativo obligatorio
                pendiente. Si ya lo hiciste o necesitas más tiempo, avísale a la dirección.
              </p>
            </div>
          )}
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink">{c.title}</h3>
                  {c.mandatory && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-weak px-2 py-0.5 text-[0.7rem] font-bold text-warning-strong">
                      <Lock className="size-3" />
                      Obligatoria
                    </span>
                  )}
                  {c.satisfied ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                      <CheckCircle weight="fill" className="size-3" />
                      {c.status === "GRACIA" ? "Con prórroga" : "Cumplido"}
                    </span>
                  ) : c.blocking ? (
                    <span className="inline-flex items-center rounded-full bg-danger-weak px-2 py-0.5 text-[0.7rem] font-bold text-danger-strong">
                      Pendiente
                    </span>
                  ) : c.countingDown ? (
                    <span className="inline-flex items-center rounded-full bg-warning-weak px-2 py-0.5 text-[0.7rem] font-bold text-warning-strong">
                      Por cumplir
                    </span>
                  ) : null}
                </div>
                {c.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {c.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                  {c.goalLabel && (
                    <span>
                      Aportación: <span className="font-semibold text-ink">{c.goalLabel}</span>
                    </span>
                  )}
                  {c.goalLabel == null && c.goalAmount != null && (
                    <span>
                      Aportación:{" "}
                      <span className="font-semibold text-ink">{pesos(c.goalAmount)}</span>
                    </span>
                  )}
                  {c.dueDate && <span>Antes del {fechaDia(c.dueDate)}</span>}
                  {c.status === "GRACIA" && c.graceValid && c.graceUntil && (
                    <span className="font-semibold text-info">
                      Prórroga hasta {fechaDia(c.graceUntil)}
                    </span>
                  )}
                </div>
                {/* Cuenta regresiva: aún puede apartar clases; al llegar la fecha se pausa. */}
                {c.countingDown && c.dueDate && (
                  <div className="mt-3 rounded-[var(--radius-control)] border border-warning/50 bg-warning-weak/30 p-3">
                    <DonationCountdown target={new Date(c.dueDate).toISOString()} />
                    <p className="mt-2 text-xs text-muted">
                      Aún puedes inscribir clases. Al llegar la fecha límite se pausará hasta
                      cumplir el donativo o recibir una prórroga.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mensajes: una sola bandeja con los avisos de la dirección y las
          anotaciones del equipo. Se enseña el último y el resto queda en el
          historial; antes se volcaban los diez avisos y las veinte anotaciones
          completas, y lo importante se perdía en el scroll. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ChatCircleText weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Mensajes de Gigi&apos;s
          </h2>
          {sinLeer > 0 && (
            <span className="rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
              {sinLeer === 1 ? "1 nuevo" : `${sinLeer} nuevos`}
            </span>
          )}
        </div>

        {ultimoMensaje ? (
          <article className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center gap-2">
              {ultimoMensaje.kind === "AVISO" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-weak px-2 py-0.5 text-[0.7rem] font-bold text-primary-strong">
                  <Megaphone weight="fill" className="size-3" />
                  Aviso
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold text-white"
                  style={{
                    backgroundColor: ultimoMensaje.program?.color ?? "var(--brand-teal)",
                  }}
                >
                  {ultimoMensaje.program?.name ?? "Anotación"}
                </span>
              )}
              <span className="ml-auto text-xs text-subtle">
                {fecha(ultimoMensaje.createdAt)}
              </span>
            </div>
            {ultimoMensaje.title && (
              <h3 className="mt-1.5 font-bold text-ink">{ultimoMensaje.title}</h3>
            )}
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {ultimoMensaje.body}
            </p>
            <p className="mt-1.5 text-xs text-subtle">— {ultimoMensaje.author}</p>
          </article>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-6 text-center text-sm text-muted">
            {`Aquí verás los avisos de Gigi's y lo que el equipo comparta sobre ${firstName}.`}
          </p>
        )}

        {messages.length > 1 && (
          <Link
            href="/mi-espacio/mensajes"
            className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 transition-colors hover:border-primary"
          >
            <span className="flex-1 text-sm font-bold text-ink">
              Ver historial de mensajes
            </span>
            <span className="text-xs text-muted">{messages.length} en total</span>
            <CaretRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        )}
      </section>

      {/* Clases suspendidas próximas */}
      {suspensions.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-warning bg-warning-weak/40 p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-warning-strong">
            <CalendarX weight="fill" className="size-4" />
            Clases suspendidas
          </h2>
          <ul className="mt-2 space-y-1.5">
            {suspensions.map((s) => (
              <li key={s.id} className="text-sm text-ink">
                <span className="font-semibold">{s.program.name}</span> — no habrá clase
                el <span className="font-semibold">{fechaDia(s.date)}</span>
                {s.cancelReason ? (
                  <span className="text-muted"> · {s.cancelReason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Inscripción del ciclo: la familia arma su hoja y la manda de una vez
          (en pausa si hay un donativo obligatorio sin cumplir) */}
      {offer && !donationBlocked && (
        <>
          <FamilyEnrollmentPicker
            firstName={firstName}
            cycleLabel={cycle?.label ?? null}
            enrollmentOpen={offer.enrollmentOpen}
            submittedAt={offer.submittedAt ? offer.submittedAt.toISOString() : null}
            maxEnrollments={offer.load.max}
            programs={offer.programs.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              area: p.area,
              ageMin: p.ageMin,
              ageMax: p.ageMax,
              studentCapacity: p.studentCapacity,
              allowFamilyEnroll: p.allowFamilyEnroll,
              teacherName: p.teacher?.name ?? null,
              ageOk: p.ageOk,
              dropped: p.dropped,
              enrolled: offer.enrolledProgramIds.has(p.id),
              occupied: p._count.enrollments,
              slots: p.slots,
            }))}
          />

          {/* Lo que no puede inscribir sola (lleno, de lista de dirección o fuera de
              su edad) no desaparece: se pide por lista de espera. */}
          <Link
            href="/mi-espacio/lista-espera"
            className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2/40 p-4 transition-colors hover:border-primary"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-weak text-primary-strong">
              <Hourglass weight="fill" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">
                ¿No aparece lo que buscas, o el cupo está lleno?
              </span>
              <span className="block text-xs text-muted">
                Mira todas las actividades del ciclo y pide lugar en lista de espera.
              </span>
            </span>
            <CaretRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </>
      )}

      {/* Programas en los que está inscrito */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkle weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Programas de {firstName}
          </h2>
        </div>

        {programs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
            <Confetti weight="fill" className="size-8 text-brand-purple" />
            <p className="text-sm font-medium text-muted">
              Aún no hay programas asignados. El equipo de Gigi&apos;s los
              registrará pronto.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {programs.map((e) => {
              const color = e.program.color ?? "var(--brand-teal)";
              const horario = slotsLabel(
                slotsForLevel(
                  e.program.scheduleSlots,
                  levelByProgram.get(e.program.id) ?? null,
                ),
              );
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
                >
                  <span
                    aria-hidden
                    className="mt-1 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {e.program.name}
                    </p>
                    {e.program.area && (
                      <p className="truncate text-xs text-muted">
                        {e.program.area}
                      </p>
                    )}
                    {horario && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                        <Clock className="size-3.5 shrink-0 text-subtle" />
                        {horario}
                      </p>
                    )}
                    {e.program.teacher && (
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        Con {e.program.teacher.name}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Asistencia reciente */}
      {attendance.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks weight="fill" className="size-5 text-primary" />
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Asistencia reciente
            </h2>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)]">
            {attendance.map((a) => {
              const meta = ATTENDANCE_LABEL[a.status] ?? {
                text: a.status,
                cls: "bg-surface-2 text-muted",
              };
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: a.session.program.color ?? "var(--brand-teal)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {a.session.program.name}
                    </p>
                    <p className="text-xs text-subtle">
                      {fechaDia(a.session.date)}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.cls}`}
                  >
                    {meta.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Mi cuenta: la familia cambia su propia contraseña */}
      <ChangePasswordForm />
    </div>
  );
}
