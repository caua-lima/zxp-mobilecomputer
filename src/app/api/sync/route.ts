import {
  apagarItem,
  atualizarItem,
  criarItem,
  hashDoItem,
  manifesto,
  normalizarCampos,
  porSlugBruto,
  todosCompletos,
  type Item,
} from "@/lib/itens";
import { tokenSyncConfere } from "@/lib/sessao";
import { bancoConfigurado } from "@/lib/supabase";

/**
 * A porta que o `nuvem push` usa.
 *
 * Autenticação por token no header, não por cookie: é um programa falando com
 * outro, e cookie de sessão de navegador não tem nada a ver com isso. Por isso
 * esta rota também fica fora do matcher do proxy.
 *
 * O contrato é sempre o mesmo: quem manda uma alteração diz em cima de qual
 * versão ela foi feita (`base_hash`). Se a versão no servidor for outra —
 * porque você editou pelo celular — a resposta é "conflito", nunca "sobrescrevi
 * calado". É o mesmo princípio do `git push` recusando quando o remoto andou.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resultado = {
  indice: number;
  slug: string;
  acao: "criado" | "atualizado" | "igual" | "apagado" | "conflito" | "ausente";
  hash?: string;
  atualizado_em?: string;
};

function semAutorizacao() {
  return Response.json({ erro: "Token inválido." }, { status: 401 });
}

function paraJson(item: Item) {
  return {
    slug: item.slug,
    titulo: item.titulo,
    tipo: item.tipo,
    status: item.status,
    tags: item.tags,
    conteudo: item.conteudo,
    hash: item.hash,
    criado_em: item.criado_em,
    atualizado_em: item.atualizado_em,
    apagado_em: item.apagado_em,
  };
}

export async function GET(request: Request) {
  if (!(await tokenSyncConfere(request.headers.get("authorization")))) {
    return semAutorizacao();
  }

  if (!bancoConfigurado()) {
    return Response.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const parametros = new URL(request.url).searchParams;

  // ?completo=1 traz o conteúdo inteiro (é o que o `pull` baixa).
  // Sem ele vem só a lista de slug + hash, que é tudo que o `status` precisa.
  if (parametros.get("completo") === "1") {
    const itens = await todosCompletos();
    return Response.json({ itens: itens.map(paraJson) });
  }

  return Response.json({ itens: await manifesto() });
}

export async function POST(request: Request) {
  if (!(await tokenSyncConfere(request.headers.get("authorization")))) {
    return semAutorizacao();
  }

  if (!bancoConfigurado()) {
    return Response.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const dados = (corpo ?? {}) as Record<string, unknown>;
  const enviados = Array.isArray(dados.itens) ? dados.itens : [];
  const paraApagar = Array.isArray(dados.apagar) ? dados.apagar : [];
  const forcar = dados.forcar === true;

  if (enviados.length + paraApagar.length > 500) {
    return Response.json(
      { erro: "Manda no máximo 500 itens por vez." },
      { status: 413 },
    );
  }

  const resultados: Resultado[] = [];

  for (const [indice, bruto] of enviados.entries()) {
    const entrada = (bruto ?? {}) as Record<string, unknown>;
    const campos = normalizarCampos(entrada);

    if (!campos.titulo) {
      // Sem título o item não existe pro painel. Melhor recusar do que criar
      // um monte de "sem título" que ninguém acha depois.
      resultados.push({
        indice,
        slug: String(entrada.slug ?? ""),
        acao: "ausente",
      });
      continue;
    }

    const slug = typeof entrada.slug === "string" ? entrada.slug : "";
    const baseHash =
      typeof entrada.base_hash === "string" ? entrada.base_hash : "";

    if (!slug) {
      const sugestao =
        typeof entrada.slug_sugerido === "string"
          ? entrada.slug_sugerido
          : campos.titulo;

      const criado = await criarItem(campos, sugestao);
      resultados.push({
        indice,
        slug: criado.slug,
        acao: "criado",
        hash: criado.hash,
        atualizado_em: criado.atualizado_em,
      });
      continue;
    }

    const existente = await porSlugBruto(slug);

    if (!existente) {
      const criado = await criarItem(campos, slug);
      resultados.push({
        indice,
        slug: criado.slug,
        acao: "criado",
        hash: criado.hash,
        atualizado_em: criado.atualizado_em,
      });
      continue;
    }

    const hashNovo = await hashDoItem(campos);

    if (hashNovo === existente.hash && !existente.apagado_em) {
      resultados.push({
        indice,
        slug,
        acao: "igual",
        hash: existente.hash,
        atualizado_em: existente.atualizado_em,
      });
      continue;
    }

    if (!forcar && baseHash && baseHash !== existente.hash) {
      resultados.push({
        indice,
        slug,
        acao: "conflito",
        hash: existente.hash,
        atualizado_em: existente.atualizado_em,
      });
      continue;
    }

    const atualizado = await atualizarItem(slug, campos);
    resultados.push({
      indice,
      slug,
      acao: "atualizado",
      hash: atualizado?.hash ?? hashNovo,
      atualizado_em: atualizado?.atualizado_em,
    });
  }

  for (const [posicao, bruto] of paraApagar.entries()) {
    const entrada = (bruto ?? {}) as Record<string, unknown>;
    const slug = typeof entrada.slug === "string" ? entrada.slug : "";
    const indice = enviados.length + posicao;

    if (!slug) {
      resultados.push({ indice, slug: "", acao: "ausente" });
      continue;
    }

    const existente = await porSlugBruto(slug);

    if (!existente || existente.apagado_em) {
      resultados.push({ indice, slug, acao: "igual" });
      continue;
    }

    const baseHash =
      typeof entrada.base_hash === "string" ? entrada.base_hash : "";

    if (!forcar && baseHash && baseHash !== existente.hash) {
      resultados.push({
        indice,
        slug,
        acao: "conflito",
        hash: existente.hash,
        atualizado_em: existente.atualizado_em,
      });
      continue;
    }

    await apagarItem(slug);
    resultados.push({ indice, slug, acao: "apagado" });
  }

  return Response.json({ ok: true, resultados });
}
