import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gigi's Playhouse México · Plataforma",
    template: "%s · Gigi's Playhouse México",
  },
  description:
    "Plataforma de registro y seguimiento de participantes, programas y evaluaciones de Gigi's Playhouse México.",
};

export const viewport: Viewport = {
  // `cover` permite que el contenido use toda la pantalla y expone las
  // safe-areas (notch arriba, barra de gestos abajo) vía env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1b2027" },
  ],
};

// Estampa data-theme ANTES del primer pintado: la elección guardada ("tema" en
// localStorage) o, si no hay, la preferencia del sistema. Si el usuario no ha
// elegido, sigue en vivo los cambios de tema del sistema.
const THEME_INIT = `(function () {
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var guardado = localStorage.getItem("tema");
    var tema = guardado === "dark" || guardado === "light" ? guardado : mq.matches ? "dark" : "light";
    document.documentElement.dataset.theme = tema;
    mq.addEventListener("change", function (e) {
      if (!localStorage.getItem("tema")) {
        document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      }
    });
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} h-full antialiased`}
      // El script de tema modifica <html> antes de que React hidrate.
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script
          id="tema-inicial"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
        {children}
      </body>
    </html>
  );
}
