import {
  SignIn,
  Balloon,
  ChalkboardTeacher,
  PencilRuler,
  Crown,
  Lightbulb,
  LockSimple,
  Star,
  CalendarCheck,
  Key,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";

/**
 * Secciones del manual de uso. Cada página de manual (personal / alumno) arma
 * la suya combinando estas secciones según el rol de quien la ve.
 */

/* ---------- Piezas pequeñas ---------- */

/** Nombre de un botón o sección tal como aparece en pantalla. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-[var(--radius-input)] border border-border bg-surface-2 px-1.5 py-0.5 text-[0.85em] font-semibold text-ink">
      {children}
    </span>
  );
}

/** Lista de pasos numerados. */
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
          <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-weak text-xs font-extrabold text-primary-strong">
            {i + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({
  tone,
  icon,
  children,
}: {
  tone: "teal" | "amber";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-3 flex items-start gap-2.5 rounded-[var(--radius-control)] px-3.5 py-3 text-sm leading-relaxed ${
        tone === "teal"
          ? "bg-primary-weak text-primary-strong"
          : "bg-warning-weak text-warning-strong"
      }`}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Tarjeta de un tema del manual, con la sección de la app donde ocurre. */
function ManualCard({
  where,
  title,
  children,
}: {
  where: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-subtle">{where}</p>
      <h3 className="mt-0.5 text-base font-extrabold text-ink">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted [&_strong]:font-bold [&_strong]:text-ink">
        {children}
      </div>
    </Card>
  );
}

/** Encabezado de una parte del manual (un rol o bloque de temas). */
export function ManualSectionHeader({
  icon,
  color,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-white shadow-[var(--shadow-sm)]"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-xs font-semibold text-subtle">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ---------- Entrar (común a todos) ---------- */

export function ManualEntrar({ paraFamilia = false }: { paraFamilia?: boolean }) {
  return (
    <section className="space-y-3">
      <ManualSectionHeader
        icon={<SignIn weight="fill" className="size-5" />}
        color="var(--brand-teal)"
        title="Entrar a la plataforma"
      />
      <ManualCard where="Inicio de sesión" title="Usuario y contraseña">
        <Steps
          steps={[
            <>Abre la dirección de la plataforma en el navegador, en computadora o celular.</>,
            <>
              Escribe tu <strong>usuario</strong> y tu <strong>contraseña</strong>. La dirección
              de la playhouse los entrega personalmente; no se crean cuentas por tu lado.
            </>,
            <>
              Al terminar, cierra sesión con el botón <Chip>Salir</Chip>, sobre todo en una
              computadora compartida.
            </>,
          ]}
        />
        <Callout tone="teal" icon={<Key weight="fill" className="size-4" />}>
          ¿Olvidaste tu contraseña? Pídele a la dirección que te la reponga: es la única que
          puede consultarla o cambiarla.
          {paraFamilia && " El usuario del participante se entrega junto con la contraseña."}
        </Callout>
      </ManualCard>
    </section>
  );
}

/* ---------- Participante y familia ---------- */

export function ManualParticipante({ nombre }: { nombre?: string }) {
  const quien = nombre ?? "el participante";
  return (
    <section className="space-y-3">
      <ManualSectionHeader
        icon={<Balloon weight="fill" className="size-5" />}
        color="var(--brand-pink)"
        title="Tu espacio en Gigi's"
        subtitle="Qué puedes hacer con la cuenta del participante"
      />

      <ManualCard where="Primer ingreso" title="Formulario de bienvenida (solo una vez)">
        <p>
          La primera vez que entres, la plataforma te lleva a un formulario de bienvenida.
          Hasta no completarlo, no se abre el resto del espacio.
        </p>
        <Steps
          steps={[
            <>
              Completa los <strong>datos del participante</strong>: fecha de nacimiento, tutor,
              teléfono, correo y dirección.
            </>,
            <>
              Llena el <strong>cuestionario de salud</strong>: alergias, medicamentos,
              condiciones médicas, terapias y contacto de emergencia.
            </>,
            <>
              Lee y acepta el <strong>aviso de privacidad</strong> y el <strong>reglamento</strong>.
            </>,
          ]}
        />
        <Callout tone="teal" icon={<LockSimple weight="fill" className="size-4" />}>
          Los datos de salud son confidenciales: solo el equipo de Gigi&apos;s puede verlos. Si el
          aviso o el reglamento cambian, la plataforma pedirá aceptarlos de nuevo.
        </Callout>
      </ManualCard>

      <ManualCard where="Uso diario" title="Mi espacio">
        <p>Después de la bienvenida, al entrar verás:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            La <strong>matrícula</strong> de {quien}, como referencia.
          </li>
          <li>
            Los <strong>programas</strong> en los que está inscrito, con su área, color,{" "}
            <strong>horario</strong> y quién imparte la clase. Las inscripciones las registra
            el equipo de Gigi&apos;s.
          </li>
          <li>
            Las <strong>anotaciones del equipo</strong>: avances y avisos que las maestras
            comparten con la familia sobre {quien}.
          </li>
          <li>
            La <strong>asistencia reciente</strong> a sus clases, tal como la registró la
            maestra al pasar lista.
          </li>
          <li>
            Los <strong>avisos de Gigi&apos;s</strong> (anuncios de la dirección) y las{" "}
            <strong>clases suspendidas</strong> próximas, para estar siempre al tanto.
          </li>
        </ul>
        <Callout tone="teal" icon={<CalendarCheck weight="fill" className="size-4" />}>
          <strong>Apartar actividades:</strong> en tu espacio ves la oferta del ciclo con
          horario y lugares disponibles. Pide lugar con un toque; el equipo de Gigi&apos;s
          confirma tu solicitud y ahí queda la inscripción. Mientras esté pendiente puedes
          cancelarla. Solo se pueden apartar las actividades cuyos{" "}
          <strong>requisitos cumple el participante</strong> (por ejemplo, el rango de
          edad): las demás aparecen con su requisito a la vista.
        </Callout>
      </ManualCard>
    </section>
  );
}

/* ---------- Maestras y maestros ---------- */

export function ManualMaestro({ soloAsignados = true }: { soloAsignados?: boolean }) {
  // Con rol maestra la sección habla de "tus programas" (los únicos que ve y
  // califica); coordinación y dirección leen el flujo sin esa restricción.
  return (
    <section className="space-y-3">
      <ManualSectionHeader
        icon={<ChalkboardTeacher weight="fill" className="size-5" />}
        color="var(--brand-blue)"
        title="Trabajo docente"
        subtitle="Consultar expedientes y calificar a tu grupo"
      />

      <ManualCard where="Panel" title="El resumen del día">
        <p>
          Al entrar verás el <Chip>Panel</Chip>: participantes activos, programas e
          inscripciones vigentes, evaluaciones del mes y los participantes por programa. Es solo
          lectura; sirve para ubicarte rápido.
        </p>
      </ManualCard>

      <ManualCard where="Calendario" title="Tus clases de la semana">
        <p>
          En <Chip>Calendario</Chip> ves las clases de la semana según los días y horas de
          cada programa{soloAsignados ? " a tu cargo" : ""}. Al tocar una clase se abre su{" "}
          <strong>panel del día</strong>:
        </p>
        <Steps
          steps={[
            <>
              <strong>Pasa lista</strong>: marca a cada alumno como presente, retardo,
              justificado o ausente. Se guarda al instante y puedes agregar un detalle
              («aviso de la mamá»).
            </>,
            <>
              Escribe la <strong>bitácora de la clase</strong>: qué se trabajó, acuerdos y
              pendientes para la próxima sesión.
            </>,
            <>
              <strong>Toca a un alumno de la lista</strong> para abrir su panel ahí mismo,
              con dos pestañas: <Chip>Anotación</Chip> y <Chip>Evaluación</Chip>.
            </>,
            <>
              En <Chip>Anotación</Chip> le dejas una nota. Si la marcas{" "}
              <Chip>Visible para la familia</Chip>, aparece en el espacio del participante
              para que en casa estén enterados; si no, queda interna del equipo.
            </>,
            <>
              En <Chip>Evaluación</Chip> calificas los temas de su nivel (escala 1 a 4, se
              guarda al instante) sin salir del calendario. Es la misma evaluación que se ve
              en el expediente.
            </>,
          ]}
        />
        <Callout tone="teal" icon={<CalendarCheck weight="fill" className="size-4" />}>
          Con las flechas junto a la fecha te mueves entre días de clase, por si necesitas
          completar la lista de una sesión pasada. Desde el mismo panel puedes{" "}
          <strong>suspender la clase</strong> de un día (la familia lo ve en su espacio y
          el calendario la tacha) y abrir el <strong>historial de bitácoras</strong> del
          grupo, sesión por sesión.
        </Callout>
      </ManualCard>

      <ManualCard where="Participantes" title="Consultar expedientes">
        <p>
          En <Chip>Participantes</Chip> puedes <strong>buscar</strong> por nombre o tutor,{" "}
          <strong>filtrar</strong> por estado (activos, inactivos, egresados) y abrir el
          expediente de cualquier participante: contacto, salud, programas y niveles.
        </p>
        <p>
          El expediente es <strong>de consulta</strong>: registrar participantes, editar sus
          datos, cambiar su estado e inscribirlos a programas lo hace coordinación o dirección.
        </p>
      </ManualCard>

      <ManualCard
        where="Programas"
        title={soloAsignados ? "Tus programas asignados" : "Programas del ciclo"}
      >
        {soloAsignados ? (
          <p>
            En <Chip>Programas</Chip> ves <strong>solo los programas a tu cargo</strong> en el
            ciclo, con su horario, cupo y alumnos inscritos.
          </p>
        ) : (
          <p>
            En <Chip>Programas</Chip> se ve la oferta del ciclo seleccionado, con horario, cupo
            y alumnos inscritos de cada actividad.
          </p>
        )}
        <p>
          Los ciclos del año son tres: <strong>Ene–Jun</strong>, <strong>Jul–Ago</strong>{" "}
          (verano) y <strong>Sep–Dic</strong>; cada ciclo guarda su propio historial de
          calificaciones.
        </p>
      </ManualCard>

      <ManualCard where="Expediente · Niveles" title="Ubicar en un nivel">
        <p>
          Cada programa tiene sus propios niveles (por ejemplo, en Lectura: Prerrequisitos,
          Inicial, Intermedio, Avanzado).
        </p>
        {soloAsignados && (
          <p>
            Solo puedes ubicar y calificar a los alumnos de <strong>tus programas</strong>.
          </p>
        )}
        <p>Antes de calificar hay que ubicar al participante:</p>
        <Steps
          steps={[
            <>
              En el expediente, en la sección de niveles, pulsa <Chip>Ubicar</Chip>.
            </>,
            <>
              Elige el <strong>programa</strong>, el <strong>nivel</strong> y su situación.
              Puedes agregar una nota breve.
            </>,
          ]}
        />
        <div className="mt-3 space-y-1.5">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
              Regular
            </span>
            avanza con normalidad (situación por defecto).
          </p>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-full bg-warning-weak px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
              Probatorio
            </span>
            está en el nivel a prueba; conviene revisarlo pronto.
          </p>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-full bg-success-weak px-2.5 py-0.5 text-xs font-semibold text-success-strong">
              Posible graduado
            </span>
            candidato a concluir el programa.
          </p>
        </div>
      </ManualCard>

      <ManualCard where="Expediente · Calificar" title="Calificar por bloques">
        <Steps
          steps={[
            <>
              En la sección de niveles del expediente, pulsa el botón{" "}
              <Chip>Calificar por bloques</Chip> del programa.
            </>,
            <>
              Verás la plantilla del nivel: sus bloques y, dentro de cada uno, los temas u
              objetivos («Puedo contar hasta 10»).
            </>,
            <>
              Toca la calificación de cada tema. <strong>Se guarda sola al instante</strong>; no
              hay botón de guardar.
            </>,
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["1", "Iniciando"],
            ["2", "En proceso"],
            ["3", "Casi lo logra"],
            ["4", "Dominado"],
          ].map(([n, label]) => (
            <div
              key={n}
              className={`rounded-[var(--radius-control)] border px-2 py-2 text-center ${
                n === "4"
                  ? "border-transparent bg-primary-weak"
                  : "border-border bg-surface-2"
              }`}
            >
              <p
                className={`tnum text-lg font-extrabold ${
                  n === "4" ? "text-primary-strong" : "text-ink"
                }`}
              >
                {n}
              </p>
              <p className="text-xs font-semibold text-muted">{label}</p>
            </div>
          ))}
        </div>
        <Callout tone="amber" icon={<Star weight="fill" className="size-4" />}>
          La calificación máxima es <strong>4</strong>. No existe el 5 ni el 10: la escala
          siempre es 1 a 4.
        </Callout>
        <p>
          Con las calificaciones, la plataforma calcula solo el <strong>porcentaje de avance</strong>{" "}
          de cada bloque y del nivel completo. Un bloque se <strong>desbloquea</strong> al
          llegar al porcentaje que define el programa (normalmente <strong>80%</strong>);
          cuando el participante desbloquea <strong>todos los bloques del nivel</strong>, la
          plataforma te ofrece el botón para <strong>subirlo al siguiente nivel</strong> (o
          marcarlo como posible graduado si ya era el último). Con las pestañas de ciclo
          puedes revisar ciclos anteriores sin alterar el actual.
        </p>
      </ManualCard>

    </section>
  );
}

/* ---------- Coordinación educativa ---------- */

export function ManualCoordinacion() {
  return (
    <section className="space-y-3">
      <ManualSectionHeader
        icon={<PencilRuler weight="fill" className="size-5" />}
        color="var(--brand-purple)"
        title="Coordinación educativa"
        subtitle="Participantes, inscripciones, actividades y plantillas"
      />

      <ManualCard where="Participantes" title="Registrar y editar participantes">
        <Steps
          steps={[
            <>
              Ve a <Chip>Participantes</Chip> y pulsa <Chip>Nuevo participante</Chip>.
            </>,
            <>
              Captura nombre, apellidos y los datos que tengas a la mano. La familia completará
              el resto en su primer ingreso.
            </>,
            <>
              Al guardar, la plataforma <strong>crea automáticamente la cuenta de la familia</strong>.
              La dirección le entrega el usuario y la contraseña.
            </>,
          ]}
        />
        <p>
          Desde el expediente también puedes <strong>editar los datos</strong>, cambiar el{" "}
          <strong>estado</strong> (activo, inactivo, egresado) y capturar o corregir el{" "}
          <strong>historial médico</strong>. El rol maestra solo consulta.
        </p>
      </ManualCard>

      <ManualCard where="Expediente" title="Inscribir a programas">
        <Steps
          steps={[
            <>
              Abre el expediente del participante desde <Chip>Participantes</Chip>.
            </>,
            <>
              En el panel de programas, elige a cuál inscribirlo. Solo aparecen los programas{" "}
              <strong>ofertados en el ciclo actual</strong>.
            </>,
            <>Desde ahí mismo puedes pausar, finalizar o quitar una inscripción.</>,
          ]}
        />
        <p>
          Un participante puede repetir un programa en ciclos distintos; cada ciclo guarda su
          propio historial.
        </p>
      </ManualCard>

      <ManualCard where="Programas" title="Crear y editar actividades">
        <p>
          Cada programa es una actividad con <strong>horario, cupo, rango de edad, color</strong>{" "}
          y un <strong>maestro a cargo</strong>. Asignar al maestro importa: define{" "}
          <strong>qué grupo puede ver y calificar</strong> cada maestra.
        </p>
        <p>
          Los <strong>días de clase</strong> (día de la semana y hora de inicio y fin) se
          capturan al editar el programa. Son los que arman el <Chip>Calendario</Chip> del
          equipo: un programa sin días capturados no aparece en él.
        </p>
      </ManualCard>

      <ManualCard where="Programas · Plantilla" title="Editar la plantilla de un programa">
        <Steps
          steps={[
            <>
              En <Chip>Programas</Chip>, abre la opción <Chip>Plantilla</Chip> del programa.
            </>,
            <>
              Arma la estructura: <strong>niveles → bloques → temas</strong>. Por ejemplo: Nivel
              1 → Bloque 1.1 «Sentido numérico y conteo hasta 10» → tema a) «Puedo contar hasta
              10».
            </>,
            <>
              Define el <strong>porcentaje para pasar de nivel</strong> (80% por defecto).
            </>,
          ]}
        />
        <p>Hay tres formatos de plantilla según el programa:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Bloques</strong> — niveles con bloques numerados (1.1, 1.2…) y temas. Ej.:
            Matemáticas, Lectura.
          </li>
          <li>
            <strong>Áreas</strong> — niveles con áreas (Receptivo, Expresivo, Social…). Ej.:
            Lenguaje.
          </li>
          <li>
            <strong>Plano</strong> — un solo formato con secciones, sin niveles. Ej.: Danza,
            Terapia Ocupacional.
          </li>
        </ul>
        <Callout tone="amber" icon={<Star weight="fill" className="size-4" />}>
          Los formatos se respetan <strong>tal como los diseñaron las especialistas</strong>. Si
          algo parece incompleto o «raro», es criterio del formato original: no se rellena ni se
          corrige por cuenta propia.
        </Callout>
      </ManualCard>

      <ManualCard where="Programas · Nuevo" title="Crear un programa a partir de una plantilla">
        <p>Al crear un programa eliges de dónde parte su plantilla:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>En blanco</strong> — la armas desde cero.
          </li>
          <li>
            <strong>Copiar de otro programa</strong> — clona los niveles, bloques y temas de un
            programa existente.
          </li>
          <li>
            <strong>Desde la biblioteca</strong> — parte de una plantilla base guardada.
          </li>
        </ul>
        <p>
          Cuando una plantilla quede bien armada, guárdala en la biblioteca
          (<Chip>Guardar como plantilla</Chip>) para reutilizarla en programas futuros.
        </p>
        <Callout tone="teal" icon={<Lightbulb weight="fill" className="size-4" />}>
          Editar la plantilla de un programa no borra calificaciones ya registradas, pero cambia
          la base sobre la que se calcula el avance. Haz los cambios grandes antes de que
          arranque el ciclo.
        </Callout>
      </ManualCard>
    </section>
  );
}

/* ---------- Dirección ---------- */

export function ManualDireccion() {
  return (
    <section className="space-y-3">
      <ManualSectionHeader
        icon={<Crown weight="fill" className="size-5" />}
        color="var(--brand-orange)"
        title="Dirección"
        subtitle="Funciones que solo tú ves"
      />

      <ManualCard where="Equipo" title="Cuentas del personal">
        <p>
          En <Chip>Equipo</Chip> creas las cuentas de maestras y coordinación, defines su
          contraseña inicial, asignas roles y desactivas accesos cuando alguien deja el equipo.
        </p>
      </ManualCard>

      <ManualCard where="Programas · Ciclos" title="Ciclos y oferta">
        <p>
          Desde la barra de ciclos activas el <strong>ciclo vigente</strong> (el único donde se
          puede inscribir) y armas la <strong>oferta de cada ciclo</strong> eligiendo qué
          programas corren en él. El programa sigue siendo uno solo: conserva su plantilla y su
          historial entre ciclos.
        </p>
      </ManualCard>

      <ManualCard where="Participantes" title="Credenciales de las familias">
        <p>
          En el expediente de cada participante ves su <strong>usuario y contraseña inicial</strong>{" "}
          para entregárselos a la familia, y en <Chip>Participantes</Chip> puedes{" "}
          <Chip>Descargar credenciales</Chip> con la lista completa. Es información
          confidencial: solo tú puedes verla.
        </p>
      </ManualCard>

      <ManualCard where="Avisos" title="Anuncios a las familias">
        <p>
          En <Chip>Avisos</Chip> publicas anuncios que aparecen en el espacio de las
          familias: a <strong>todos los participantes activos</strong> o solo a los que
          elijas (con buscador). Sirven para eventos, recordatorios o cualquier cosa que
          las familias deban saber.
        </p>
      </ManualCard>

      <ManualCard where="Panel" title="Reservas de las familias">
        <p>
          Cuando una familia <strong>aparta lugar</strong> en una actividad desde su
          espacio, la solicitud aparece en tu <Chip>Panel</Chip> con el cupo a la vista.
          Al <Chip>Aprobar</Chip> se crea la inscripción del ciclo; al{" "}
          <Chip>Rechazar</Chip>, la familia lo ve en su espacio y puede volver a pedir
          más adelante.
        </p>
      </ManualCard>
    </section>
  );
}
