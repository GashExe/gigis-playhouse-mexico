"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Megaphone, Trash, UsersThree, UserFocus, MagnifyingGlass } from "@phosphor-icons/react";
import { createAnnouncement, deleteAnnouncement } from "@/lib/actions/announcements";
import { fecha } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type StudentLite = { id: string; firstName: string; lastName: string };
type Announcement = {
  id: string;
  title: string;
  body: string;
  toAllActive: boolean;
  createdAt: string;
  authorName: string | null;
  recipients: StudentLite[];
};

export function AnnouncementsManager({
  students,
  announcements,
}: {
  /** Participantes activos, para elegir destinatarios específicos. */
  students: StudentLite[];
  announcements: Announcement[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<"all" | "custom">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  // Publica y, si salió bien, deja el formulario en cero para el siguiente aviso.
  const formAction = (fd: FormData) =>
    startTransition(async () => {
      const result = await createAnnouncement(undefined, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setSelected(new Set());
      setAudience("all");
      setQuery("");
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Redactar */}
      <Card className="self-start p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Megaphone weight="fill" className="size-4 text-primary" />
          Nuevo aviso
        </h2>
        <form ref={formRef} action={formAction} className="mt-3 space-y-3">
          <Field label="Título" htmlFor="aviso-title" required>
            <Input
              id="aviso-title"
              name="title"
              required
              placeholder="Ej. Suspensión por evento anual"
            />
          </Field>
          <Field label="Mensaje" htmlFor="aviso-body" required>
            <Textarea
              id="aviso-body"
              name="body"
              rows={4}
              required
              placeholder="Lo que las familias deben saber…"
            />
          </Field>

          {/* A quién le llega */}
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink">Destinatarios</span>
            <input type="hidden" name="audience" value={audience} />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAudience("all")}
                aria-pressed={audience === "all"}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-input)] border px-3 text-xs font-bold transition-colors ${
                  audience === "all"
                    ? "border-transparent bg-primary text-white"
                    : "border-border text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <UsersThree className="size-4" />
                Todos los activos
              </button>
              <button
                type="button"
                onClick={() => setAudience("custom")}
                aria-pressed={audience === "custom"}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-input)] border px-3 text-xs font-bold transition-colors ${
                  audience === "custom"
                    ? "border-transparent bg-primary text-white"
                    : "border-border text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <UserFocus className="size-4" />
                Elegir participantes
              </button>
            </div>
          </div>

          {audience === "custom" && (
            <div className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-2.5">
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar participante…"
                  className="h-9 bg-surface pl-8 text-xs"
                />
              </div>
              <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-input)] px-2 py-1.5 text-sm text-ink hover:bg-surface">
                      <input
                        type="checkbox"
                        name="recipients"
                        value={s.id}
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      {s.firstName} {s.lastName}
                    </label>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-2 py-2 text-center text-xs text-subtle">
                    Sin resultados para «{query}».
                  </li>
                )}
              </ul>
              {selected.size > 0 && (
                <p className="mt-1.5 px-1 text-xs font-semibold text-primary-strong">
                  {selected.size} seleccionad{selected.size === 1 ? "o" : "os"}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs font-medium text-danger-strong">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Publicar aviso
            </Button>
          </div>
        </form>
      </Card>

      {/* Publicados */}
      <div className="space-y-3 lg:col-span-3">
        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone weight="fill" className="size-6" />}
            title="Aún no hay avisos"
            description="Lo que publiques aquí aparecerá en el espacio de las familias."
          />
        ) : (
          announcements.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-ink">{a.title}</h3>
                  <p className="mt-0.5 text-xs text-subtle">
                    {a.authorName ?? "Dirección"} · {fecha(a.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={a.toAllActive ? "primary" : "neutral"}>
                    {a.toAllActive
                      ? "Todos los activos"
                      : `${a.recipients.length} participante${a.recipients.length === 1 ? "" : "s"}`}
                  </Badge>
                  <form action={deleteAnnouncement.bind(null, a.id)}>
                    <button
                      type="submit"
                      aria-label="Borrar aviso"
                      className="flex size-7 items-center justify-center rounded-[var(--radius-input)] text-subtle transition-colors hover:bg-danger-weak hover:text-danger-strong"
                    >
                      <Trash className="size-4" />
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {a.body}
              </p>
              {!a.toAllActive && a.recipients.length > 0 && (
                <p className="mt-2 text-xs text-subtle">
                  Para:{" "}
                  {a.recipients
                    .map((r) => `${r.firstName} ${r.lastName}`)
                    .join(", ")}
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
