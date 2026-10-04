/**
 * O vocabulário da Nuvem: o que é um item, quais tipos existem, como o título
 * vira slug e como se calcula a impressão digital.
 *
 * Nada aqui toca no banco, e é por isso que este arquivo existe separado de
 * `itens.ts`: o editor roda no navegador e precisa dos rótulos e dos tipos —
 * mas o módulo que carrega a chave do Firebase não tem o que fazer lá.
 */

export const tipos = ["projeto", "ideia", "nota", "referencia"] as const;
export type Tipo = (typeof tipos)[number];

export const situacoes = ["ativo", "pausado", "feito", "arquivado"] as const;
export type Situacao = (typeof situacoes)[number];

export const rotuloTipo: Record<Tipo, string> = {
  projeto: "Projeto",
  ideia: "Ideia",
  nota: "Nota",
  referencia: "Referência",
};

/** Pasta que o CLI usa pro tipo. Muda o tipo, o arquivo local muda de lugar. */
export const pastaTipo: Record<Tipo, string> = {
  projeto: "projetos",
  ideia: "ideias",
  nota: "notas",
  referencia: "referencias",
};

export const rotuloSituacao: Record<Situacao, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  feito: "Feito",
  arquivado: "Arquivado",
};

export type Item = {
  id: string;
  slug: string;
  tipo: Tipo;
  titulo: string;
  conteudo: string;
  tags: string[];
  status: Situacao;
  hash: string;
  criado_em: string;
  atualizado_em: string;
  apagado_em: string | null;
};

/** O que você edita. O resto (id, hash, datas) é responsabilidade do servidor. */
export type Campos = {
  titulo: string;
  tipo: Tipo;
  status: Situacao;
  tags: string[];
  conteudo: string;
};

/**
 * Impressão digital do item.
 *
 * Entra tudo que dá pra editar — mudar só uma tag também é uma mudança. Fica
 * fora o que o servidor controla (datas, id), senão o hash mudaria sozinho e
 * toda sincronização acusaria conflito.
 */
export async function hashDoItem(campos: Campos): Promise<string> {
  const base = [
    campos.titulo,
    campos.tipo,
    campos.status,
    [...campos.tags].sort().join("\u0001"),
    campos.conteudo.replace(/\r\n/g, "\n"),
  ].join("\u0000");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(base),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** "Ideia de Landing Page: RUMO" vira "ideia-de-landing-page-rumo". */
export function paraSlug(texto: string): string {
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return limpo || "item";
}

export function normalizarTags(entrada: string | string[]): string[] {
  const bruto = Array.isArray(entrada) ? entrada : entrada.split(",");

  const limpas = bruto
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 40);

  return [...new Set(limpas)].slice(0, 20);
}

export function ehTipo(valor: unknown): valor is Tipo {
  return (
    typeof valor === "string" && (tipos as readonly string[]).includes(valor)
  );
}

export function ehSituacao(valor: unknown): valor is Situacao {
  return (
    typeof valor === "string" && (situacoes as readonly string[]).includes(valor)
  );
}

/**
 * Aceita um objeto vindo da rede (formulário ou CLI) e devolve Campos com tipo
 * garantido. Nada aqui confia no formato: campo ausente vira o padrão.
 */
export function normalizarCampos(entrada: unknown): Campos {
  const bruto = (entrada ?? {}) as Record<string, unknown>;
  const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");

  const tags =
    Array.isArray(bruto.tags) || typeof bruto.tags === "string"
      ? normalizarTags(bruto.tags as string | string[])
      : [];

  return {
    titulo: texto(bruto.titulo).trim().slice(0, 200),
    tipo: ehTipo(bruto.tipo) ? bruto.tipo : "nota",
    status: ehSituacao(bruto.status) ? bruto.status : "ativo",
    tags,
    conteudo: texto(bruto.conteudo).replace(/\r\n/g, "\n"),
  };
}
