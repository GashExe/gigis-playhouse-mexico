import {
  SignIn,
  Balloon,
  ChalkboardTeacher,
  PencilRuler,
  Crown,
  LockSimple,
  Star,
  CalendarCheck,
  Key,
  Warning,
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
            Las <strong>anotaciones del equipo</strong>: avances y avisos que las terapeutas
            comparten con la familia sobre {quien}.
          </li>
          <li>
            La <strong>asistencia reciente</strong> a sus clases, tal como la registró la
            terapeuta al pasar lista.
          </li>
          <li>
            Los <strong>avisos de Gigi&apos;s</strong> (anuncios de la dirección) y las{" "}
            <strong>clases suspendidas</strong> próximas, para estar siempre al tanto.
          </li>
        </ul>
        <Callout tone="teal" icon={<CalendarCheck weight="fill" className="size-4" />}>
          <strong>Inscribir actividades:</strong> en tu espacio ves la oferta del ciclo con
          horario y lugares disponibles. Inscribes con un toque y queda al momento, mientras
          haya lugares. Solo verás las actividades <strong>para la edad</strong> de tu hijo o
          hija, y las que <strong>no se empalman</strong> con las que ya lleva: dos clases a
          la misma hora no se pueden cursar. Si la dirección lo dio de baja de una actividad,
          esa ya no la puedes volver a inscribir tú: háblalo con ella.
        </Callout>
      </ManualCard>
    </section>
  );
}

/* ---------- Terapeutas ---------- */

export function ManualTerapeuta({ soloAsignados = true }: { soloAsignados?: boolean }) {
  // Con rol terapeuta la sección habla de "tus programas" (los únicos que ve y
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
              En <Chip>Evaluación</Chip> registras su <strong>calificación inicial</strong> y{" "}
              <strong>final</strong> del ciclo (escala 1 a 4, se guarda al instante) sin salir
              del calendario. Es la misma calificación que se ve en el expediente.
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

      <ManualCard where="Expediente · Calificar" title="Calificación inicial y final">
        <p>
          La calificación del ciclo son <strong>dos notas</strong>: con cuál llegó el
          participante (<strong>inicial</strong>) y con cuál cerró (<strong>final</strong>).
          La diferencia entre las dos es su avance. No hay bloques ni temas que palomear.
        </p>
        <Steps
          steps={[
            <>
              En la sección de niveles del expediente, pulsa el botón <Chip>Calificar</Chip>{" "}
              del programa.
            </>,
            <>
              Al empezar el ciclo registra la <strong>calificación inicial</strong>; al
              cerrarlo, la <strong>final</strong>.
            </>,
            <>
              Toca el número. <strong>Se guarda solo al instante</strong>; no hay botón de
              guardar. Si te equivocas, toca de nuevo el número puesto para borrarlo.
            </>,
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["1", "Inicial"],
            ["2", "En proceso"],
            ["3", "Casi logrado"],
            ["4", "Logrado"],
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
          Las dos calificaciones se ven en el expediente, en la boleta, en el historial y en
          el espacio de la familia. Para pasar al participante al siguiente nivel se cambia su
          ubicación en <Chip>Nivel por programa</Chip>. Con las pestañas de ciclo puedes
          revisar ciclos anteriores sin alterar el actual.
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
        subtitle="Participantes, inscripciones y actividades"
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
          <strong>historial médico</strong>. Los roles terapeuta y lector solo consultan.
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
        <Callout tone="amber" icon={<Warning weight="fill" className="size-4" />}>
          <strong>Los reparos los decides tú.</strong> Si la actividad no es para su edad o se
          empalma con otra que ya lleva, la pantalla te lo advierte y te pide confirmar antes de
          inscribirlo; queda anotado en la bitácora que lo autorizó dirección. La familia no
          puede saltarse ninguno de los dos desde su espacio. Y cuando quitas, pausas o
          finalizas una inscripción, esa actividad le queda <strong>cerrada</strong>: la familia
          no puede volver a meterse sola. Se reabre volviéndolo a inscribir (o marcándola
          activa) desde aquí.
        </Callout>
      </ManualCard>

      <ManualCard where="Programas" title="Crear y editar actividades">
        <p>
          Cada programa es una actividad con <strong>horario, cupo, rango de edad, color</strong>{" "}
          y una <strong>terapeuta a cargo</strong>. Asignarla importa: define{" "}
          <strong>qué grupo puede ver y calificar</strong> cada terapeuta.
        </p>
        <p>
          Los <strong>días de clase</strong> (día de la semana y hora de inicio y fin) se
          capturan al editar el programa. Son los que arman el <Chip>Calendario</Chip> del
          equipo: un programa sin días capturados no aparece en él.
        </p>
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
          En <Chip>Equipo</Chip> creas las cuentas del personal, defines su contraseña
          inicial, asignas roles y desactivas accesos cuando alguien deja el equipo.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Terapeuta</strong> — pasa lista, escribe bitácora y califica en los
            programas a su cargo.
          </li>
          <li>
            <strong>Gestora de operaciones</strong> — lleva participantes, programas,
            calendario, donativos, avisos, oficios y reportes. <strong>No califica.</strong>
          </li>
          <li>
            <strong>Coordinador</strong> — coordinación de programas educativos; gestiona y
            califica.
          </li>
          <li>
            <strong>Lector</strong> — ve toda la plataforma y <strong>no modifica nada</strong>.
          </li>
          <li>
            <strong>Directora</strong> — puede hacer todo.
          </li>
        </ul>
      </ManualCard>

      <ManualCard where="Programas · Ciclos" title="Ciclos y oferta">
        <p>
          Desde la barra de ciclos activas el <strong>ciclo vigente</strong> (el único donde se
          puede inscribir) y armas la <strong>oferta de cada ciclo</strong> eligiendo qué
          programas corren en él. El programa sigue siendo uno solo: conserva sus niveles y su
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
          Cuando una familia <strong>inscribe</strong> una actividad desde su espacio, queda
          inscrita al momento —mientras haya lugares, quien llega primero se queda— y aparece
          en tu <Chip>Panel</Chip> con el cupo a la vista. No hay nada que aprobar: es un
          enterado. Si esa inscripción no debía ser, la quitas desde el expediente del
          participante, y con eso la actividad le queda cerrada a la familia.
        </p>
      </ManualCard>
    </section>
  );
}
