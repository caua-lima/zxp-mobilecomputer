import { ImageResponse } from "next/og";

import { comoDataUri, svgIconeMascaravel } from "@/lib/marca";

export const dynamic = "force-static";

// Ícone 512×512 "maskable" do PWA: o Android recorta no formato do aparelho.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={comoDataUri(svgIconeMascaravel())} alt="" width={512} height={512} />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
