import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  cleanText,
  generatePassword,
  normalizeMatricula,
} from "../lib/credentials";

/**
 * Importa el CSV de participantes y crea, para cada uno, su expediente
 * (Student) y su cuenta de acceso (User con role ALUMNO):
 *   - usuario   = matrícula normalizada (solo dígitos, sin la "G")
 *   - contraseña = autogenerada (ej. RobAba2026)
 *
 * Uso:
 *   npm run db:import-alumnos -- <ruta-al-csv> [--dry-run]
 *
 * Es idempotente: re-ejecutar actualiza (upsert por matrícula/usuario), no duplica.
 * Al final escribe un archivo exportable en exports/ con las credenciales en
 * texto plano para que la directora las entregue a las familias.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

const YEAR = new Date().getFullYear();

type Row = {
  line: number;
  matriculaRaw: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  fechaNacimiento: string;
  tutor: string;
  telefono: string;
  correo: string;
};

/** Convierte "dd/mm/aa" (año de 2 dígitos) a Date, con pivote de siglo. */
function parseBirthDate(value: string): Date | null {
  const v = cleanText(value);
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) {
    // Pivote: 00–(año actual de 2 dígitos) => 2000s; el resto => 1900s.
    // Cubre tanto niños (2000s) como adultos participantes (1970s–90s).
    year += year <= YEAR % 100 ? 2000 : 1900;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Limpia teléfonos: colapsa espacios; conserva dígitos, +, (), - para legibilidad. */
function cleanPhone(value: string): string {
  const v = cleanText(value);
  // Si no contiene ningún dígito, lo descartamos (a veces viene basura).
  return /\d/.test(v) ? v : "";
}

function parseCsv(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // La primera línea es el encabezado.
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    // Se esperan 8 columnas. Si hay de más (comas extra), unimos las sobrantes
    // en el último campo (correo) para no perder datos.
    if (cols.length < 8) continue;
    const [
      matriculaRaw,
      apellidoPaterno,
      apellidoMaterno,
      nombre,
      fechaNacimiento,
      tutor,
      telefono,
      ...correoParts
    ] = cols;
    rows.push({
      line: i + 1,
      matriculaRaw: cleanText(matriculaRaw),
      apellidoPaterno: cleanText(apellidoPaterno),
      apellidoMaterno: cleanText(apellidoMaterno),
      nombre: cleanText(nombre),
      fechaNacimiento: cleanText(fechaNacimiento),
      tutor: cleanText(tutor),
      telefono: cleanText(telefono),
      correo: cleanText(correoParts.join(",")).toLowerCase(),
    });
  }
  return rows;
}

/** Escapa un valor para CSV (comillas y comas). */
function csvCell(value: string): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvArg = args.find((a) => !a.startsWith("--"));
  const csvPath = csvArg
    ? path.resolve(csvArg)
    : path.resolve(process.env.HOME ?? "", "Downloads/Reporte_Alumnos_2026_07_15.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ No se encontró el CSV: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📄 Leyendo: ${csvPath}`);
  console.log(dryRun ? "🧪 Modo DRY-RUN (no se escribe en la BD)\n" : "");

  const rows = parseCsv(csvPath);
  console.log(`   Filas de datos: ${rows.length}`);

  // --- Normalización + resolución de usuarios únicos ---
  const usedUsernames = new Map<string, number>(); // base -> conteo usado
  const seenByMatriculaName = new Map<string, true>(); // matrícula|nombre -> ya visto

  type Prepared = {
    row: Row;
    matricula: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    duplicateOf?: string; // si es la misma persona ya vista
  };

  const prepared: Prepared[] = [];
  let mergedSamePerson = 0;
  let siblingsSuffixed = 0;
  const nonStandard: string[] = [];

  for (const row of rows) {
    const matricula = normalizeMatricula(row.matriculaRaw);
    if (!/^\d+$/.test(matricula)) {
      nonStandard.push(`fila ${row.line}: "${row.matriculaRaw}" -> "${matricula}"`);
    }
    const firstName = row.nombre;
    const lastName = cleanText(`${row.apellidoPaterno} ${row.apellidoMaterno}`);
    const password = generatePassword(firstName, row.apellidoPaterno, YEAR);

    // ¿Misma persona ya vista? Misma matrícula + mismo CONJUNTO de nombres
    // (sin importar el orden de apellidos: "Amador Cruz" == "Cruz Amador").
    // Los hermanos comparten matrícula pero tienen nombres distintos, así que
    // no se fusionan; solo se fusiona el mismo niño capturado dos veces.
    const nameTokens = stripKey(`${firstName} ${lastName}`)
      .split(" ")
      .filter(Boolean)
      .sort()
      .join(" ");
    const identityKey = `${matricula}|${nameTokens}`;
    if (seenByMatriculaName.has(identityKey)) {
      mergedSamePerson++;
      continue; // se fusiona: ignoramos la fila repetida
    }
    seenByMatriculaName.set(identityKey, true);

    // Usuario único. Si la matrícula ya se usó por OTRA persona (hermanos),
    // damos a cada quien su propia matrícula numérica: base + ordinal (2, 3, ...),
    // verificando que no choque con otra ya usada.
    let username = matricula;
    const count = usedUsernames.get(matricula) ?? 0;
    if (count > 0) {
      let ordinal = count + 1;
      username = `${matricula}${ordinal}`;
      while (usedUsernames.has(username)) {
        ordinal++;
        username = `${matricula}${ordinal}`;
      }
      siblingsSuffixed++;
    }
    usedUsernames.set(matricula, count + 1);
    usedUsernames.set(username, 1); // reserva el usuario final para evitar choques

    prepared.push({ row, matricula, username, firstName, lastName, password });
  }

  console.log(`   Personas únicas a importar: ${prepared.length}`);
  console.log(`   Filas fusionadas (misma persona repetida): ${mergedSamePerson}`);
  console.log(`   Usuarios con sufijo (matrícula compartida/hermanos): ${siblingsSuffixed}`);
  if (nonStandard.length) {
    console.log(`   ⚠️  Matrículas no estándar (${nonStandard.length}):`);
    nonStandard.forEach((n) => console.log(`        - ${n}`));
  }

  // --- Escritura en BD (upsert) ---
  let created = 0;
  let updated = 0;
  const exportRows: string[] = [
    ["Matricula", "Nombre", "Usuario", "Contrasena", "Tutor", "Telefono", "Correo"]
      .map(csvCell)
      .join(","),
  ];

  for (const p of prepared) {
    const birthDate = parseBirthDate(p.row.fechaNacimiento);
    const guardianPhone = cleanPhone(p.row.telefono);
    const passwordHash = await bcrypt.hash(p.password, 10);

    if (!dryRun) {
      // Upsert del expediente por su clave única (el usuario). Para hermanos que
      // comparten matrícula, el usuario lleva sufijo (-2), y así cada hermano es
      // un expediente distinto (la matrícula del Student = usuario de acceso).
      const student = await prisma.student.upsert({
        where: { matricula: p.username },
        update: {
          firstName: p.firstName,
          lastName: p.lastName,
          birthDate: birthDate ?? undefined,
          guardianName: p.row.tutor || undefined,
          guardianPhone: guardianPhone || undefined,
          guardianEmail: p.row.correo || undefined,
        },
        create: {
          matricula: p.username,
          firstName: p.firstName,
          lastName: p.lastName,
          birthDate,
          guardianName: p.row.tutor || null,
          guardianPhone: guardianPhone || null,
          guardianEmail: p.row.correo || null,
        },
      });

      // Upsert de la cuenta por usuario.
      const existing = await prisma.user.findUnique({
        where: { username: p.username },
        select: { id: true },
      });
      await prisma.user.upsert({
        where: { username: p.username },
        update: {
          name: p.firstName + " " + p.lastName,
          role: "ALUMNO",
          passwordHash,
          initialPassword: p.password,
          studentId: student.id,
        },
        create: {
          name: p.firstName + " " + p.lastName,
          username: p.username,
          role: "ALUMNO",
          passwordHash,
          initialPassword: p.password,
          studentId: student.id,
        },
      });
      if (existing) updated++;
      else created++;
    }

    exportRows.push(
      [
        p.username,
        `${p.firstName} ${p.lastName}`,
        p.username,
        p.password,
        p.row.tutor,
        guardianPhone,
        p.row.correo,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // --- Archivo exportable de credenciales ---
  const exportsDir = path.resolve(process.cwd(), "exports");
  fs.mkdirSync(exportsDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(exportsDir, `credenciales_alumnos_${stamp}.csv`);
  fs.writeFileSync(outPath, exportRows.join("\n") + "\n", "utf8");

  console.log("\n✅ Resumen:");
  console.log(`   Cuentas creadas:     ${created}`);
  console.log(`   Cuentas actualizadas: ${updated}`);
  console.log(`   Credenciales exportadas: ${outPath}`);
  if (dryRun) console.log("   (dry-run: no se escribió en la BD)");
}

/** Clave normalizada para comparar identidades (sin acentos, minúsculas). */
function stripKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

main()
  .catch((e) => {
    console.error("❌ Error en import:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
