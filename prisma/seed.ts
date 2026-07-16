import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log("🌱 Sembrando datos iniciales...");

  // ---- Usuarios ----
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  const directora = await prisma.user.upsert({
    where: { username: "directora" },
    update: { username: "directora" },
    create: {
      name: "Marisol Cervantes",
      username: "directora",
      email: "directora@gigisplayhouse.mx",
      passwordHash: await hash("Gigis2026!"),
      role: "DIRECTORA",
    },
  });

  const maestras = await Promise.all(
    [
      { name: "Renata Ávila", username: "renata", email: "renata@gigisplayhouse.mx" },
      { name: "Ximena Bustos", username: "ximena", email: "ximena@gigisplayhouse.mx" },
      { name: "Paulina Escobedo", username: "paulina", email: "paulina@gigisplayhouse.mx" },
    ].map(async (m) =>
      prisma.user.upsert({
        where: { username: m.username },
        update: { username: m.username },
        create: {
          name: m.name,
          username: m.username,
          email: m.email,
          passwordHash: await hash("Maestra2026!"),
          role: "MAESTRA",
        },
      }),
    ),
  );

  // ---- Programas ----
  const programsData = [
    { name: "Lectura y Lenguaje", area: "Comunicación", color: "#E4572E", description: "Desarrollo de vocabulario, lectura y expresión oral." },
    { name: "Matemáticas Divertidas", area: "Cognición", color: "#2E86AB", description: "Números, conteo y razonamiento con juegos." },
    { name: "Habilidades para la Vida", area: "Autonomía", color: "#8AA624", description: "Rutinas diarias, autocuidado e independencia." },
    { name: "Motricidad y Movimiento", area: "Motor", color: "#C05299", description: "Coordinación, motricidad fina y gruesa." },
    { name: "Música y Expresión", area: "Arte", color: "#F2A541", description: "Ritmo, canto y expresión corporal." },
  ];

  const programs = await Promise.all(
    programsData.map(async (p) => {
      const existing = await prisma.program.findFirst({ where: { name: p.name } });
      return existing ?? prisma.program.create({ data: p });
    }),
  );

  // ---- Ciclo ----
  // Las inscripciones son por ciclo, así que el demo necesita uno donde colgarlas.
  const year = new Date().getFullYear();
  const cycle = await prisma.cycle.upsert({
    where: { season_year: { season: "ENE_JUN", year } },
    update: {},
    create: { season: "ENE_JUN", year, label: `Ene–Jun ${year}`, active: true },
  });
  // Y los programas del demo tienen que estar ofertados en él para poder inscribir.
  for (const p of programs) {
    await prisma.program.update({
      where: { id: p.id },
      data: { cycles: { connect: { id: cycle.id } } },
    });
  }

  // ---- Estudiantes ----
  const studentsData = [
    { firstName: "Diego", lastName: "Hernández Luna", birthDate: "2016-03-12", gender: "MASCULINO", guardianName: "Laura Luna", guardianPhone: "55 1234 5678" },
    { firstName: "Valentina", lastName: "Ríos Camacho", birthDate: "2015-07-28", gender: "FEMENINO", guardianName: "Óscar Ríos", guardianPhone: "55 8765 4321" },
    { firstName: "Emiliano", lastName: "Vega Ponce", birthDate: "2017-11-05", gender: "MASCULINO", guardianName: "Adriana Ponce", guardianPhone: "55 2468 1357" },
    { firstName: "Regina", lastName: "Salazar Mora", birthDate: "2014-01-19", gender: "FEMENINO", guardianName: "Fernanda Mora", guardianPhone: "55 1357 2468" },
    { firstName: "Mateo", lastName: "Cordero Ibarra", birthDate: "2018-05-30", gender: "MASCULINO", guardianName: "Rodrigo Cordero", guardianPhone: "55 9753 8642" },
    { firstName: "Isabella", lastName: "Fuentes Rangel", birthDate: "2016-09-14", gender: "FEMENINO", guardianName: "Mónica Rangel", guardianPhone: "55 4826 1739" },
    { firstName: "Santiago", lastName: "Navarro Beltrán", birthDate: "2015-12-02", gender: "MASCULINO", guardianName: "Claudia Beltrán", guardianPhone: "55 6194 2857" },
    { firstName: "Camila", lastName: "Domínguez Ochoa", birthDate: "2017-04-22", gender: "FEMENINO", guardianName: "Julio Domínguez", guardianPhone: "55 3705 9182" },
  ] as const;

  const levels = ["Inicial", "En proceso", "Logrado"];
  const evalTitles = ["Evaluación diagnóstica", "Avance del trimestre", "Cierre de módulo", "Observación de sesión"];

  for (const s of studentsData) {
    const existing = await prisma.student.findFirst({
      where: { firstName: s.firstName, lastName: s.lastName },
    });
    if (existing) continue;

    const student = await prisma.student.create({
      data: {
        firstName: s.firstName,
        lastName: s.lastName,
        birthDate: new Date(s.birthDate),
        gender: s.gender,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        notes: "Participante activo de Gigi's Playhouse.",
      },
    });

    // Inscribir en 2-3 programas al azar
    const shuffled = [...programs].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
    for (const program of chosen) {
      await prisma.enrollment.create({
        data: { studentId: student.id, programId: program.id, cycleId: cycle.id },
      });

      // 1-3 evaluaciones por programa
      const nEvals = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < nEvals; i++) {
        const monthsAgo = (nEvals - i) * 2;
        await prisma.evaluation.create({
          data: {
            studentId: student.id,
            programId: program.id,
            title: evalTitles[Math.floor(Math.random() * evalTitles.length)],
            date: new Date(Date.now() - monthsAgo * 30 * 24 * 60 * 60 * 1000),
            score: Math.round((6 + Math.random() * 4) * 10) / 10,
            scale: "1-10",
            level: levels[Math.floor(Math.random() * levels.length)],
            notes: "Progreso constante, muy participativo en clase.",
            evaluatorId: maestras[Math.floor(Math.random() * maestras.length)].id,
          },
        });
      }
    }
  }

  const counts = {
    usuarios: await prisma.user.count(),
    estudiantes: await prisma.student.count(),
    programas: await prisma.program.count(),
    inscripciones: await prisma.enrollment.count(),
    evaluaciones: await prisma.evaluation.count(),
  };
  console.log("✅ Listo:", counts);
  console.log(`\n   Directora: usuario "${directora.username}"  /  Gigis2026!`);
  console.log(`   Maestra:   usuario "renata"  /  Maestra2026!\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
