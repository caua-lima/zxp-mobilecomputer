/**
 * Tudo que mexe na tabela `itens`.
 *
 * O painel e a API de sincronização usam exatamente estas funções, então não
 * existe caminho "do CLI" que grave diferente do caminho "do navegador".
 *
 * O vocabulário (tipos, rótulos, slug, hash) mora em `tipos.ts` e é reexportado
 * aqui — quem já importa daqui não precisa saber da divisão.
 */

import {
  atualizarLinha,
  inserir,
  rest,
  selecionar,
  valorSeguro,
} from "./supabase";
import { hashDoItem, paraSlug, type Campos, type Item, type Tipo } from "./tipos";

export * from "./tipos";

const COLUNAS =
  "id,slug,tipo,titulo,conteudo,tags,status,hash,criado_em,atualizado_em,apagado_em";

/** Acrescenta -2, -3... até achar um slug livre. */
export async function slugLivre(base: string, ignorar?: string) {
  const raiz = paraSlug(base);
  const parecidos = await selecionar<{ slug: string }>(
    `itens?select=slug&slug=like.${encodeURIComponent(`${raiz}*`)}`,
  );

  const ocupados = new Set(
    parecidos.map((linha) => linha.slug).filter((slug) => slug !== ignorar),
  );

  if (!ocupados.has(raiz)) return raiz;

  for (let n = 2; n < 500; n++) {
    if (!ocupados.has(`${raiz}-${n}`)) return `${raiz}-${n}`;
  }

  return `${raiz}-${Date.now()}`;
}

export type Filtros = {
  busca?: string;
  tipo?: Tipo;
  tag?: string;
  incluirArquivados?: boolean;
};

export async function listar(filtros: Filtros = {}): Promise<Item[]> {
  const partes = [
    `select=${COLUNAS}`,
    "apagado_em=is.null",
    "order=atualizado_em.desc",
    "limit=500",
  ];

  if (filtros.tipo) partes.push(`tipo=eq.${filtros.tipo}`);
  if (!filtros.incluirArquivados) partes.push("status=neq.arquivado");

  if (filtros.tag) {
    const tag = valorSeguro(filtros.tag);
    partes.push(`tags=cs.${encodeURIComponent(`{${tag}}`)}`);
  }

  if (filtros.busca) {
    // Fora vírgula, parêntese, aspas e curingas: eles fazem parte da sintaxe de
    // filtro do PostgREST e virariam outro filtro em vez de texto procurado.
    const termo = filtros.busca.replace(/[,()"*%\\]/g, " ").trim();

    if (termo) {
      const alvo = encodeURIComponent(`*${termo}*`);
      partes.push(`or=(titulo.ilike.${alvo},conteudo.ilike.${alvo})`);
    }
  }

  return selecionar<Item>(`itens?${partes.join("&")}`);
}

export async function porSlug(slug: string): Promise<Item | null> {
  const [item] = await selecionar<Item>(
    `itens?select=${COLUNAS}&slug=eq.${encodeURIComponent(slug)}&apagado_em=is.null&limit=1`,
  );

  return item ?? null;
}

/**
 * Como `porSlug`, mas enxerga item apagado.
 *
 * A sincronização precisa disso: pro CLI, um item apagado não é a mesma coisa
 * que um item que nunca existiu — um manda remover o arquivo local, o outro
 * manda criar um item novo no servidor.
 */
export async function porSlugBruto(slug: string): Promise<Item | null> {
  const [item] = await selecionar<Item>(
    `itens?select=${COLUNAS}&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );

  return item ?? null;
}

export type ResumoDoAcervo = {
  tags: { tag: string; total: number }[];
  porTipo: Record<Tipo, number>;
  arquivados: number;
};

/**
 * O que o painel precisa saber sobre o acervo inteiro, e não só sobre a lista
 * filtrada: quantos itens tem cada tipo, quais tags existem e quantos itens
 * estão arquivados.
 *
 * Uma consulta só, trazendo três colunas curtas. Contar no Postgres exigiria
 * três `count` separados ou uma view — e a diferença, num acervo pessoal, é
 * invisível.
 */
export async function resumoDoAcervo(): Promise<ResumoDoAcervo> {
  const linhas = await selecionar<{ tipo: Tipo; tags: string[]; status: string }>(
    "itens?select=tipo,tags,status&apagado_em=is.null&limit=2000",
  );

  const porTipo = { projeto: 0, ideia: 0, nota: 0, referencia: 0 };
  const contagem = new Map<string, number>();
  let arquivados = 0;

  for (const linha of linhas) {
    if (linha.status === "arquivado") {
      arquivados++;
      continue;
    }

    porTipo[linha.tipo] = (porTipo[linha.tipo] ?? 0) + 1;

    for (const tag of linha.tags ?? []) {
      contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...contagem.entries()]
    .map(([tag, total]) => ({ tag, total }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));

  return { tags, porTipo, arquivados };
}

export async function criarItem(
  campos: Campos,
  slugDesejado?: string,
): Promise<Item> {
  const slug = await slugLivre(slugDesejado || campos.titulo);
  const agora = new Date().toISOString();

  return inserir<Item>("itens", {
    slug,
    ...campos,
    hash: await hashDoItem(campos),
    criado_em: agora,
    atualizado_em: agora,
  });
}

export async function atualizarItem(
  slug: string,
  campos: Campos,
): Promise<Item | undefined> {
  return atualizarLinha<Item>("itens", `slug=eq.${encodeURIComponent(slug)}`, {
    ...campos,
    hash: await hashDoItem(campos),
    atualizado_em: new Date().toISOString(),
    // Salvar por cima de um item apagado é o jeito natural de restaurar.
    apagado_em: null,
  });
}

/**
 * Apagar é marcar a data. O item some do painel na hora e o `nuvem pull`
 * consegue avisar o computador que o arquivo local também deve sumir.
 */
export async function apagarItem(slug: string): Promise<void> {
  const agora = new Date().toISOString();

  await rest(`itens?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ apagado_em: agora, atualizado_em: agora }),
  });
}

export type LinhaManifesto = {
  slug: string;
  hash: string;
  titulo: string;
  tipo: Tipo;
  atualizado_em: string;
  apagado_em: string | null;
};

/** A lista leve que o CLI baixa pra comparar sem trazer o conteúdo inteiro. */
export async function manifesto(): Promise<LinhaManifesto[]> {
  return selecionar<LinhaManifesto>(
    "itens?select=slug,hash,titulo,tipo,atualizado_em,apagado_em&order=slug.asc&limit=2000",
  );
}

/** Tudo, inclusive apagados: é o que o `nuvem pull` precisa pra espelhar. */
export async function todosCompletos(): Promise<Item[]> {
  return selecionar<Item>(`itens?select=${COLUNAS}&order=slug.asc&limit=2000`);
}
