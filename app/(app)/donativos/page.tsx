import Link from "next/link";
import {
  HandHeart,
  Lock,
  CheckCircle,
  CaretRight,
  Trash,
  Archive,
  ArrowCounterClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { listCampaigns } from "@/lib/queries";
import { createCampaign, setCampaignActive, deleteCampaign } from "@/lib/actions/donations";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fechaDia } from "@/lib/format";

export const metadata = { title: "Donativos" };

const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export default async function DonativosPage() {
  // Las campañas de donativos las administra la dirección.
  await requireRole("DIRECTORA");
  const campaigns = await listCampaigns();

  return (
    <div>
      <PageHeader
        title="Campañas de donativos"
        subtitle="Arma campañas para las familias. Las que marques como obligatorias restringen inscribir clases a quien no cumpla, hasta que cumpla o le des una prórroga."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Nueva campaña */}
        <Card className="self-start p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <HandHeart weight="fill" className="size-4 text-primary" />
            Nueva campaña
          </h2>
          <form action={createCampaign} className="mt-3 space-y-3">
            <Field label="Título" htmlFor="c-title" required>
              <Input id="c-title" name="title" required placeholder="Ej. Colecta de útiles" />
            </Field>
            <Field label="Descripción" htmlFor="c-desc">
              <Textarea
                id="c-desc"
                name="description"
                rows={3}
                placeholder="Para qué es la colecta, qué se pide, a dónde llevarlo…"
              />
            </Field>
            <Field
              label="Mínimo esperado"
              htmlFor="c-goalLabel"
              hint="En texto, tal cual. El donativo puede ser en especie, tiempo o dinero (ej. «$200, un paquete de material o una tarde de apoyo»)."
            >
              <Input
                id="c-goalLabel"
                name="goalLabel"
                placeholder="Ej. $200 o material escolar"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto de referencia" htmlFor="c-goalAmount" hint="Opcional, en pesos.">
                <Input
                  id="c-goalAmount"
                  name="goalAmount"
                  inputMode="numeric"
                  placeholder="200"
                />
              </Field>
              <Field label="Fecha límite" htmlFor="c-dueDate" hint="Opcional.">
                <Input id="c-dueDate" name="dueDate" type="date" />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3">
              <input
                type="checkbox"
                name="mandatory"
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span className="text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Lock className="size-3.5 text-warning-strong" />
                  Obligatoria
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Al llegar la fecha límite, quien no cumpla no podrá inscribir clases hasta cumplir
                  o recibir prórroga. Necesita fecha límite para poder restringir.
                </span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button type="submit">Crear campaña</Button>
            </div>
          </form>
        </Card>

        {/* Campañas */}
        <div className="space-y-3 lg:col-span-3">
          {campaigns.length === 0 ? (
            <EmptyState
              icon={<HandHeart weight="fill" className="size-6" />}
              title="Aún no hay campañas"
              description="Crea una campaña para empezar a registrar los donativos de las familias."
            />
          ) : (
            campaigns.map((c) => {
              const done = c.cumplidas + c.gracia;
              return (
                <Card key={c.id} className={c.active ? "p-4" : "p-4 opacity-75"}>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/donativos/${c.id}`} className="group min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink group-hover:text-primary-strong">
                          {c.title}
                        </h3>
                        {c.mandatory && (
                          <Badge tone="warning">
                            <Lock className="size-3" />
                            Obligatoria
                          </Badge>
                        )}
                        {!c.active && <Badge tone="neutral">Cerrada</Badge>}
                      </div>
                      {c.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                        {c.goalLabel && <span>Mínimo: {c.goalLabel}</span>}
                        {c.goalAmount != null && <span>Ref. {pesos(c.goalAmount)}</span>}
                        {c.dueDate && <span>Vence {fechaDia(c.dueDate)}</span>}
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success-strong">
                        <CheckCircle weight="fill" className="size-3.5" />
                        {done} de {c.totalFamilies} familias
                        {c.gracia > 0 ? ` · ${c.gracia} con prórroga` : ""}
                      </p>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Link
                        href={`/donativos/${c.id}`}
                        className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label="Ver familias"
                      >
                        <CaretRight className="size-4" />
                      </Link>
                      <form action={setCampaignActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                        <button
                          type="submit"
                          aria-label={c.active ? "Cerrar campaña" : "Reabrir campaña"}
                          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          {c.active ? (
                            <Archive className="size-4" />
                          ) : (
                            <ArrowCounterClockwise className="size-4" />
                          )}
                        </button>
                      </form>
                      <form action={deleteCampaign}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          aria-label="Eliminar campaña"
                          className="flex size-8 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                        >
                          <Trash className="size-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
