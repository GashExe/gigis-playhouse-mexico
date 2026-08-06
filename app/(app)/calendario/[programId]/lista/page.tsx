import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { canGradeProgram, getCurrentUser } from "@/lib/dal";
import { canRunClasses, isReadOnly } from "@/lib/roles";
import { getActiveCycle, getAttendanceSheet } from "@/lib/queries";
import { fromDateKey, isDateKey, toDateKey } from "@/lib/schedule";
import { fechaDia } from "@/lib/format";
import { HojaMembretada } from "@/components/documento-membretado";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Lista de asistencia" };

/** Renglones vacíos de cortesía: siempre falta alguien a quien anotar a mano. */
const RENGLONES_EXTRA = 4;

/**
 * La lista de asistencia en papel: una hoja por horario del día, con casillas en
 * blanco para palomear en clase. Se puede sacar cualquier día, no solo cuando el
 * cupo se llena.
 */
export default async function ListaAsistenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ fecha?: string; membrete?: string }>;
}) {
  const { programId } = await params;
  const { fecha, membrete } = await searchParams;

  // Misma compuerta que el panel de clase: quien lleva la clase la imprime.
  const me = await getCurrentUser();
  const soloLectura = isReadOnly(me.role);
  const puedeCalificar = await canGradeProgram(programId);
  if (!soloLectura && !canRunClasses(me.role)) redirect("/panel");
  if (me.role === "TERAPEUTA" && !puedeCalificar) redirect("/panel");

  const cycle = await getActiveCycle();
  if (!cycle) notFound();
  const date = fecha && isDateKey(fecha) ? fromDateKey(fecha) : new Date();
  const dateKey = toDateKey(date);
  const sheet = await getAttendanceSheet(programId, dateKey, cycle.id);
  if (!sheet) notFound();

  // Sobre papel membretado preimpreso la imagen sobra (y gasta tinta de una hoja cara).
  const conMembrete = membrete !== "0";
  const dateLabel = format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div>
      {/* Barra de trabajo: no se imprime */}
      <div className="mb-5 print:hidden">
        <Link
          href={`/calendario/${programId}?fecha=${dateKey}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Panel de clase
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            Lista de asistencia
          </h1>
          <span className="text-sm capitalize text-muted">{dateLabel}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href={`/calendario/${programId}/lista?fecha=${dateKey}&membrete=${conMembrete ? "0" : "1"}`}
              className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {conMembrete ? "Imprimir sin membrete" : "Imprimir con membrete"}
            </Link>
            <PrintButton label="Imprimir / PDF" />
          </div>
        </div>
        {!sheet.isClassDay && (
          <p className="mt-2 rounded-[var(--radius-control)] bg-warning-weak/40 px-3 py-2 text-xs font-semibold text-warning-strong">
            Según el horario, este día no hay clase: sale una sola hoja, sin hora.
          </p>
        )}
        {sheet.sheets.length > 1 && (
          <p className="mt-2 text-xs text-muted">
            {`Este día tiene ${sheet.sheets.length} horarios: sale una hoja por cada uno.`}
          </p>
        )}
      </div>

      {sheet.sheets.map((s, i) => (
        <HojaMembretada
          key={s.key}
          membrete={conMembrete}
          saltoDePagina={i < sheet.sheets.length - 1}
        >
          <header className="mb-4">
            <p className="text-[10pt] font-bold uppercase tracking-wide text-[#6b7280]">
              Gigi&apos;s Playhouse México
            </p>
            <h2 className="text-[16pt] font-extrabold">Lista de asistencia</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[10.5pt]">
              <Dato label="Actividad" value={sheet.program.name} />
              <Dato label="Ciclo" value={sheet.cycle.label} />
              <Dato
                label="Terapeuta"
                value={sheet.program.teacher?.name ?? "Sin asignar"}
              />
              <Dato
                label="Día y hora"
                value={
                  s.startTime
                    ? `${dateLabel} · ${s.startTime}–${s.endTime}`
                    : dateLabel
                }
              />
              {s.levelName && <Dato label="Nivel" value={s.levelName} />}
              <Dato
                label="En el grupo"
                value={`${s.students.length} participante${s.students.length === 1 ? "" : "s"}`}
              />
            </dl>
          </header>

          <table className="w-full border-collapse text-[10.5pt]">
            <thead>
              <tr>
                <Th className="w-[6%]">#</Th>
                <Th className="w-[34%] text-left">Participante</Th>
                <Th className="w-[14%]">Matrícula</Th>
                {sheet.hasLevels && <Th className="w-[16%]">Nivel</Th>}
                <Th className="w-[10%]">Asistió</Th>
                <Th>Firma / observaciones</Th>
              </tr>
            </thead>
            <tbody>
              {s.students.map((a, n) => (
                <tr key={a.id}>
                  <Td className="text-center">{n + 1}</Td>
                  <Td className="text-left">{`${a.lastName}, ${a.firstName}`}</Td>
                  <Td className="text-center">{a.matricula ?? "—"}</Td>
                  {sheet.hasLevels && <Td className="text-center">{a.levelName ?? "—"}</Td>}
                  <Td />
                  <Td />
                </tr>
              ))}
              {/* Renglones en blanco: para quien llegue de visita o se anote a mano. */}
              {Array.from({ length: RENGLONES_EXTRA }).map((_, n) => (
                <tr key={`extra-${n}`}>
                  <Td className="text-center text-[#9ca3af]">
                    {s.students.length + n + 1}
                  </Td>
                  <Td />
                  <Td />
                  {sheet.hasLevels && <Td />}
                  <Td />
                  <Td />
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="mt-8 flex items-end justify-between text-[9.5pt] text-[#6b7280]">
            <div>
              <div className="mb-1 h-8 w-56 border-b border-[#111827]" />
              Firma de la terapeuta
            </div>
            <span>Documento generado el {fechaDia(new Date())}</span>
          </footer>
        </HojaMembretada>
      ))}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="font-bold">{label}:</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border border-[#111827] bg-[#f3f4f6] px-2 py-1.5 text-[9.5pt] font-bold uppercase tracking-wide ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`h-8 border border-[#111827] px-2 py-1 ${className}`}>{children}</td>
  );
}
