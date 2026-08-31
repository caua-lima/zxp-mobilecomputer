import type { MetadataRoute } from "next";

/** Nuvem particular: nenhum buscador entra. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
