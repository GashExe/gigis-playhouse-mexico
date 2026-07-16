/**
 * Textos legales que el tutor debe aceptar en su primer ingreso.
 *
 * ⚠️ PROVISIONAL: estos son textos GENÉRICOS de ejemplo. Cuando llegue el
 * aviso de privacidad y el reglamento oficiales de Gigi's Playhouse, se
 * reemplazan aquí y se SUBE la versión (`LEGAL_VERSION`) para que a todas las
 * familias se les vuelva a pedir la aceptación.
 */

/** Al cambiar cualquiera de los textos, sube esta versión (ej. "2026-08"). */
export const LEGAL_VERSION = "generico-2026-07";

export const AVISO_PRIVACIDAD = `AVISO DE PRIVACIDAD (versión provisional)

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

export const REGLAMENTO = `REGLAMENTO DE GIGI'S PLAYHOUSE (versión provisional)

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
 * ¿El tutor debe completar el onboarding antes de acceder a las clases?
 * Requiere onboarding terminado Y que la versión aceptada sea la vigente
 * (si sube la versión, se re-pide la aceptación).
 */
export function needsOnboarding(s: {
  onboardingCompletedAt: Date | null;
  consentVersion: string | null;
}): boolean {
  return !s.onboardingCompletedAt || s.consentVersion !== LEGAL_VERSION;
}
