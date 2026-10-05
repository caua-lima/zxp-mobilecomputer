import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";

import "./globals.css";

// Mesmas duas fontes da família ZXP: Sora nos títulos e na marca, Inter no corpo.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  // O nome do produto vem primeiro: na aba do navegador, o que sobra de espaço
  // é o fim do título — melhor cortar o nome da página do que o da marca.
  title: {
    default: "ZXP Mobile Computer",
    template: "ZXP Mobile Computer · %s",
  },
  description:
    "Seus projetos, ideias e notas — de qualquer lugar. Um produto ZXP Solutions.",
  manifest: "/manifest.webmanifest",
  applicationName: "ZXP Mobile Computer",
  // Dá pra instalar na tela de início do celular e abrir sem barra de navegador.
  appleWebApp: {
    capable: true,
    title: "ZXP Mobile",
    statusBarStyle: "black-translucent",
  },
  // Isto é pessoal: nenhum buscador tem o que fazer aqui.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#10100E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-dvh bg-fundo font-sans text-texto antialiased">
        {children}
      </body>
    </html>
  );
}
