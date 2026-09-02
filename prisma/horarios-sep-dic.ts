/**
 * Horario del ciclo Sep–Dic 2026, tal como lo mandaron las especialistas.
 *
 * Fuentes (WhatsApp, 17-ago-2026):
 *   • "Horario Sep-Dic CASA 1.odt"            → académicos y talleres de Casa 1
 *   • "Horario Lenguaje_Qro (1).xlsx"          → lenguaje (Cata, Ceci, Gaby, Nadia, Regina)
 *   • "Horarios T. Física_DianaSantos.xlsx"    → terapia física / gateo / brinco
 *   • "Horarios Sensorial_DianaSantos.xlsx"    → sensorial
 *   • "Horario Orofacial_RosaBecerra (2).xlsx" → orofacial
 *   • Captura del resumen de actividades por la tarde
 *
 * Cada renglón es un BLOQUE (mañana o tarde) de un día: dentro del bloque las
 * terapeutas encadenan sesiones individuales de 30–45 min, pero la plataforma
 * levanta UNA clase por programa y día, así que el bloque es la unidad correcta.
 * Los huecos administrativos que traen los formatos se respetan: no se rellenan.
 */

/** 1=lunes … 6=sábado, igual que Date.getDay(). */
export type Slot = { d: number; from: string; to: string; nota?: string };

export type ProgramaHorario = {
  /** Nombre EXACTO del programa en la plataforma. */
  programa: string;
  /** Texto libre que se guarda en Program.schedule (lo que lee la familia). */
  resumen: string;
  slots: Slot[];
};

export const HORARIOS: ProgramaHorario[] = [
  {
    programa: "Lectura",
    resumen:
      "Lun 9:00–12:30 y 16:00–19:00 · Mar 10:00–11:00 y 16:00–19:00 · Mié 10:00–11:00 y 16:00–19:00 · " +
      "Jue 10:00–11:00 y 16:00–19:00 · Vie 16:00–18:00. Tutorías individuales dentro de cada bloque; " +
      "Prerrequisitos se trabaja en grupo lun 16:00–17:00 y jue 17:00–18:00.",
    slots: [
      { d: 1, from: "09:00", to: "12:30" },
      { d: 1, from: "16:00", to: "19:00" },
      { d: 2, from: "10:00", to: "11:00" },
      { d: 2, from: "16:00", to: "19:00" },
      { d: 3, from: "10:00", to: "11:00" },
      { d: 3, from: "16:00", to: "19:00" },
      { d: 4, from: "10:00", to: "11:00" },
      { d: 4, from: "16:00", to: "19:00" },
      { d: 5, from: "16:00", to: "18:00" },
    ],
  },
  {
    programa: "Escritura",
    resumen:
      "Lun 10:00–11:15 y 17:00–19:00 · Mar 11:00–12:00 y 16:00–18:00 · Mié 9:40–12:15 y 16:00–19:00 · " +
      "Jue 10:00–12:00 y 17:00–19:00 · Vie 16:00–17:00. Preescritura en grupo lun 17:00–18:00 y jue 18:00–19:00.",
    slots: [
      { d: 1, from: "10:00", to: "11:15" },
      { d: 1, from: "17:00", to: "19:00" },
      { d: 2, from: "11:00", to: "12:00" },
      { d: 2, from: "16:00", to: "18:00" },
      { d: 3, from: "09:40", to: "12:15" },
      { d: 3, from: "16:00", to: "19:00" },
      { d: 4, from: "10:00", to: "12:00" },
      { d: 4, from: "17:00", to: "19:00" },
      { d: 5, from: "16:00", to: "17:00" },
    ],
  },
  {
    programa: "Matemáticas",
    resumen:
      "Lun 9:00–12:00 y 16:00–19:00 · Mar 10:00–12:00 y 16:00–19:00 · Mié 11:00–12:45 y 16:00–19:00 · " +
      "Jue 11:00–12:00 y 16:00–19:00 · Vie 16:00–18:00.",
    slots: [
      { d: 1, from: "09:00", to: "12:00" },
      { d: 1, from: "16:00", to: "19:00" },
      { d: 2, from: "10:00", to: "12:00" },
      { d: 2, from: "16:00", to: "19:00" },
      { d: 3, from: "11:00", to: "12:45" },
      { d: 3, from: "16:00", to: "19:00" },
      { d: 4, from: "11:00", to: "12:00" },
      { d: 4, from: "16:00", to: "19:00" },
      { d: 5, from: "16:00", to: "18:00" },
    ],
  },
  {
    programa: "Cocina",
    resumen: "Lunes 16:00–18:00 (inicial 16:00–17:00, avanzada 17:00–18:00). Líder: Alejandra González.",
    slots: [{ d: 1, from: "16:00", to: "18:00" }],
  },
  {
    programa: "Terapia ocupacional",
    resumen: "Lunes 16:00–19:00.",
    slots: [{ d: 1, from: "16:00", to: "19:00" }],
  },
  {
    programa: "Habilidades sociales",
    resumen: "Lunes, martes y miércoles 16:00–19:00.",
    slots: [
      { d: 1, from: "16:00", to: "19:00" },
      { d: 2, from: "16:00", to: "19:00" },
      { d: 3, from: "16:00", to: "19:00" },
    ],
  },
  {
    programa: "Danza representativa",
    resumen: "Martes 17:00–19:00. Líderes: Iván (17:00–18:00) y Fher Soto (18:00–19:00).",
    slots: [{ d: 2, from: "17:00", to: "19:00" }],
  },
  {
    programa: "Terapia física",
    resumen: "Martes 16:00–19:00 (incluye GigiFit adultos 16:00–17:00) y jueves 9:00–12:00. Terapeuta: Diana Santos.",
    slots: [
      { d: 2, from: "16:00", to: "19:00" },
      { d: 4, from: "09:00", to: "12:00" },
    ],
  },
  {
    programa: "Gateo y caminata",
    resumen: "Martes 16:00–19:00 y jueves 9:00–12:00. Terapeuta: Diana Santos.",
    slots: [
      { d: 2, from: "16:00", to: "19:00" },
      { d: 4, from: "09:00", to: "12:00" },
    ],
  },
  {
    programa: "Brinco, salto y corro",
    resumen: "Martes 18:00–19:00 y jueves 9:00–12:00. Terapeuta: Diana Santos.",
    slots: [
      { d: 2, from: "18:00", to: "19:00" },
      { d: 4, from: "09:00", to: "12:00" },
    ],
  },
  {
    programa: "Sensorial",
    resumen:
      "Miércoles 9:00–12:00 · jueves 9:00–10:30 y 16:00–19:00 · martes 18:15–19:00. Terapeuta: Diana Santos.",
    slots: [
      { d: 2, from: "18:15", to: "19:00" },
      { d: 3, from: "09:00", to: "12:00" },
      { d: 4, from: "09:00", to: "10:30" },
      { d: 4, from: "16:00", to: "19:00" },
    ],
  },
  {
    programa: "Terapia orofacial",
    resumen:
      "Miércoles 9:40–12:40 · jueves 9:40–12:40 (quincenal) · sábado 9:00–12:00 (quincenal). Líder: Rosy Becerra.",
    slots: [
      { d: 3, from: "09:40", to: "12:40" },
      { d: 4, from: "09:40", to: "12:40", nota: "quincenal" },
      { d: 6, from: "09:00", to: "12:00", nota: "quincenal" },
    ],
  },
  {
    programa: "Lenguaje individual o en pareja",
    resumen:
      "Lun 9:00–13:00 · Mar 9:00–14:30 y 16:00–19:00 · Mié 9:00–14:00 y 16:00–19:00 · Jue 10:00–13:00 y 16:00–19:00. " +
      "Terapeutas: Cata Palacio, Ceci Morvillo, Gaby Aristoy, Nadia Díaz y Regina Cavazos.",
    slots: [
      { d: 1, from: "09:00", to: "13:00" },
      { d: 2, from: "09:00", to: "14:30" },
      { d: 2, from: "16:00", to: "19:00" },
      { d: 3, from: "09:00", to: "14:00" },
      { d: 3, from: "16:00", to: "19:00" },
      { d: 4, from: "10:00", to: "13:00" },
      { d: 4, from: "16:00", to: "19:00" },
    ],
  },
  {
    programa: "Lenguaje, música y gestos",
    resumen: "Jueves 10:30–11:00 (grupo 1) y 17:00–17:30 (grupo 2). Terapeuta: Nadia Díaz.",
    slots: [
      { d: 4, from: "10:30", to: "11:00", nota: "LMYG 1" },
      { d: 4, from: "17:00", to: "17:30", nota: "LMYG 2" },
    ],
  },
  {
    programa: "Vida independiente",
    resumen: "Lunes 9:00–10:00 (grupos administrativos GA1 y GA2) y miércoles 9:30–10:30 (GigiFit V.I.).",
    slots: [
      { d: 1, from: "09:00", to: "10:00" },
      { d: 3, from: "09:30", to: "10:30" },
    ],
  },
];
