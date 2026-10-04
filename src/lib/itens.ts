/**
 * Tudo que mexe na coleção `itens` do Firestore.
 *
 * O painel e a API de sincronização usam exatamente estas funções, então não
 * existe caminho "do CLI" que grave diferente do caminho "do navegador".
 *
 * O vocabulário (tipos, rótulos, slug, hash) mora em `tipos.ts` e é reexportado
 * aqui — quem já importa daqui não precisa saber da divisão.
 *
 * Duas decisões que moldam este arquivo:
 *
 * 1. O slug é o id do documento. Buscar por slug é uma leitura direta, e a
 *    unicidade é garantida pelo banco: criar um documento que já existe falha,
 *    e a gente tenta o próximo sufixo. Nada de "consultar se está livre e
 *    depois gravar", que deixa uma brecha entre as duas coisas.
 *
 * 2. Filtrar, ordenar e buscar acontece em memória. O Firestore não tem busca
 *    por trecho de texto, e combinar filtro com ordenação exigiria índice
 *    composto — um passo a mais de configuração pra um acervo que cabe, com
 *    folga, na memória de uma função. É também o que permite a busca ignorar
 *    acento. O custo é uma leitura por documento a cada tela; o plano gratuito
 *    dá 50 mil por dia, o que é muito acervo e muita navegação.
 */

import { cache } from "react";

import {
  codigoDoErro,
  colecao,
  ERRO_JA_EXISTE,
  ERRO_NAO_ENCONTRADO,
} from "./firestore";
import { hashDoItem, paraSlug, type Campos, type Item, type Tipo } from "./tipos";

export * from "./tipos";

type Documento = Omit<Item, "id" | "slug">;

function paraItem(id: string, dados: Documento): Item {
  return {
    id,
    slug: id,
    tipo: dados.tipo,
    titulo: dados.titulo,
    conteudo: dados.conteudo ?? "",
    tags: dados.tags ?? [],
    status: dados.status,
    hash: dados.hash,
    criado_em: dados.criado_em,
    atualizado_em: dados.atualizado_em,
    apagado_em: dados.apagado_em ?? null,
  };
}

/**
 * O id de um documento do Firestore não pode ter barra (viraria um caminho),
 * nem ser "." ou "..", nem ter a forma __algo__ (reservada). Slug que não passa
 * nisso simplesmente não existe — e vira slug limpo se for criado.
 */
function slugValido(slug: string) {
  return (
    slug.length > 0 &&
    slug.length <= 200 &&
    !slug.includes("/") &&
    slug !== "." &&
    slug !== ".." &&
    !/^__.*__$/.test(slug)
  );
}

/**
 * Todos os documentos, inclusive apagados, lidos uma vez só por requisição.
 *
 * `cache` do React deduplica dentro de uma mesma renderização: a lista, a
 * contagem por tipo e as tags saem todas desta única leitura, em vez de três.
 */
const todosBrutos = cache(async (): Promise<Item[]> => {
  const resposta = await colecao().get();

  return resposta.docs.map((doc) => paraItem(doc.id, doc.data() as Documento));
});

/** Sem acento e sem caixa: "Reunião" encontra "reuniao" e vice-versa. */
function simplificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type Filtros = {
  busca?: string;
  tipo?: Tipo;
  tag?: string;
  incluirArquivados?: boolean;
};

export async function listar(filtros: Filtros = {}): Promise<Item[]> {
  const termo = filtros.busca ? simplificar(filtros.busca.trim()) : "";

  const itens = (await todosBrutos()).filter((item) => {
    if (item.apagado_em) return false;
    if (filtros.tipo && item.tipo !== filtros.tipo) return false;
    if (!filtros.incluirArquivados && item.status === "arquivado") return false;
    if (filtros.tag && !item.tags.includes(filtros.tag)) return false;

    if (termo) {
      const palheiro = simplificar(`${item.titulo}\n${item.conteudo}`);
      if (!palheiro.includes(termo)) return false;
    }

    return true;
  });

  return itens
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
    .slice(0, 500);
}

export async function porSlug(slug: string): Promise<Item | null> {
  const item = await porSlugBruto(slug);
  return item && !item.apagado_em ? item : null;
}

/**
 * Como `porSlug`, mas enxerga item apagado.
 *
 * A sincronização precisa disso: pro CLI, um item apagado não é a mesma coisa
 * que um item que nunca existiu — um manda remover o arquivo local, o outro
 * manda criar um item novo no servidor.
 */
export async function porSlugBruto(slug: string): Promise<Item | null> {
  if (!slugValido(slug)) return null;

  const documento = await colecao().doc(slug).get();
  if (!documento.exists) return null;

  return paraItem(documento.id, documento.data() as Documento);
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
 */
export async function resumoDoAcervo(): Promise<ResumoDoAcervo> {
  const porTipo = { projeto: 0, ideia: 0, nota: 0, referencia: 0 };
  const contagem = new Map<string, number>();
  let arquivados = 0;

  for (const item of await todosBrutos()) {
    if (item.apagado_em) continue;

    if (item.status === "arquivado") {
      arquivados++;
      continue;
    }

    porTipo[item.tipo] = (porTipo[item.tipo] ?? 0) + 1;

    for (const tag of item.tags) {
      contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...contagem.entries()]
    .map(([tag, total]) => ({ tag, total }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));

  return { tags, porTipo, arquivados };
}

/**
 * Cria o item no primeiro slug livre: `raiz`, `raiz-2`, `raiz-3`...
 *
 * `create()` falha se o documento já existe, e essa falha é a verificação —
 * atômica, sem brecha entre "ver se está livre" e "gravar". Dois salvamentos
 * simultâneos com o mesmo título não conseguem pegar o mesmo slug.
 */
export async function criarItem(
  campos: Campos,
  slugDesejado?: string,
): Promise<Item> {
  const raiz = paraSlug(slugDesejado || campos.titulo);
  const agora = new Date().toISOString();

  const documento: Documento = {
    ...campos,
    hash: await hashDoItem(campos),
    criado_em: agora,
    atualizado_em: agora,
    apagado_em: null,
  };

  for (let n = 1; n < 500; n++) {
    const slug = n === 1 ? raiz : `${raiz}-${n}`;

    try {
      await colecao().doc(slug).create(documento);
      return paraItem(slug, documento);
    } catch (erro) {
      if (codigoDoErro(erro) !== ERRO_JA_EXISTE) throw erro;
    }
  }

  // Quinhentas colisões é um acervo que não existe; o carimbo de tempo garante
  // que mesmo assim nada se perde.
  const slug = `${raiz}-${Date.now()}`;
  await colecao().doc(slug).create(documento);

  return paraItem(slug, documento);
}

export async function atualizarItem(
  slug: string,
  campos: Campos,
): Promise<{ hash: string; atualizado_em: string } | undefined> {
  if (!slugValido(slug)) return undefined;

  const alteracao = {
    ...campos,
    hash: await hashDoItem(campos),
    atualizado_em: new Date().toISOString(),
    // Salvar por cima de um item apagado é o jeito natural de restaurar.
    apagado_em: null,
  };

  try {
    await colecao().doc(slug).update(alteracao);
  } catch (erro) {
    // update() não cria: se o documento não existe, é "não achei", não falha.
    if (codigoDoErro(erro) === ERRO_NAO_ENCONTRADO) return undefined;
    throw erro;
  }

  return { hash: alteracao.hash, atualizado_em: alteracao.atualizado_em };
}

/**
 * Apagar é marcar a data. O item some do painel na hora e o `nuvem pull`
 * consegue avisar o computador que o arquivo local também deve sumir.
 */
export async function apagarItem(slug: string): Promise<void> {
  if (!slugValido(slug)) return;

  const agora = new Date().toISOString();

  try {
    await colecao().doc(slug).update({ apagado_em: agora, atualizado_em: agora });
  } catch (erro) {
    // Apagar o que já não existe termina no mesmo lugar: não existe.
    if (codigoDoErro(erro) !== ERRO_NAO_ENCONTRADO) throw erro;
  }
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
  return (await todosBrutos())
    .map(({ slug, hash, titulo, tipo, atualizado_em, apagado_em }) => ({
      slug,
      hash,
      titulo,
      tipo,
      atualizado_em,
      apagado_em,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Tudo, inclusive apagados: é o que o `nuvem pull` precisa pra espelhar. */
export async function todosCompletos(): Promise<Item[]> {
  return [...(await todosBrutos())].sort((a, b) => a.slug.localeCompare(b.slug));
}
