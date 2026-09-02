"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarCheck,
  Check,
  Clock,
  Lock,
  UsersThree,
  Warning,
  WarningCircle,
  PaperPlaneTilt,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  submitEnrollmentSelection,
  type EnrollmentSubmitState,
} from "@/lib/actions/reservations";
import { findSlotClash, slotsLabel, type Slot } from "@/lib/schedule";
import { fecha } from "@/lib/format";

/** Un grupo concreto: la hora a la que de verdad va, con sus lugares. */
export type PickerGroup = {
  id: string;
  name: string;
  levelName: string | null;
  scheduleLabel: string;
  capacity: number;
  occupied: number;
  ageOk: boolean;
  slots: Slot[];
};

export type PickerProgram = {
  id: string;
  name: string;
  color: string | null;
  area: string | null;
  ageMin: number | null;
  ageMax: number | null;
  studentCapacity: number;
  allowFamilyEnroll: boolean;
  teacherName: string | null;
  /** Cumple el rango de edad de la actividad. */
  ageOk: boolean;
  /** Dirección lo dio de baja de esta actividad en el ciclo. */
  dropped: boolean;
  /** Ya inscrito en el ciclo (así arranca palomeada). */
  enrolled: boolean;
  /** Lugares ya tomados. */
  occupied: number;
  /** Horario que le toca (ya recortado a su nivel). */
  slots: Slot[];
  /**
   * Grupos a los que puede entrar. Vacío = el programa no reparte grupos (las
   * terapias grandes), y entonces vale el horario y el cupo del programa.
   */
  groups: PickerGroup[];
  /** Grupo en el que ya está inscrito, si lo está. */
  enrolledGroupId: string | null;
};

/**
 * La hoja de inscripción de la familia: palomea las actividades que quiere y las
 * manda de una vez. Mientras no la mande puede cambiarla cuanto quiera —incluso
 * quitar lo que ya llevaba—; al mandarla queda cerrada, y se le avisa antes.
 *
 * Las reglas se juzgan aquí EN VIVO porque dependen de la selección viva y no del
 * expediente: el empalme cambia según lo que lleve palomeado en ese momento, y el
 * tope del ciclo se llena mientras elige. La acción del servidor las vuelve a juzgar
 * sobre la hoja completa antes de inscribir nada; esto es para que la pantalla no
 * ofrezca lo que allá se va a rechazar.
 */
export function FamilyEnrollmentPicker({
  firstName,
  cycleLabel,
  enrollmentOpen,
  submittedAt,
  maxEnrollments,
  programs,
}: {
  firstName: string;
  cycleLabel: string | null;
  enrollmentOpen: boolean;
  /** ISO del envío, o null si la familia todavía no manda su hoja. */
  submittedAt: string | null;
  maxEnrollments: number | null;
  programs: PickerProgram[];
}) {
  const cerrada = submittedAt != null || !enrollmentOpen;

  // Programa → grupo elegido (null cuando el programa no reparte grupos). Antes era
  // solo el conjunto de programas; con los grupos hay que recordar también a qué hora
  // va, porque de eso dependen el cupo y el empalme.
  const [selected, setSelected] = useState<Map<string, string | null>>(
    () =>
      new Map(
        programs.filter((p) => p.enrolled).map((p) => [p.id, p.enrolledGroupId] as const),
      ),
  );
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<EnrollmentSubmitState>(undefined);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);

  // Fuera de su edad no se le ofrece: si dirección quiere meterlo de todos modos lo
  // hace desde el expediente, y la familia lo pide por lista de espera.
  const visibles = useMemo(() => programs.filter((p) => p.ageOk), [programs]);

  /** Los grupos que le cuadran por edad (los demás ni se pintan). */
  function gruposDe(p: PickerProgram): PickerGroup[] {
    return p.groups.filter((g) => g.ageOk);
  }

  /** El grupo elegido de un programa palomeado. */
  function grupoElegido(p: PickerProgram): PickerGroup | null {
    const id = selected.get(p.id);
    return id ? gruposDe(p).find((g) => g.id === id) ?? null : null;
  }

  /**
   * El horario que de verdad ocupa: el del grupo elegido, o el del programa cuando
   * no reparte grupos. Sin esto, un niño de Prerrequisitos arrastraría el bloque
   * entero de Lectura y chocaría con media semana.
   */
  function horarioDe(p: PickerProgram): Slot[] {
    const g = grupoElegido(p);
    if (g) return g.slots;
    const opciones = gruposDe(p);
    // Con un solo grupo posible ya se sabe la hora aunque no esté palomeado.
    return opciones.length === 1 ? opciones[0].slots : opciones.length > 1 ? [] : p.slots;
  }

  /** Lugares libres: los del grupo cuando lo hay, si no los del programa. */
  function lugaresLibres(p: PickerProgram, g?: PickerGroup | null): number {
    if (g) return Math.max(0, g.capacity - g.occupied);
    const opciones = gruposDe(p);
    if (opciones.length > 0) {
      return opciones.reduce((a, x) => a + Math.max(0, x.capacity - x.occupied), 0);
    }
    return Math.max(0, p.studentCapacity - p.occupied);
  }

  /**
   * Con qué actividad ya palomeada choca esta (null si convive con todas). Se juzga
   * con el horario del GRUPO: escoger el jueves de Prerrequisitos deja libre el lunes.
   */
  function clashWith(
    p: PickerProgram,
    slots?: Slot[],
  ): { otro: PickerProgram; slot: Slot } | null {
    const propios = slots ?? horarioDe(p);
    if (propios.length === 0) return null;
    for (const [id] of selected) {
      if (id === p.id) continue;
      const otro = byId.get(id);
      if (!otro) continue;
      const slot = findSlotClash(propios, horarioDe(otro));
      if (slot) return { otro, slot };
    }
    return null;
  }

  const topeLleno = maxEnrollments != null && selected.size >= maxEnrollments;

  /**
   * Por qué NO se puede palomear (null = sí se puede). Con `g` se juzga ese grupo
   * en concreto, que es lo que necesita la tarjeta cuando ofrece dos horarios.
   */
  function blockedReason(p: PickerProgram, g?: PickerGroup | null): string | null {
    if (selected.has(p.id) && (!g || selected.get(p.id) === g.id)) return null;
    if (p.dropped) {
      return "La dirección dio de baja esta actividad. Si quieres volver a inscribirla, háblalo con ella.";
    }
    if (!p.allowFamilyEnroll) {
      return "A esta actividad se entra por lista de la dirección. Puedes pedir lugar en la lista de espera.";
    }
    if (g ? g.occupied >= g.capacity : lugaresLibres(p) === 0) {
      return g
        ? "Ese horario ya está lleno. Puedes escoger otro o pedir lugar en la lista de espera."
        : "Ya no hay lugares. Puedes pedir lugar en la lista de espera.";
    }
    const choque = clashWith(p, g?.slots);
    if (choque) {
      // La hora que DE VERDAD choca, no el horario entero: en Lectura, cuyo bloque
      // de tutorías cubre toda la semana, el paréntesis con las nueve franjas no le
      // decía nada a nadie.
      const label = slotsLabel([choque.slot]);
      return `Se empalma con ${choque.otro.name}${label ? ` (${label})` : ""}. No se pueden llevar las dos a la misma hora.`;
    }
    if (topeLleno) {
      return `Ya llevas ${maxEnrollments} actividades palomeadas, que es el tope de este ciclo. Quita una si quieres cambiarla.`;
    }
    return null;
  }

  /** Lo que ya lleva de un grupo que arma dirección no se puede despalomear. */
  function fixedSelection(p: PickerProgram): boolean {
    return p.enrolled && !p.allowFamilyEnroll;
  }

  /**
   * Palomea o despalomea. Con `g` se palomea ESE horario: volver a apretar el que ya
   * estaba lo quita, y apretar el otro se cambia de grupo sin tener que despalomear
   * primero, que es como lo haría cualquiera.
   */
  function toggle(p: PickerProgram, g?: PickerGroup | null) {
    if (cerrada || pending) return;
    setState(undefined);
    setSelected((prev) => {
      const next = new Map(prev);
      const actual = next.get(p.id);
      const marcado = next.has(p.id);
      if (marcado && (!g || actual === g.id)) {
        if (fixedSelection(p)) return prev;
        next.delete(p.id);
        return next;
      }
      if (blockedReason(p, g)) return prev;
      const opciones = gruposDe(p);
      // Sin grupo explícito: si solo hay uno posible se toma solo; si hay varios,
      // la familia tiene que escoger y el clic en la tarjeta no decide nada.
      const elegido = g?.id ?? (opciones.length === 1 ? opciones[0].id : null);
      if (opciones.length > 1 && !elegido) return prev;
      next.set(p.id, elegido);
      return next;
    });
  }

  function send() {
    startTransition(async () => {
      const result = await submitEnrollmentSelection(
        [...selected].map(([programId, programGroupId]) => ({ programId, programGroupId })),
      );
      setState(result);
      if (result?.ok) setConfirming(false);
    });
  }

  const elegidas = [...selected.keys()]
    .map((id) => byId.get(id))
    .filter((p): p is PickerProgram => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-2">
          <CalendarCheck weight="fill" className="size-5 text-primary" />
          <h2 className="text-base font-extrabold tracking-tight text-ink">Inscripción</h2>
        </span>
        {cycleLabel && (
          <span className="text-xs font-semibold text-subtle">Ciclo {cycleLabel}</span>
        )}
      </div>

      {/* Ya la mandó: el listado queda de constancia, sin poder moverse. */}
      {submittedAt != null ? (
        <div className="rounded-[var(--radius-card)] border border-success bg-success-weak/40 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-success-strong">
            <CheckCircle weight="fill" className="size-4" />
            Ya mandaste la inscripción de {firstName}
          </p>
          <p className="mt-1 text-sm text-ink">
            {`La recibimos el ${fecha(new Date(submittedAt))}. Ya no se puede editar desde aquí: si necesitas un cambio, háblalo con la dirección.`}
          </p>
        </div>
      ) : !enrollmentOpen ? (
        <div className="rounded-[var(--radius-card)] border border-warning bg-warning-weak/40 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-warning-strong">
            <Lock weight="fill" className="size-4" />
            Las inscripciones están cerradas
          </p>
          <p className="mt-1 text-sm text-ink">
            La dirección abre la inscripción cuando toca armar el ciclo. Mientras tanto
            puedes pedir lugar en la lista de espera.
          </p>
        </div>
      ) : (
        <p className="-mt-2 text-sm text-muted">
          {`Palomea las actividades que quieres para ${firstName}. Puedes cambiarlas cuantas veces necesites; cuando estés conforme, mándalas.`}
        </p>
      )}

      {maxEnrollments != null && !cerrada && (
        <p
          className={`rounded-[var(--radius-control)] px-3 py-2 text-sm ${
            topeLleno
              ? "border border-warning bg-warning-weak/40 font-semibold text-warning-strong"
              : "text-muted"
          }`}
        >
          {topeLleno
            ? `Llevas ${selected.size} de ${maxEnrollments} actividades, que es el tope de este ciclo. Si quieres otra, quita una primero.`
            : `Llevas ${selected.size} de ${maxEnrollments} actividades que se pueden llevar en este ciclo.`}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-6 text-center text-sm text-muted">
          {`Por ahora no hay actividades del ciclo para la edad de ${firstName}. Si tienes dudas, habla con la dirección.`}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((p) => {
            const color = p.color ?? "var(--brand-teal)";
            const opciones = gruposDe(p);
            // Con dos o más horarios la tarjeta deja de ser un botón y pasa a
            // preguntar a cuál va: apretar el nombre no puede decidirlo por ella.
            const escoge = opciones.length > 1;
            const gSel = grupoElegido(p);
            const horario = slotsLabel(horarioDe(p));
            const left = lugaresLibres(p, gSel);
            const marcada = selected.has(p.id);
            const fija = fixedSelection(p);
            const razon = marcada ? null : blockedReason(p);
            const bloqueada = cerrada || fija || razon != null;
            const nivel = gSel?.levelName ?? (opciones.length === 1 ? opciones[0].levelName : null);

            const cuerpo = (
              <>
                <div className="flex items-start gap-3">
                  {/* La casilla es decorativa: quien manda es el aria-pressed. */}
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[0.4rem] border-2 transition-colors ${
                      marcada
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong bg-surface"
                    }`}
                  >
                    {marcada && <Check weight="bold" className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate font-semibold text-ink">{p.name}</span>
                    </span>
                    {nivel && (
                      <span className="mt-0.5 block truncate text-xs font-semibold text-primary-strong">
                        {nivel}
                      </span>
                    )}
                    {p.area && (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {p.area}
                      </span>
                    )}
                  </span>
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

                <div className="space-y-0.5 pl-8 text-xs text-muted">
                  {!escoge && horario && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0 text-subtle" />
                      {horario}
                    </span>
                  )}
                  {(p.ageMin != null || p.ageMax != null) && (
                    <span className="flex items-center gap-1.5">
                      <UsersThree className="size-3.5 shrink-0 text-subtle" />
                      {p.ageMin != null && p.ageMax != null
                        ? `${p.ageMin}–${p.ageMax} años`
                        : p.ageMin != null
                          ? `Desde ${p.ageMin} años`
                          : `Hasta ${p.ageMax} años`}
                    </span>
                  )}
                  {p.teacherName && <span className="block">Con {p.teacherName}</span>}
                </div>
              </>
            );

            const avisos = (
              <>
                {fija && (
                  <span className="mt-auto rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs font-semibold text-muted">
                    Ya está inscrito. Este grupo lo arma la dirección, así que no se
                    quita desde aquí.
                  </span>
                )}
                {!fija && razon && !cerrada && (
                  <span className="mt-auto flex items-start gap-1.5 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs font-semibold text-muted">
                    <Warning className="mt-0.5 size-3.5 shrink-0" />
                    {razon}
                  </span>
                )}
                {!fija && !razon && marcada && p.enrolled && !cerrada && (
                  <span className="mt-auto text-xs font-semibold text-primary-strong">
                    Ya inscrito. Si lo despalomeas, se da de baja al mandar.
                  </span>
                )}
              </>
            );

            const marco = `flex h-full w-full flex-col gap-2 rounded-[var(--radius-card)] border p-4 text-left shadow-[var(--shadow-sm)] transition-colors ${
              marcada ? "border-primary bg-primary-weak/30" : "border-border bg-surface"
            }`;

            return (
              <li key={p.id}>
                {escoge ? (
                  <div className={marco}>
                    {cuerpo}
                    <div className="pl-8">
                      <p className="mb-1.5 text-xs font-bold text-ink">
                        {marcada ? "Va a esta hora:" : "¿A qué hora puede ir?"}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {opciones.map((g) => {
                          const puesto = selected.get(p.id) === g.id;
                          const libres = Math.max(0, g.capacity - g.occupied);
                          const rz = puesto ? null : blockedReason(p, g);
                          return (
                            <li key={g.id}>
                              <button
                                type="button"
                                onClick={() => toggle(p, g)}
                                disabled={cerrada || fija || (!puesto && rz != null)}
                                aria-pressed={puesto}
                                title={rz ?? undefined}
                                className={`flex flex-col rounded-[var(--radius-control)] border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                  puesto
                                    ? "border-primary bg-primary text-white"
                                    : "border-border bg-surface text-ink hover:border-primary"
                                } ${
                                  cerrada || fija || (!puesto && rz != null)
                                    ? "cursor-not-allowed opacity-55"
                                    : "cursor-pointer"
                                }`}
                              >
                                <span className="font-bold">{g.scheduleLabel}</span>
                                <span className={puesto ? "text-white/80" : "text-muted"}>
                                  {libres === 0 ? "sin lugares" : `${libres} lugares`}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {avisos}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={bloqueada}
                    aria-pressed={marcada}
                    className={`${marco} ${
                      bloqueada
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer hover:border-primary"
                    }`}
                  >
                    {cuerpo}
                    {avisos}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Envío */}
      {!cerrada && (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          {state?.error && (
            <p className="mb-3 flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-weak px-3 py-2 text-sm font-semibold text-danger-strong">
              <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          )}
          {state?.rejected && state.rejected.length > 0 && (
            <div className="mb-3 rounded-[var(--radius-control)] border border-warning bg-warning-weak/40 px-3 py-2">
              <p className="text-sm font-bold text-warning-strong">
                Algo se quedó fuera:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                {state.rejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {confirming ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm font-bold text-ink">
                <Warning weight="fill" className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                Una vez mandada la inscripción ya no se podrá editar. Para cualquier
                cambio tendrás que hablar con la dirección.
              </p>
              {elegidas.length > 0 && (
                <ul className="space-y-1 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink">
                  {elegidas.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color ?? "var(--brand-teal)" }}
                      />
                      <span className="font-semibold">{p.name}</span>
                      {grupoElegido(p)?.levelName && (
                        <span className="text-xs font-semibold text-primary-strong">
                          {grupoElegido(p)!.levelName}
                        </span>
                      )}
                      {slotsLabel(horarioDe(p)) && (
                        <span className="text-xs text-muted">{slotsLabel(horarioDe(p))}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <PaperPlaneTilt weight="fill" className="size-4" />
                  {pending ? "Mandando…" : "Sí, mandar la inscripción"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="rounded-[var(--radius-control)] border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Todavía no, seguir editando
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {selected.size === 0
                  ? "No has palomeado ninguna actividad todavía."
                  : selected.size === 1
                    ? "Llevas 1 actividad palomeada."
                    : `Llevas ${selected.size} actividades palomeadas.`}
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={selected.size === 0}
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <PaperPlaneTilt weight="fill" className="size-4" />
                Mandar inscripción
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
