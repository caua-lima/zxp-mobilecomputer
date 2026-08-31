import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nuvem", template: "%s · Nuvem" },
  description: "Seus projetos, ideias e notas — de qualquer lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "Nuvem",
  // Dá pra instalar na tela de início do celular e abrir sem barra de navegador.
  appleWebApp: { capable: true, title: "Nuvem", statusBarStyle: "black-translucent" },
  // Isto é pessoal: nenhum buscador tem o que fazer aqui.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-fundo text-texto antialiased">
        {children}
      </body>
    </html>
  );
}
