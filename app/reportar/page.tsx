import type { Metadata } from "next";
import { HandsClapping } from "@phosphor-icons/react/dist/ssr";
import { listServiceAreas, listServiceLeaders, listServiceSchools } from "@/lib/queries";
import { LogoLockup } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { PublicServiceLogForm } from "@/components/public-service-log-form";

export const metadata: Metadata = {
  title: "Registro de horas · Servicio social",
  // La liga se comparte por WhatsApp y correo, no se busca en Google: que no la
  // indexen es lo que uno esperaría de una hoja de registro de una casa.
  robots: { index: false, follow: false },
};

/**
 * Se arma en cada visita, no en el build.
 *
 * Antes iba con `revalidate` y quedaba prerrenderizada, lo cual sonaba bien —es
 * una página pública— pero tenía dos problemas: el `next build` pasaba a NECESITAR
 * la base de datos para pasar (y tronaba en cuanto el esquema iba por delante del
 * despliegue), y las tres listas quedaban congeladas al momento de compilar.
 *
 * La alternativa fina de esta versión de Next es `'use cache'`, pero pide prender
 * `cacheComponents` en TODO el proyecto y eso cambia cómo se renderiza cada
 * pantalla: demasiado para un formulario que ve un puñado de gente a la semana.
 * Dos consultas de catálogo por visita salen más baratas que ese riesgo.
 */
export const dynamic = "force-dynamic";

/**
 * La liga abierta que se le comparte a los prestadores de servicio social. Toma
 * el lugar del Google Form: se llena sin cuenta y sin contraseña.
 *
 * De la base solo lee los catálogos de áreas y líderes —lo mismo que el
 * formulario de Google enseñaba en sus listas— y nada del padrón. Un formulario
 * abierto que enseñara quién colabora aquí sería una manera de averiguarlo.
 */
export default async function ReportarPage() {
  const [areas, lideres, escuelas] = await Promise.all([
    listServiceAreas(),
    listServiceLeaders(),
    listServiceSchools(),
  ]);

  return (
    <main className="min-h-[100dvh] bg-bg">
      <span aria-hidden className="rainbow-strip fixed inset-x-0 top-0 z-20 h-1.5" />
      <div className="mx-auto w-full max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:px-6">
        <LogoLockup className="h-14" />

        <div className="mt-6 mb-5 space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink">
            <HandsClapping weight="fill" className="size-6 text-primary" />
            Registro de horas
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Reporta las horas de servicio social de tu semana. Una semana por reporte: si
            apoyaste en dos áreas, manda uno por cada una. La coordinación revisa y autoriza.
          </p>
        </div>

        <Card className="p-5 sm:p-6">
          <PublicServiceLogForm
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
            lideres={lideres.map((l) => ({ id: l.id, name: l.name }))}
            escuelas={escuelas.map((e) => ({ id: e.id, name: e.name }))}
          />
        </Card>

        <p className="mt-6 text-center text-xs text-subtle">
          Gigi&apos;s Playhouse México · Coordinación de servicio social
        </p>
      </div>
    </main>
  );
}
