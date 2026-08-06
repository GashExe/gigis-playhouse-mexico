import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChatCircleText, Megaphone } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { listFamilyMessages } from "@/lib/queries";
import { fecha } from "@/lib/format";

export const metadata: Metadata = { title: "Mensajes" };

/**
 * Todo lo que Gigi's le ha dicho a la familia, en una sola lista y en orden: los
 * avisos de la dirección y las anotaciones de las terapeutas. Abrir esta pantalla
 * marca los mensajes como leídos.
 */
export default async function MensajesPage() {
  const user = await getCurrentUser();
  if (!user.studentId) redirect("/mi-espacio");

  const messages = await listFamilyMessages(user.studentId);
  // Lo que llegó desde la última visita se marca como nuevo; abrir la pantalla
  // pone el reloj en cero para la próxima.
  //
  // El sello se pone aquí y no con una server action porque una acción que
  // revalida rutas no se puede llamar mientras se dibuja la página. Es un update
  // idempotente: si Next vuelve a dibujarla, solo reescribe la misma fecha. La
  // marca vive en la cuenta y no en el navegador —igual que la del video
  // tutorial—: si abre desde el celular y luego desde otra computadora, los leyó
  // ella, no ese aparato.
  const desde = user.messagesSeenAt;
  await prisma.user.update({
    where: { id: user.id },
    data: { messagesSeenAt: new Date() },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/mi-espacio"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ChatCircleText weight="fill" className="size-5 text-primary" />
          Mensajes
        </p>
        <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-ink">
          Historial de mensajes
        </h1>
        <p className="mt-2 text-sm text-muted">
          Los avisos de la dirección y las anotaciones del equipo sobre tu hij@, del
          más reciente al más antiguo.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2 px-6 py-8 text-center text-sm text-muted">
          Todavía no hay mensajes. Aquí aparecerán los avisos de Gigi&apos;s y lo que
          el equipo quiera contarte.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const nuevo = desde == null || m.createdAt > desde;
            return (
              <li
                key={m.id}
                className={`rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-sm)] ${
                  nuevo ? "border-primary/50" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {m.kind === "AVISO" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-weak px-2 py-0.5 text-[0.7rem] font-bold text-primary-strong">
                      <Megaphone weight="fill" className="size-3" />
                      Aviso
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold text-white"
                      style={{
                        backgroundColor: m.program?.color ?? "var(--brand-teal)",
                      }}
                    >
                      {m.program?.name ?? "Anotación"}
                    </span>
                  )}
                  {nuevo && (
                    <span className="rounded-full bg-success-weak px-2 py-0.5 text-[0.7rem] font-bold text-success-strong">
                      Nuevo
                    </span>
                  )}
                  <span className="ml-auto text-xs text-subtle">
                    {fecha(m.createdAt)}
                  </span>
                </div>
                {m.title && (
                  <h2 className="mt-1.5 font-bold text-ink">{m.title}</h2>
                )}
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {m.body}
                </p>
                <p className="mt-1.5 text-xs text-subtle">— {m.author}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
