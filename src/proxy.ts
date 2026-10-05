import { NextResponse, type NextRequest } from "next/server";

import { NOME_COOKIE, sessaoValida } from "@/lib/sessao";

/**
 * A porta da rua: sem cookie válido, ninguém vê nem o nome de um item.
 *
 * (No Next 16 isto se chama `proxy` — é o antigo `middleware`, mesma coisa.)
 *
 * Aqui é uma checagem otimista, como manda a documentação: quem decide de
 * verdade é cada página e cada ação, via `exigirSessao()`. Isto existe pra
 * mandar você direto pro login em vez de deixar a tela piscar conteúdo.
 *
 * O /api/sync fica de fora do matcher: ele não usa cookie, usa o token do CLI.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const autenticado = await sessaoValida(
    request.cookies.get(NOME_COOKIE)?.value,
  );

  if (pathname === "/entrar") {
    if (!autenticado) return NextResponse.next();
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (autenticado) return NextResponse.next();

  const login = new URL("/entrar", request.url);
  // Guarda onde a pessoa queria chegar pra voltar pra lá depois de entrar.
  if (pathname !== "/") login.searchParams.set("destino", pathname + search);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!api/sync|_next/|icon|apple-icon|manifest|robots.txt|favicon.ico).*)",
  ],
};
