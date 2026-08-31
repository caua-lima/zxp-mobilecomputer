/**
 * Acesso ao Supabase pela API REST, sem SDK.
 *
 * O PostgREST é só HTTP: um GET com filtros na query string, um POST com JSON.
 * Manter assim deixa o projeto em três dependências (next, react, react-dom) e
 * o cold start da função curto — que é o que importa quando você abre isto no
 * celular na fila do mercado.
 */

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class ErroSupabase extends Error {
  constructor(
    readonly status: number,
    readonly detalhe: string,
  ) {
    super(`Supabase respondeu ${status}: ${detalhe}`);
    this.name = "ErroSupabase";
  }
}

export function bancoConfigurado() {
  return Boolean(URL_BASE && CHAVE);
}

/** Uma chamada crua ao PostgREST. `caminho` já vem com a query string pronta. */
export async function rest(
  caminho: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!URL_BASE || !CHAVE) {
    throw new ErroSupabase(
      500,
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.",
    );
  }

  const resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: CHAVE,
      Authorization: `Bearer ${CHAVE}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    // Nada aqui pode vir de cache: é o seu dado, editado agora, em outro aparelho.
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new ErroSupabase(resposta.status, await resposta.text());
  }

  return resposta;
}

export async function selecionar<T>(caminho: string): Promise<T[]> {
  const resposta = await rest(caminho, { method: "GET" });
  return (await resposta.json()) as T[];
}

/** POST que devolve a linha criada. */
export async function inserir<T>(
  tabela: string,
  linha: Record<string, unknown>,
): Promise<T> {
  const resposta = await rest(tabela, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(linha),
  });

  const [criada] = (await resposta.json()) as T[];
  return criada;
}

/** PATCH filtrado que devolve a linha alterada (ou undefined se nada bateu). */
export async function atualizarLinha<T>(
  tabela: string,
  filtro: string,
  campos: Record<string, unknown>,
): Promise<T | undefined> {
  const resposta = await rest(`${tabela}?${filtro}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(campos),
  });

  const [alterada] = (await resposta.json()) as T[];
  return alterada;
}

/**
 * Escapa um valor pra usar dentro de filtros do PostgREST.
 *
 * Vírgula, parêntese e asterisco têm significado na sintaxe de filtro — um
 * título com vírgula viraria dois filtros. Aspas resolvem, e a barra invertida
 * escapa aspas dentro do valor.
 */
export function valorSeguro(texto: string) {
  return `"${texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
