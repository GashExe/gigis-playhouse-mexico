/**
 * Texto que escribe el equipo con **negritas** al estilo de WhatsApp/Markdown.
 * Solo eso: lo que va entre dobles asteriscos sale en negrita y lo demás queda
 * tal cual. Un par sin cerrar se deja con sus asteriscos para no tragarse texto.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*([\s\S]+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        // split con un grupo intercala: pares = texto suelto, nones = lo de adentro.
        i % 2 === 1 ? (
          <strong key={i} className="font-bold text-ink">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
