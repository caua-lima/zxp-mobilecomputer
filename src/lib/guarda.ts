/**
 * Porteiro das páginas e das ações do servidor.
 *
 * O proxy já barra quem não tem cookie, mas ele é só a primeira porta: Server
 * Actions podem ser chamadas por um POST direto, sem passar pela navegação.
 * Por isso toda página e toda ação confere de novo, aqui.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NOME_COOKIE, sessaoValida } from "./sessao";

export async function temSessao() {
  const cookiesDaRequisicao = await cookies();
  return sessaoValida(cookiesDaRequisicao.get(NOME_COOKIE)?.value);
}

/** Usa no topo de toda página e ação privada. Quem não tem sessão vai pro login. */
export async function exigirSessao() {
  if (!(await temSessao())) redirect("/entrar");
}
