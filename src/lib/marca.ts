/**
 * Marca oficial da ZXP Solutions, como SVG inline.
 *
 * Mesma construção dos outros apps da família (ZXP Tasks, Finance, Market): o
 * "Z" é uma POLILINHA de traço grosso e canto reto — não um polígono
 * preenchido —, num contêiner onyx. A geometria não se mexe; o que distingue
 * cada app é a cor do traço. Aqui é o dourado da ZXP Solutions.
 *
 * Existe como string porque os ícones (favicon, PWA, Apple) são gerados em
 * runtime com ImageResponse, e a forma confiável de desenhar SVG ali é embutir
 * como `data:` URI numa <img>: o gerador tem suporte limitado a `stroke` em
 * elementos SVG soltos, e um traço que não renderiza daria um ícone em branco
 * sem erro nenhum.
 */

export const MARCA_ONYX = "#10100E";
export const MARCA_DOURADO = "#F4B942";
export const MARCA_MARFIM = "#F6F3E8";

/** Traço do "Z" — idêntico ao arquivo de marca, sem reescalar. */
export const TRACO_PONTOS = "30,47 170,47 30,153 170,153";

const TRACO = `points="${TRACO_PONTOS}" fill="none" stroke-width="34" stroke-linejoin="miter" stroke-linecap="butt"`;

/** Ícone do app: fundo onyx, Z dourado, cantos arredondados. */
export function svgAppIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="${MARCA_ONYX}"/><g transform="translate(24,24) scale(0.76)"><polyline ${TRACO} stroke="${MARCA_DOURADO}"/></g></svg>`;
}

/**
 * Ícone "maskable" do PWA: sem cantos arredondados (o Android recorta no
 * formato que o aparelho quiser) e com o Z menor, dentro da zona segura — o
 * recorte circular come as bordas, e um Z encostado nelas ficaria cortado.
 */
export function svgIconeMascaravel(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${MARCA_ONYX}"/><g transform="translate(32,32) scale(0.68)"><polyline ${TRACO} stroke="${MARCA_DOURADO}"/></g></svg>`;
}

/** Favicon: mesma construção do ícone do app, com cantos mais fechados. */
export function svgFavicon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="26" fill="${MARCA_ONYX}"/><polyline ${TRACO} stroke="${MARCA_DOURADO}"/></svg>`;
}

/** Data URI pronto pra usar em <img src=...> dentro do ImageResponse. */
export function comoDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
