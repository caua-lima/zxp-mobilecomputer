import { MARCA_DOURADO, MARCA_ONYX, TRACO_PONTOS } from "@/lib/marca";

/**
 * O logomark oficial da ZXP Solutions: o "Z" de traço dourado num contêiner
 * onyx. Mesma construção e mesmas coordenadas dos outros apps da família —
 * não reescalar nem redesenhar.
 */
export function ZxpMark({
  size = 28,
  radius = 24,
}: {
  size?: number;
  radius?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ flexShrink: 0, display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="200" height="200" rx={radius * 2} fill={MARCA_ONYX} />
      <polyline
        points={TRACO_PONTOS}
        fill="none"
        stroke={MARCA_DOURADO}
        strokeWidth="34"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  );
}

/**
 * Marca + nome, na altura do cabeçalho. "ZXP" no dourado e o resto em marfim
 * espaçado, como "ZXP / SOLUTIONS" no logo horizontal da empresa.
 */
export function MarcaHorizontal() {
  return (
    <span className="flex items-center gap-2.5">
      <ZxpMark size={30} />

      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-tight text-destaque">
          ZXP
        </span>
        <span className="font-display mt-[3px] text-[8.5px] font-medium tracking-[0.2em] text-marfim uppercase">
          Mobile Computer
        </span>
      </span>
    </span>
  );
}

/** Versão de capa, pra tela de entrada. */
export function MarcaEmpilhada() {
  return (
    <div className="flex flex-col items-center text-center">
      <ZxpMark size={72} radius={24} />

      <h1 className="font-display mt-5 text-[28px] leading-none font-extrabold tracking-tight text-destaque">
        ZXP
      </h1>
      <p className="font-display mt-2 text-sm font-medium tracking-[0.22em] text-marfim uppercase">
        Mobile Computer
      </p>
      <p className="mt-4 text-xs text-fraco">Um produto ZXP Solutions</p>
    </div>
  );
}
