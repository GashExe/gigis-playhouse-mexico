"use client";

import { useMemo, useState } from "react";
import {
  MagnifyingGlass,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  PencilSimple,
} from "@phosphor-icons/react";
import {
  markContributionDone,
  grantContributionGrace,
  resetContribution,
} from "@/lib/actions/donations";
import { fechaDia } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Family = {
  id: string;
  firstName: string;
  lastName: string;
  matricula: string | null;
  status: "PENDIENTE" | "CUMPLIDO" | "GRACIA";
  amount: number | null;
  note: string | null;
  graceUntil: string | null;
  graceValid: boolean;
  satisfied: boolean;
};

const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

/** Fecha por defecto para la prórroga: dos semanas a partir de hoy (YYYY-MM-DD). */
function defaultGrace() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ f, mandatory }: { f: Family; mandatory: boolean }) {
  if (f.status === "CUMPLIDO") {
    return (
      <Badge tone="success">
        <CheckCircle weight="fill" className="size-3" />
        Cumplido
      </Badge>
    );
  }
  if (f.status === "GRACIA") {
    return f.graceValid ? (
      <Badge tone="info">
        <Clock weight="fill" className="size-3" />
        Prórroga a {f.graceUntil ? fechaDia(f.graceUntil) : "—"}
      </Badge>
    ) : (
      <Badge tone="warning">Prórroga vencida</Badge>
    );
  }
  return mandatory ? (
    <Badge tone="danger">Pendiente</Badge>
  ) : (
    <Badge tone="neutral">Sin registrar</Badge>
  );
}

export function CampaignFamilies({
  campaignId,
  mandatory,
  families,
}: {
  campaignId: string;
  mandatory: boolean;
  families: Family[];
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter(
      (f) =>
        `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
        (f.matricula ?? "").toLowerCase().includes(q),
    );
  }, [families, query]);

  const cumplidas = families.filter((f) => f.status === "CUMPLIDO").length;
  const prorroga = families.filter((f) => f.status === "GRACIA" && f.graceValid).length;
  const pendientes = families.filter((f) => !f.satisfied).length;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-extrabold text-success-strong">{cumplidas}</p>
          <p className="text-xs text-muted">Cumplidas</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-extrabold text-info">{prorroga}</p>
          <p className="text-xs text-muted">Con prórroga</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-extrabold text-ink">{pendientes}</p>
          <p className="text-xs text-muted">Pendientes</p>
        </div>
      </div>

      {/* Buscar */}
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar familia por nombre o matrícula…"
          className="h-10 pl-9"
        />
      </div>

      {/* Familias */}
      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        {filtered.map((f) => {
          const open = openId === f.id;
          return (
            <li key={f.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {f.firstName} {f.lastName}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {f.matricula ?? "—"}
                    {f.amount != null ? ` · ${pesos(f.amount)}` : ""}
                    {f.note ? ` · ${f.note}` : ""}
                  </p>
                </div>
                <StatusBadge f={f} mandatory={mandatory} />
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : f.id)}
                  aria-label="Gestionar donativo"
                  aria-expanded={open}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <PencilSimple className="size-4" />
                </button>
              </div>

              {open && (
                <div className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3">
                  {/* Marcar cumplido (con monto/nota opcionales, útil para especie) */}
                  <form action={markContributionDone} className="space-y-2">
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="studentId" value={f.id} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr]">
                      <Input
                        name="amount"
                        inputMode="numeric"
                        defaultValue={f.amount ?? ""}
                        placeholder="Monto $"
                        className="h-9 bg-surface text-sm"
                      />
                      <Input
                        name="note"
                        defaultValue={f.note ?? ""}
                        placeholder="Nota (ej. entregó material)"
                        className="h-9 bg-surface text-sm"
                      />
                    </div>
                    <Button type="submit" size="sm" className="w-full">
                      <CheckCircle weight="fill" className="size-4" />
                      Marcar cumplido
                    </Button>
                  </form>

                  <div className="flex flex-wrap items-end gap-2">
                    {/* Prórroga */}
                    <form action={grantContributionGrace} className="flex items-end gap-2">
                      <input type="hidden" name="campaignId" value={campaignId} />
                      <input type="hidden" name="studentId" value={f.id} />
                      <label className="text-xs font-semibold text-muted">
                        Prórroga hasta
                        <Input
                          name="graceUntil"
                          type="date"
                          defaultValue={
                            f.graceUntil ? f.graceUntil.slice(0, 10) : defaultGrace()
                          }
                          className="mt-1 h-9 bg-surface text-sm"
                        />
                      </label>
                      <Button type="submit" size="sm" variant="secondary">
                        <Clock className="size-4" />
                        Dar prórroga
                      </Button>
                    </form>

                    {/* Reabrir */}
                    {f.status !== "PENDIENTE" && (
                      <form action={resetContribution}>
                        <input type="hidden" name="campaignId" value={campaignId} />
                        <input type="hidden" name="studentId" value={f.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          <ArrowCounterClockwise className="size-4" />
                          Reabrir
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-subtle">
            Sin resultados para «{query}».
          </li>
        )}
      </ul>
    </div>
  );
}
