import type { MetadataRoute } from "next";

/** Deixa o ZXP Mobile Computer instalável na tela de início, sem barra de navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZXP Mobile Computer",
    short_name: "ZXP Mobile",
    description:
      "Seus projetos, ideias e notas — de qualquer lugar. Um produto ZXP Solutions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#10100E",
    theme_color: "#10100E",
    lang: "pt-BR",
    icons: [
      { src: "/manifest-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icon-512", sizes: "512x512", type: "image/png" },
      {
        src: "/manifest-icon-mascaravel",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
