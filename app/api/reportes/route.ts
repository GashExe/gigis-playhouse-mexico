import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/dal";
import { getProgramCycleReport } from "@/lib/queries";
import { edadLabel } from "@/lib/utils";

const GENDER_LABEL: Record<string, string> = {
  FEMENINO: "Femenino",
  MASCULINO: "Masculino",
  OTRO: "Otro",
};

/**
 * Descarga en Excel el reporte de un programa en un ciclo: participantes con edad y
 * sexo y el estado de su donativo. Solo dirección y coordinación.
 */
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (me.role !== "DIRECTORA" && me.role !== "COORDINADOR") {
    return new Response("No autorizado", { status: 403 });
  }

  const url = new URL(request.url);
  const programId = url.searchParams.get("programa") ?? "";
  const cycleId = url.searchParams.get("ciclo") ?? "";
  if (!programId || !cycleId) {
    return new Response("Faltan parámetros", { status: 400 });
  }

  const report = await getProgramCycleReport(programId, cycleId);
  if (!report) {
    return new Response("Programa o ciclo no encontrado", { status: 404 });
  }

  const rows = report.participants.map((p) => ({
    Participante: `${p.firstName} ${p.lastName}`,
    Matricula: p.matricula ?? "",
    Edad: edadLabel(p.birthDate) ?? "",
    "Edad (años)": p.age ?? "",
    Sexo: p.gender ? (GENDER_LABEL[p.gender] ?? p.gender) : "",
    Donativo: p.alCorriente ? "Al corriente" : "Pendiente",
    "Donativos cumplidos": `${p.donationsCumplidas}/${p.donationsTotal}`,
    Tutor: p.guardianName ?? "",
    Telefono: p.guardianPhone ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(
    rows.length > 0
      ? rows
      : [{ Participante: "Sin participantes inscritos en este programa y ciclo" }],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Participantes");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = report.program.name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${safeName}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
