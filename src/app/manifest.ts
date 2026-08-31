import type { MetadataRoute } from "next";

/** Deixa a Nuvem instalável na tela de início do celular, sem barra de navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nuvem",
    short_name: "Nuvem",
    description: "Seus projetos, ideias e notas — de qualquer lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    lang: "pt-BR",
    icons: [
      { src: "/icone.svg", sizes: "any", type: "image/svg+xml" },
      {
        src: "/icone.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
