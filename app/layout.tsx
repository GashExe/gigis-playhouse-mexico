import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
