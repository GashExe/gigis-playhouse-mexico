import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, HandHeart } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/dal";
import { getCampaign } from "@/lib/queries";
import { updateCampaign } from "@/lib/actions/donations";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { CampaignFamilies } from "@/components/campaign-families";
import { fechaDia } from "@/lib/format";

export const metadata = { title: "Campaña de donativos" };

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("DIRECTORA");
  const { id } = await params;
  const data = await getCampaign(id);
  if (!data) notFound();
  const { campaign, families } = data;
  const dueValue = campaign.dueDate
    ? new Date(campaign.dueDate).toISOString().slice(0, 10)
    : "";

  return (
    <div>
      <Link
        href="/donativos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Campañas
      </Link>

      <PageHeader
        title={campaign.title}
        subtitle={campaign.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {campaign.mandatory && (
              <Badge tone="warning">
                <Lock className="size-3" />
                Obligatoria
              </Badge>
            )}
            {!campaign.active && <Badge tone="neutral">Cerrada</Badge>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Editar campaña */}
        <Card className="self-start p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <HandHeart weight="fill" className="size-4 text-primary" />
            Datos de la campaña
          </h2>
          <form action={updateCampaign} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={campaign.id} />
            <Field label="Título" htmlFor="c-title" required>
              <Input id="c-title" name="title" required defaultValue={campaign.title} />
            </Field>
            <Field label="Descripción" htmlFor="c-desc">
              <Textarea
                id="c-desc"
                name="description"
                rows={3}
                defaultValue={campaign.description ?? ""}
              />
            </Field>
            <Field label="Mínimo esperado" htmlFor="c-goalLabel">
              <Input id="c-goalLabel" name="goalLabel" defaultValue={campaign.goalLabel ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto de referencia" htmlFor="c-goalAmount">
                <Input
                  id="c-goalAmount"
                  name="goalAmount"
                  inputMode="numeric"
                  defaultValue={campaign.goalAmount ?? ""}
                />
              </Field>
              <Field label="Fecha límite" htmlFor="c-dueDate">
                <Input id="c-dueDate" name="dueDate" type="date" defaultValue={dueValue} />
              </Field>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3">
              <input
                type="checkbox"
                name="mandatory"
                defaultChecked={campaign.mandatory}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span className="text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Lock className="size-3.5 text-warning-strong" />
                  Obligatoria
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Restringe inscribir clases al llegar la fecha límite (a quien no cumpla).
                </span>
              </span>
            </label>
            {campaign.dueDate && (
              <p className="text-xs text-subtle">Fecha límite actual: {fechaDia(campaign.dueDate)}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit">Guardar cambios</Button>
            </div>
          </form>
        </Card>

        {/* Familias */}
        <div className="lg:col-span-3">
          <CampaignFamilies
            campaignId={campaign.id}
            mandatory={campaign.mandatory}
            families={families.map((f) => ({
              ...f,
              graceUntil: f.graceUntil ? new Date(f.graceUntil).toISOString() : null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
