import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  Sparkle,
  Confetti,
  Clock,
  ChatCircleText,
  ListChecks,
  Megaphone,
  CalendarX,
  UsersThree,
  HourglassMedium,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  getStudentSpace,
  getActiveCycle,
  getFamilyOffer,
  listAnnouncementsFor,
  listUpcomingSuspensionsFor,
} from "@/lib/queries";
import { requestReservation, cancelReservation } from "@/lib/actions/reservations";
import { meetsAgeRequirement } from "@/lib/queries";
import { needsOnboarding } from "@/lib/legal";
import { slotsLabel } from "@/lib/schedule";
import { fecha, fechaDia } from "@/lib/format";
import { ageFrom } from "@/lib/utils";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata: Metadata = { title: "Mi espacio" };

export default async function MiEspacioPage() {
  const user = await getCurrentUser();
  const student = user.studentId ? await getStudentSpace(user.studentId) : null;

  // Compuerta: sin datos básicos + salud + aviso/reglamento aceptados, no hay acceso a clases.
  if (student && needsOnboarding(student)) {
    redirect("/mi-espacio/bienvenida");
  }

  const cycle = await getActiveCycle();
  const [offer, announcements, suspensions] = user.studentId
    ? await Promise.all([
        cycle
          ? getFamilyOffer(user.studentId, cycle.id)
          : Promise.resolve(null),
        listAnnouncementsFor(user.studentId),
        listUpcomingSuspensionsFor(user.studentId),
      ])
    : [null, [], []];

  const firstName = (student?.firstName ?? user.name).split(" ")[0];
  const programs = student?.enrollments ?? [];
  const teamNotes = student?.studentNotes ?? [];
  const attendance = student?.attendance ?? [];

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

      {/* Anuncios de la dirección */}
      {announcements.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone weight="fill" className="size-5 text-primary" />
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Avisos de Gigi&apos;s
            </h2>
          </div>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold text-ink">{a.title}</h3>
                  <span className="text-xs text-subtle">{fecha(a.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {a.body}
                </p>
                {a.author && (
                  <p className="mt-1.5 text-xs text-subtle">— {a.author.name}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* Apartar actividades del ciclo */}
      {offer && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="flex items-center gap-2">
              <CalendarCheck weight="fill" className="size-5 text-primary" />
              <h2 className="text-base font-extrabold tracking-tight text-ink">
                Apartar actividades
              </h2>
            </span>
            {cycle && (
              <span className="text-xs font-semibold text-subtle">
                Ciclo {cycle.label}
              </span>
            )}
          </div>
          <p className="-mt-2 text-sm text-muted">
            Pide lugar en una actividad para {firstName}; el equipo de Gigi&apos;s
            confirma tu solicitud.
          </p>
          {(() => {
            const available = offer.programs.filter(
              (p) => !offer.enrolledProgramIds.has(p.id),
            );
            if (available.length === 0) {
              return (
                <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-6 text-center text-sm text-muted">
                  {firstName} ya está en todas las actividades del ciclo. 🎉
                </p>
              );
            }
            const byProgram = new Map(offer.reservations.map((r) => [r.programId, r]));
            const age = ageFrom(offer.birthDate);
            return (
              <ul className="grid gap-3 sm:grid-cols-2">
                {available.map((p) => {
                  const color = p.color ?? "var(--brand-teal)";
                  const horario = slotsLabel(p.scheduleSlots);
                  const left = Math.max(0, p.studentCapacity - p._count.enrollments);
                  const reservation = byProgram.get(p.id);
                  const pendingRes = reservation?.status === "PENDIENTE";
                  const rejected = reservation?.status === "RECHAZADA";
                  // Requisitos de la actividad: si no se cumplen, no se puede apartar.
                  const ageOk = meetsAgeRequirement(age, p.ageMin, p.ageMax);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <p className="truncate font-semibold text-ink">{p.name}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${
                            left === 0
                              ? "bg-danger-weak text-danger-strong"
                              : "bg-success-weak text-success-strong"
                          }`}
                        >
                          {left === 0 ? "Cupo lleno" : `${left} lugares`}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-xs text-muted">
                        {horario && (
                          <p className="flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0 text-subtle" />
                            {horario}
                          </p>
                        )}
                        {(p.ageMin != null || p.ageMax != null) && (
                          <p className="flex items-center gap-1.5">
                            <UsersThree className="size-3.5 shrink-0 text-subtle" />
                            {p.ageMin != null && p.ageMax != null
                              ? `${p.ageMin}–${p.ageMax} años`
                              : p.ageMin != null
                                ? `Desde ${p.ageMin} años`
                                : `Hasta ${p.ageMax} años`}
                          </p>
                        )}
                        {p.teacher && <p>Con {p.teacher.name}</p>}
                      </div>
                      <div className="mt-auto pt-1">
                        {!ageOk ? (
                          <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-center text-xs font-semibold text-muted">
                            Esta actividad es para{" "}
                            {p.ageMin != null && p.ageMax != null
                              ? `${p.ageMin}–${p.ageMax} años`
                              : p.ageMin != null
                                ? `${p.ageMin} años en adelante`
                                : `hasta ${p.ageMax} años`}
                            .
                          </p>
                        ) : pendingRes ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-warning-strong">
                              <HourglassMedium weight="fill" className="size-3.5" />
                              Solicitud enviada
                            </span>
                            <form action={cancelReservation.bind(null, reservation!.id)}>
                              <button
                                type="submit"
                                className="flex items-center gap-1 rounded-[var(--radius-input)] px-2 py-1 text-xs font-semibold text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                              >
                                <X className="size-3.5" />
                                Cancelar
                              </button>
                            </form>
                          </div>
                        ) : (
                          <form action={requestReservation}>
                            <input type="hidden" name="programId" value={p.id} />
                            <button
                              type="submit"
                              disabled={left === 0}
                              className="w-full rounded-[var(--radius-control)] bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {rejected ? "Volver a pedir lugar" : "Apartar lugar"}
                            </button>
                            {rejected && (
                              <p className="mt-1 text-center text-[0.7rem] text-muted">
                                La solicitud anterior no se pudo aceptar.
                              </p>
                            )}
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>
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
              const horario = slotsLabel(e.program.scheduleSlots);
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

      {/* Anotaciones del equipo para la familia */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ChatCircleText weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Anotaciones del equipo
          </h2>
        </div>
        {teamNotes.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-6 text-center text-sm text-muted">
            Aquí verás los avisos y avances que el equipo comparta sobre {firstName}.
          </p>
        ) : (
          <ul className="space-y-3">
            {teamNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {n.program && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: n.program.color ?? "var(--brand-teal)" }}
                    >
                      {n.program.name}
                    </span>
                  )}
                  <span className="text-xs text-subtle">{fecha(n.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {n.body}
                </p>
                {n.author && (
                  <p className="mt-1.5 text-xs text-subtle">— {n.author.name}</p>
                )}
              </li>
            ))}
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
