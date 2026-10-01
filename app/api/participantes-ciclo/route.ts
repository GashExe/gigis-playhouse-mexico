import * as XLSX from "xlsx";
import { requireStaff } from "@/lib/dal";
import { getActiveCycle, listCycleParticipants } from "@/lib/queries";
import { edadLabel } from "@/lib/utils";

/**
 * Descarga en Excel la lista de participantes del ciclo: la misma que se ve en
 * /panel/participantes (respeta la búsqueda). Dos hojas: una por participante con
 * sus clases juntas, y otra con un renglón por clase para poder filtrar por
 * programa en Excel.
 */
export async function GET(request: Request) {
  await requireStaff();
  const cycle = await getActiveCycle();
  if (!cycle) return new Response("No hay ciclo registrado", { status: 404 });

  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const participants = await listCycleParticipants(cycle.id, q);

  const claseLabel = (c: (typeof participants)[number]["classes"][number]) =>
    c.groupLabel ? `${c.program.name} · ${c.groupLabel}` : c.program.name;

  const porParticipante = participants.map((p) => ({
    Participante: `${p.firstName} ${p.lastName}`,
    Matricula: p.matricula ?? "",
    Edad: edadLabel(p.birthDate) ?? "",
    "Núm. de clases": p.classes.length,
    Clases: p.classes.map(claseLabel).join("\n"),
  }));
  const porClase = participants.flatMap((p) =>
    p.classes.map((c) => ({
      Participante: `${p.firstName} ${p.lastName}`,
      Matricula: p.matricula ?? "",
      Edad: edadLabel(p.birthDate) ?? "",
      Programa: c.program.name,
      "Grupo y horario": c.groupLabel ?? "",
    })),
  );

  const vacio = [{ Participante: "Nadie inscrito en el ciclo" }];
  const ws1 = XLSX.utils.json_to_sheet(porParticipante.length > 0 ? porParticipante : vacio);
  ws1["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 70 }];
  const ws2 = XLSX.utils.json_to_sheet(porClase.length > 0 ? porClase : vacio);
  ws2["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 32 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Participantes");
  XLSX.utils.book_append_sheet(wb, ws2, "Clases");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeCycle = cycle.label.replace(/[^\p{L}\p{N}]+/gu, "-");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="participantes-${safeCycle}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
