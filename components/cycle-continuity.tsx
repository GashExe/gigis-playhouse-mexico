"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleNotch,
  ArrowRight,
  CheckCircle,
  Warning,
  UsersThree,
} from "@phosphor-icons/react";
import { carryOverStudents, type ContinuityState } from "@/lib/actions/cycles";

type Program = {
  id: string;
  name: string;
  color: string | null;
  levelName: string | null;
  nextLevelName: string | null;
  inTargetOffer: boolean;
};
type Student = {
  id: string;
  name: string;
  status: string;
  alreadyInTarget: boolean;
  programs: Program[];
};

/**
 * Asistente de cambio de ciclo: palomea quién continúa del ciclo anterior y, de un
 * jalón, copia inscripciones + nivel donde quedaron al ciclo destino. Solo se copia a
 * programas que estén en la oferta del destino.
 */
export function CycleContinuity({
  fromId,
  toId,
  toLabel,
  students,
}: {
  fromId: string;
  toId: string;
  toLabel: string;
  students: Student[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ContinuityState>(undefined);

  // ¿Quién es candidato? Quien tenga al menos un programa en la oferta del destino
  // y no esté ya copiado. Esos vienen palomeados por defecto (los ACTIVO).
  const copyable = useMemo(
    () => students.filter((s) => !s.alreadyInTarget && s.programs.some((p) => p.inTargetOffer)),
    [students],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(copyable.filter((s) => s.status === "ACTIVO").map((s) => s.id)),
  );

  // Quién sube de nivel al pasar de ciclo, por "alumno:programa". Vacío por
  // defecto: subir a alguien que no terminó su nivel es peor que dejarlo igual,
  // así que dirección lo palomea a mano (o con "Subir a todos").
  const [advance, setAdvance] = useState<Set<string>>(() => new Set());

  /// Pares alumno:programa que PUEDEN subir: tienen nivel, hay uno siguiente y
  /// el programa está en la oferta del destino.
  const promotable = useMemo(() => {
    const keys: string[] = [];
    for (const s of copyable) {
      for (const p of s.programs) {
        if (p.inTargetOffer && p.levelName && p.nextLevelName) keys.push(`${s.id}:${p.id}`);
      }
    }
    return keys;
  }, [copyable]);

  function toggleAdvance(key: string) {
    setAdvance((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allAdvancing =
    promotable.length > 0 && promotable.every((k) => advance.has(k));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const copyableIds = useMemo(() => new Set(copyable.map((s) => s.id)), [copyable]);
  const allSelected = copyable.length > 0 && copyable.every((s) => selected.has(s.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(copyableIds));
  }

  function copy() {
    setResult(undefined);
    startTransition(async () => {
      // Solo mandamos las subidas de alumnos que efectivamente se van a copiar.
      const keys = [...advance].filter((k) => selected.has(k.split(":")[0]));
      const res = await carryOverStudents(fromId, toId, [...selected], keys);
      setResult(res);
      if (res?.ok) router.refresh();
    });
  }

  if (students.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2/50 px-6 py-12 text-center">
        <UsersThree weight="fill" className="mx-auto size-8 text-subtle" />
        <p className="mt-2 text-sm text-muted">
          El ciclo de origen no tiene participantes con inscripción ni nivel registrado.
        </p>
      </div>
    );
  }

  const selectedCount = [...selected].filter((id) => copyableIds.has(id)).length;

  return (
    <div className="space-y-4">
      {/* Nadie es copiable todavía: el destino aún no tiene esos programas en su oferta */}
      {copyable.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-warning bg-warning-weak/50 px-4 py-3">
          <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-bold text-warning-strong">
              Todavía no hay a quién traer a {toLabel}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Ninguno de los programas del ciclo de origen está en la oferta de {toLabel}.
              Arma primero esa oferta y vuelve aquí: entonces podrás palomear a los{" "}
              {students.length} participantes de la lista.
            </p>
          </div>
        </div>
      ) : (
      /* Barra de acción */
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-sm)] backdrop-blur">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="sr-only" />
          <span
            aria-hidden
            className={`flex size-5 items-center justify-center rounded-[5px] border transition-colors ${
              allSelected ? "border-primary bg-primary text-white" : "border-border-strong bg-surface"
            }`}
          >
            {allSelected && <Check weight="bold" className="size-3.5" />}
          </span>
          Todos los que continúan ({copyable.length})
        </label>
        {promotable.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setAdvance(allAdvancing ? new Set() : new Set(promotable))
            }
            className="rounded-[var(--radius-input)] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {allAdvancing ? "Dejar a todos en su nivel" : "Subir a todos de nivel"}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={pending || selectedCount === 0}
          className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <ArrowRight weight="bold" className="size-4" />
          )}
          Copiar {selectedCount} al ciclo {toLabel}
        </button>
      </div>
      )}

      {result?.ok && result.copied && (
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success-weak px-4 py-3 text-sm font-medium text-success-strong">
          <CheckCircle weight="fill" className="size-5 shrink-0" />
          {`Listo: ${result.copied.students} participante(s) y ${result.copied.enrollments} inscripción(es) copiadas a ${toLabel}`}
          {result.copied.advanced > 0
            ? `, ${result.copied.advanced} subieron de nivel.`
            : "."}
        </div>
      )}
      {result?.error && (
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-danger-weak px-4 py-3 text-sm font-medium text-danger-strong">
          <Warning weight="fill" className="size-5 shrink-0" />
          {result.error}
        </div>
      )}

      {/* Lista de participantes */}
      <ul className="space-y-2">
        {students.map((s) => {
          const isCopyable = copyableIds.has(s.id);
          const checked = selected.has(s.id);
          return (
            <li
              key={s.id}
              className={`rounded-[var(--radius-card)] border bg-surface p-4 transition-colors ${
                checked ? "border-primary/60" : "border-border"
              }`}
            >
              <label
                className={`flex items-start gap-3 ${isCopyable ? "cursor-pointer" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isCopyable}
                  onChange={() => toggle(s.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    checked
                      ? "border-primary bg-primary text-white"
                      : isCopyable
                        ? "border-border-strong bg-surface"
                        : "border-border bg-surface-2"
                  }`}
                >
                  {checked && <Check weight="bold" className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold ${isCopyable ? "text-ink" : "text-muted"}`}>
                      {s.name}
                    </p>
                    {s.alreadyInTarget && (
                      <span className="rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                        Ya está en {toLabel}
                      </span>
                    )}
                    {!isCopyable && !s.alreadyInTarget && (
                      <span
                        title={`Sus programas no están en la oferta de ${toLabel}.`}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-subtle"
                      >
                        Fuera de la oferta
                      </span>
                    )}
                    {s.status !== "ACTIVO" && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-muted">
                        {s.status === "INACTIVO" ? "Inactivo" : "Egresado"}
                      </span>
                    )}
                  </div>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.programs.map((p) => {
                      const key = `${s.id}:${p.id}`;
                      // Se puede ofrecer subir de nivel si va a copiarse, tiene
                      // nivel registrado y su programa tiene uno más adelante.
                      const canPromote =
                        isCopyable && p.inTargetOffer && !!p.levelName && !!p.nextLevelName;
                      const promoting = canPromote && advance.has(key);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={!canPromote}
                            onClick={(e) => {
                              // El chip vive dentro del <label> de la fila: sin esto
                              // subir de nivel despalomearía al participante.
                              e.preventDefault();
                              toggleAdvance(key);
                            }}
                            title={
                              !p.inTargetOffer
                                ? `«${p.name}» no está en la oferta de ${toLabel}: no se copiará.`
                                : canPromote
                                  ? promoting
                                    ? `Entrará a ${toLabel} en ${p.nextLevelName}. Toca para dejarlo en ${p.levelName}.`
                                    : `Concluyó ${p.levelName}: toca para subirlo a ${p.nextLevelName}.`
                                  : p.levelName
                                    ? `${p.levelName} es el último nivel de «${p.name}».`
                                    : undefined
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              promoting
                                ? "border-primary bg-primary-weak text-primary-strong"
                                : p.inTargetOffer
                                  ? "border-border bg-surface-2/60 text-ink"
                                  : "border-dashed border-border text-subtle opacity-70"
                            } ${canPromote ? "cursor-pointer hover:border-border-strong" : "cursor-default"}`}
                          >
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: p.color ?? "var(--primary)" }}
                            />
                            {p.name}
                            {p.levelName && (
                              <span className="font-semibold text-muted">
                                {promoting ? (
                                  <>
                                    {" · "}
                                    <span className="line-through opacity-60">{p.levelName}</span>
                                    {" → "}
                                    <span className="text-primary-strong">{p.nextLevelName}</span>
                                  </>
                                ) : (
                                  ` · ${p.levelName}`
                                )}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
