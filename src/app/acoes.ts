"use server";

/**
 * Ações do painel: entrar, sair, salvar e apagar.
 *
 * Toda função aqui pode ser chamada por um POST direto, sem passar pela tela —
 * é assim que Server Actions funcionam. Por isso cada uma confere a sessão de
 * novo antes de tocar no banco.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { exigirSessao } from "@/lib/guarda";
import type { EstadoForm } from "@/lib/formulario";
import { bloqueado, limparFalhas, registrarFalha } from "@/lib/limite";
import {
  apagarItem,
  atualizarItem,
  criarItem,
  normalizarCampos,
  porSlug,
} from "@/lib/itens";
import {
  acessoConfigurado,
  criarSessao,
  DURACAO_SESSAO,
  NOME_COOKIE,
  senhaConfere,
} from "@/lib/sessao";

async function identificacao() {
  const cabecalhos = await headers();
  return cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Só aceita caminho interno: bloqueia virar redirecionamento pra fora. */
function destinoSeguro(valor: FormDataEntryValue | null) {
  const destino = typeof valor === "string" ? valor : "";
  return /^\/(?!\/)/.test(destino) ? destino : "/";
}

export async function entrar(
  _anterior: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  if (!acessoConfigurado()) {
    return { erro: "Falta configurar SENHA e SESSAO_SEGREDO no servidor." };
  }

  const quem = await identificacao();
  if (bloqueado(quem)) {
    return { erro: "Muitas tentativas. Espera uns minutos e tenta de novo." };
  }

  const senha = String(dados.get("senha") ?? "");

  if (!(await senhaConfere(senha))) {
    registrarFalha(quem);
    return { erro: "Senha errada." };
  }

  limparFalhas(quem);

  const cookiesDaResposta = await cookies();
  cookiesDaResposta.set(NOME_COOKIE, await criarSessao(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO,
  });

  redirect(destinoSeguro(dados.get("destino")));
}

export async function sair() {
  const cookiesDaResposta = await cookies();
  cookiesDaResposta.delete(NOME_COOKIE);
  redirect("/entrar");
}

export async function salvarItem(
  _anterior: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  await exigirSessao();

  const campos = normalizarCampos({
    titulo: dados.get("titulo"),
    tipo: dados.get("tipo"),
    status: dados.get("status"),
    tags: dados.get("tags"),
    conteudo: dados.get("conteudo"),
  });

  if (!campos.titulo) {
    return { erro: "Dá um título — é por ele que você vai achar isso depois." };
  }

  const slug = String(dados.get("slug") ?? "");

  if (!slug) {
    const criado = await criarItem(campos);
    revalidatePath("/");
    redirect(`/item/${criado.slug}`);
  }

  const existente = await porSlug(slug);
  if (!existente) return { erro: "Esse item não existe mais." };

  await atualizarItem(slug, campos);

  revalidatePath("/");
  revalidatePath(`/item/${slug}`);

  return { salvoEm: Date.now() };
}

export async function apagar(dados: FormData) {
  await exigirSessao();

  const slug = String(dados.get("slug") ?? "");
  if (slug) await apagarItem(slug);

  revalidatePath("/");
  redirect("/");
}
