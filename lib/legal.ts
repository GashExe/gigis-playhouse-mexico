import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Textos legales que el tutor acepta en su primer ingreso (aviso de privacidad y
 * reglamento).
 *
 * Los textos VIGENTES viven en la base de datos (modelo LegalConfig) y la
 * dirección los edita desde /configuracion — usa `getLegalConfig()` para leerlos.
 * Las constantes DEFAULT_* de abajo son solo la semilla inicial: se guardan en la
 * BD la primera vez y a partir de ahí manda lo que la directora deje escrito.
 */

/** Versión semilla. Al editar los textos, la acción genera una versión nueva. */
export const DEFAULT_LEGAL_VERSION = "generico-2026-07";

export const DEFAULT_AVISO_PRIVACIDAD = `AVISO DE PRIVACIDAD (versión provisional)

Gigi's Playhouse México, con domicilio en la Ciudad de México, es responsable del
tratamiento y protección de los datos personales que usted proporcione.

Los datos del participante y de su tutor (incluidos datos de salud, considerados
sensibles) se recaban con la finalidad de: brindar y dar seguimiento a los programas
y terapias, atender emergencias médicas, comunicarnos con la familia y llevar el
expediente del participante.

No compartiremos sus datos con terceros salvo obligación legal o para la atención de
una emergencia. Usted puede ejercer sus derechos de acceso, rectificación, cancelación
u oposición (ARCO) contactando al equipo de Gigi's Playhouse.

Al aceptar, usted consiente el tratamiento de los datos personales y de salud aquí
descritos conforme a la Ley Federal de Protección de Datos Personales en Posesión de
los Particulares.

(Texto provisional: será sustituido por el aviso de privacidad oficial.)`;

export const DEFAULT_REGLAMENTO = `REGLAMENTO DE GIGI'S PLAYHOUSE (versión provisional)

1. Puntualidad: llegar a tiempo a las sesiones; avisar con anticipación cualquier
   inasistencia.
2. Acompañamiento: el tutor es responsable del participante antes y después de la
   sesión, salvo indicación del programa.
3. Salud: informar al equipo cualquier condición médica, alergia o medicamento, y
   mantener actualizado el cuestionario de salud.
4. Respeto: mantener un trato respetuoso con participantes, familias y personal.
5. Materiales e instalaciones: cuidar el espacio y los materiales de la playhouse.
6. Emergencias: autorizar al equipo a tomar medidas razonables ante una emergencia
   médica mientras se localiza a la familia.
7. Comunicación: revisar los avisos de la plataforma y mantener sus datos de contacto
   al día.

Al aceptar, usted declara haber leído y estar de acuerdo con este reglamento.

(Texto provisional: será sustituido por el reglamento oficial.)`;

/**
 * Textos legales vigentes (los que edita la dirección). Registro único id=1: si
 * aún no existe, se siembra con las constantes DEFAULT_*. Cacheado por request.
 */
export const getLegalConfig = cache(async () => {
  const existing = await prisma.legalConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  // Primera vez: sembramos la fila con los textos por defecto. `upsert` protege
  // contra una carrera si dos peticiones la crean a la vez.
  return prisma.legalConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      avisoPrivacidad: DEFAULT_AVISO_PRIVACIDAD,
      reglamento: DEFAULT_REGLAMENTO,
      version: DEFAULT_LEGAL_VERSION,
    },
  });
});

/**
 * ¿El tutor debe completar el onboarding antes de acceder a las clases?
 * Requiere onboarding terminado Y que la versión aceptada sea la vigente
 * (si la dirección cambia los textos, sube la versión y se re-pide la aceptación).
 */
export function needsOnboarding(
  s: {
    onboardingCompletedAt: Date | null;
    consentVersion: string | null;
  },
  currentVersion: string,
): boolean {
  return !s.onboardingCompletedAt || s.consentVersion !== currentVersion;
}
