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

/**
 * O que a pessoa vê quando o banco não responde.
 *
 * Nunca deixar a exceção subir é a regra aqui: se ela subir, o Next troca a
 * página inteira pela tela de erro — e leva junto o texto que você acabou de
 * escrever e ainda não foi gravado. Errar salvando é aceitável; errar perdendo
 * o que a pessoa escreveu, não.
 */
const falhaDeGravacao =
  "Não consegui salvar agora. Seu texto continua aqui — tenta de novo em instantes.";

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
    let novoSlug: string;

    try {
      novoSlug = (await criarItem(campos)).slug;
    } catch (erro) {
      console.error("[salvar] falha ao criar:", erro);
      return { erro: falhaDeGravacao, falhouEm: Date.now() };
    }

    revalidatePath("/");
    // Fora do try de propósito: redirect() funciona lançando uma exceção que o
    // Next entende. Dentro, o catch engoliria a navegação.
    redirect(`/item/${novoSlug}`);
  }

  try {
    const existente = await porSlug(slug);
    if (!existente) return { erro: "Esse item não existe mais." };

    await atualizarItem(slug, campos);
  } catch (erro) {
    console.error("[salvar] falha ao atualizar:", erro);
    return { erro: falhaDeGravacao, falhouEm: Date.now() };
  }

  revalidatePath("/");
  revalidatePath(`/item/${slug}`);

  return { salvoEm: Date.now() };
}

/**
 * Captura rápida: só o título, direto da lista.
 *
 * Existe porque anotar e organizar são momentos diferentes. Na rua você tem
 * cinco segundos e uma frase; escolher tipo, tag e escrever o corpo é coisa
 * pra depois — e "depois" só acontece se a frase tiver sido salva agora.
 */
export async function capturar(
  _anterior: EstadoForm,
  dados: FormData,
): Promise<EstadoForm> {
  await exigirSessao();

  const campos = normalizarCampos({
    titulo: dados.get("titulo"),
    tipo: dados.get("tipo"),
    status: "ativo",
    tags: dados.get("tag") ?? "",
    conteudo: "",
  });

  if (!campos.titulo) return {};

  try {
    const criado = await criarItem(campos);
    revalidatePath("/");

    return { salvoEm: Date.now(), slug: criado.slug, titulo: criado.titulo };
  } catch (erro) {
    console.error("[capturar] falha ao criar:", erro);
    return { erro: falhaDeGravacao, falhouEm: Date.now() };
  }
}

export async function apagar(dados: FormData) {
  await exigirSessao();

  const slug = String(dados.get("slug") ?? "");

  if (slug) {
    try {
      await apagarItem(slug);
    } catch (erro) {
      console.error("[apagar] falha:", erro);
      // Sem redirect: a tela do item continua onde está, com o texto intacto.
      return;
    }
  }

  revalidatePath("/");
  redirect("/");
}
