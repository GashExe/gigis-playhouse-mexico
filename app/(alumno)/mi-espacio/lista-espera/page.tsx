import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Hourglass,
  UsersThree,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/dal";
import {
  familyDonationHold,
  getActiveCycle,
  getFamilyWaitlistBoard,
  getStudentSpace,
} from "@/lib/queries";
import { requestWaitlist, cancelWaitlist } from "@/lib/actions/waitlist";
import { slotsLabel } from "@/lib/schedule";
import { fechaDia } from "@/lib/format";

export const metadata: Metadata = { title: "Lista de espera" };

/**
 * Todas las actividades del ciclo, sin esconder ninguna: aquí la familia ve también
 * lo que no puede inscribir sola (grupos de lista de dirección, cupos llenos, o lo
 * que no es para su edad) y pide lugar. Coordinación es quien juzga.
 */
export default async function ListaEsperaPage() {
  const user = await getCurrentUser();
  if (!user.studentId) redirect("/mi-espacio");
  const studentId = user.studentId;

  const cycle = await getActiveCycle();
  const [student, board, hold] = await Promise.all([
    getStudentSpace(studentId),
    cycle ? getFamilyWaitlistBoard(studentId, cycle.id) : Promise.resolve(null),
    familyDonationHold(studentId),
  ]);
  const firstName = (student?.firstName ?? user.name).split(" ")[0];
  // Un donativo obligatorio sin cumplir pausa la inscripción, y formarse es el
  // primer paso de inscribirse: se pausa igual (la acción también lo frena).
  const donationBlocked = hold.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/mi-espacio"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <Hourglass weight="fill" className="size-5 text-primary" />
          Lista de espera
        </p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          Todas las actividades del ciclo
        </h1>
        <p className="mt-2 text-sm text-muted">
          {`Aquí están todas las actividades${cycle ? ` de ${cycle.label}` : ""}, incluso las que ya
          están llenas y las que arma la dirección. Pide lugar en la lista de espera y el
          equipo te avisa cuando le toque a ${firstName}. Las que no son para su edad se
          ven, pero no se pueden pedir.`}
        </p>
      </div>

      {donationBlocked && (
        <div className="rounded-[var(--radius-card)] border border-warning bg-warning-weak/40 p-4">
          <p className="text-sm font-extrabold text-warning-strong">
            La inscripción está en pausa
          </p>
          <p className="mt-1 text-sm text-ink">
            Mientras haya un donativo obligatorio pendiente no se puede apartar lugar,
            ni siquiera en lista de espera. Si ya lo hiciste o necesitas más tiempo,
            avísale a la dirección.
          </p>
        </div>
      )}

      {!board || board.programs.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-muted">
          Todavía no hay actividades en este ciclo.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {board.programs.map((p) => {
            const color = p.color ?? "var(--brand-teal)";
            const horario = slotsLabel(p.scheduleSlots);
            const left = Math.max(0, p.studentCapacity - p.occupied);
            const enEspera = p.myRequest?.status === "EN_ESPERA";
            const rechazada = p.myRequest?.status === "RECHAZADA";

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
                      {!p.ageOk && ` · fuera de la edad de ${firstName}`}
                    </p>
                  )}
                  {p.teacher && <p>Con {p.teacher.name}</p>}
                </div>

                <div className="mt-auto pt-1">
                  {p.enrolled ? (
                    <p className="flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-success-weak px-3 py-2 text-center text-xs font-bold text-success-strong">
                      <CheckCircle weight="fill" className="size-4" />
                      {firstName} ya está inscrito
                    </p>
                  ) : enEspera ? (
                    <div className="space-y-1.5">
                      {/* Sin número de fila: el lugar se mueve solo (alguien se sale,
                          alguien se forma) y enseñárselo a la familia promete un turno
                          que nadie le prometió. Coordinación sí ve el orden. */}
                      <p className="rounded-[var(--radius-control)] bg-warning-weak/50 px-3 py-2 text-center text-xs font-bold text-warning-strong">
                        En lista de espera
                      </p>
                      {/* Salirse cuesta el lugar: si vuelve a pedir, va al final. */}
                      <form action={cancelWaitlist.bind(null, p.id)}>
                        <button
                          type="submit"
                          className="w-full rounded-[var(--radius-control)] border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          Salirme de la lista
                        </button>
                      </form>
                      <p className="text-center text-[0.7rem] text-subtle">
                        Si te sales y vuelves a pedir, entras al final de la fila.
                      </p>
                    </div>
                  ) : !p.ageOk ? (
                    // La edad no se pide ni se espera: es requisito de la actividad,
                    // no un lugar que se pueda liberar. Aparece para que la familia
                    // vea la oferta completa, pero sin botón.
                    <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-center text-xs font-semibold text-muted">
                      {`Esta actividad no es para la edad de ${firstName}. Si crees que le corresponde, háblalo con la dirección.`}
                    </p>
                  ) : donationBlocked ? (
                    <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-center text-xs font-semibold text-muted">
                      En pausa por el donativo pendiente.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <form action={requestWaitlist}>
                        <input type="hidden" name="programId" value={p.id} />
                        <button
                          type="submit"
                          className="w-full rounded-[var(--radius-control)] border border-primary px-3 py-2 text-sm font-bold text-primary-strong transition-colors hover:bg-primary-weak"
                        >
                          Pedir lugar en lista de espera
                        </button>
                      </form>
                      {rechazada && p.myRequest?.decisionNote && (
                        <p className="text-center text-[0.7rem] text-muted">
                          {`Antes no hubo lugar: ${p.myRequest.decisionNote}`}
                        </p>
                      )}
                      {rechazada && !p.myRequest?.decisionNote && (
                        <p className="text-center text-[0.7rem] text-muted">
                          {`La última vez no hubo lugar (${fechaDia(p.myRequest!.requestedAt)}). Puedes volver a pedirlo.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
