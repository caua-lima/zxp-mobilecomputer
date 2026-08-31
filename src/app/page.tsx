import Link from "next/link";

import { sair } from "./acoes";
import { Busca } from "@/components/Busca";
import { CapturaRapida } from "@/components/CapturaRapida";
import { CartaoItem } from "@/components/CartaoItem";
import { exigirSessao } from "@/lib/guarda";
import {
  ehTipo,
  listar,
  resumoDoAcervo,
  rotuloTipo,
  tipos,
  type Item,
  type ResumoDoAcervo,
} from "@/lib/itens";
import { bancoConfigurado } from "@/lib/supabase";

const acervoVazio: ResumoDoAcervo = {
  tags: [],
  porTipo: { projeto: 0, ideia: 0, nota: 0, referencia: 0 },
  arquivados: 0,
};

function texto(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : "";
}

export default async function Painel(props: PageProps<"/">) {
  await exigirSessao();

  const parametros = await props.searchParams;
  const busca = texto(parametros.q).trim();
  const tipoBruto = texto(parametros.tipo);
  const tipo = ehTipo(tipoBruto) ? tipoBruto : undefined;
  const tag = texto(parametros.tag);
  const arquivados = texto(parametros.arquivados) === "1";

  let itens: Item[] = [];
  let acervo = acervoVazio;
  let falha = "";

  if (bancoConfigurado()) {
    try {
      [itens, acervo] = await Promise.all([
        listar({ busca, tipo, tag, incluirArquivados: arquivados }),
        resumoDoAcervo(),
      ]);
    } catch (erro) {
      console.error("[painel] falha ao listar:", erro);
      falha =
        "Não consegui falar com o banco. Confere as variáveis do Supabase e se a tabela `itens` já foi criada.";
    }
  }

  const totalNoAcervo = Object.values(acervo.porTipo).reduce((a, b) => a + b, 0);
  const filtrando = Boolean(busca || tipo || tag);

  /** Monta um link mantendo os filtros que já estão ligados. */
  function comFiltro(mudanca: Record<string, string | undefined>) {
    const atual: Record<string, string> = {};
    if (busca) atual.q = busca;
    if (tipo) atual.tipo = tipo;
    if (tag) atual.tag = tag;
    if (arquivados) atual.arquivados = "1";

    const final = { ...atual, ...mudanca };
    const query = new URLSearchParams(
      Object.entries(final).filter(([, valor]) => Boolean(valor)) as [
        string,
        string,
      ][],
    ).toString();

    return query ? `/?${query}` : "/";
  }

  // Os filtros que não são a busca, prontos pra barra de busca remontar a URL.
  const outrosFiltros = new URLSearchParams();
  if (tipo) outrosFiltros.set("tipo", tipo);
  if (tag) outrosFiltros.set("tag", tag);
  if (arquivados) outrosFiltros.set("arquivados", "1");

  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      ativo
        ? "border-destaque bg-destaque/10 text-destaque"
        : "border-borda text-suave hover:border-suave hover:text-texto"
    }`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-borda bg-fundo/85 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Nuvem
        </Link>

        <span className="text-xs text-suave">
          {filtrando
            ? `${itens.length} de ${totalNoAcervo}`
            : `${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <form action={sair}>
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-sm text-suave transition-colors hover:text-texto"
            >
              Sair
            </button>
          </form>

          <Link
            href={tipo ? `/novo?tipo=${tipo}` : "/novo"}
            className="rounded-lg bg-destaque px-3 py-1.5 text-sm font-semibold text-fundo transition-opacity hover:opacity-90"
          >
            Novo
          </Link>
        </div>
      </header>

      {!bancoConfigurado() && (
        <p className="mb-4 rounded-xl border border-amarelo/40 bg-amarelo/10 px-4 py-3 text-sm text-amarelo">
          Falta configurar <code>SUPABASE_URL</code> e{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>. Veja o README.
        </p>
      )}

      {falha && (
        <p className="mb-4 rounded-xl border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm text-perigo">
          {falha}
        </p>
      )}

      <CapturaRapida tipoPadrao={tipo ?? "ideia"} tagAtual={tag || undefined} />

      <Busca valor={busca} extras={outrosFiltros.toString()} />

      {/*
        No celular os filtros rolam de lado em vez de empilhar: três linhas de
        etiqueta empurrariam os itens pra fora da tela logo na abertura.
      */}
      <div className="mb-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 whitespace-nowrap sm:flex-wrap sm:overflow-visible">
        <Link href={comFiltro({ tipo: undefined })} className={chip(!tipo)}>
          Tudo
        </Link>

        {tipos.map((valor) => (
          <Link
            key={valor}
            href={comFiltro({ tipo: valor })}
            className={chip(tipo === valor)}
          >
            {rotuloTipo[valor]}
            {acervo.porTipo[valor] > 0 && (
              <span className="ml-1 text-suave/60">{acervo.porTipo[valor]}</span>
            )}
          </Link>
        ))}

        {(arquivados || acervo.arquivados > 0) && (
          <Link
            href={comFiltro({ arquivados: arquivados ? undefined : "1" })}
            className={`${chip(arquivados)} ml-auto`}
          >
            {arquivados ? "Ocultar arquivados" : `Arquivados ${acervo.arquivados}`}
          </Link>
        )}
      </div>

      {(acervo.tags.length > 0 || tag) && (
        <div className="mb-5 flex flex-nowrap gap-1.5 overflow-x-auto pb-1 whitespace-nowrap sm:flex-wrap sm:overflow-visible">
          {tag ? (
            <Link href={comFiltro({ tag: undefined })} className={chip(true)}>
              #{tag} ✕
            </Link>
          ) : (
            acervo.tags.slice(0, 12).map(({ tag: nome, total }) => (
              <Link
                key={nome}
                href={comFiltro({ tag: nome })}
                className={chip(false)}
              >
                #{nome} <span className="text-suave/60">{total}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {itens.length === 0 && !falha ? (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-12 text-center">
          {filtrando ? (
            <>
              <p className="text-sm text-suave">Nada com esses filtros.</p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-lg border border-borda px-4 py-2 text-sm transition-colors hover:border-destaque hover:text-destaque"
              >
                Limpar filtros
              </Link>
            </>
          ) : (
            <div className="mx-auto max-w-md text-left">
              <p className="text-center text-sm text-texto">
                Vazio por enquanto.
              </p>

              <ul className="mt-5 flex flex-col gap-2.5 text-sm text-suave">
                <li>
                  <strong className="font-medium text-texto">Anote em cima</strong>{" "}
                  — uma frase e Enter. Organizar é outro momento.
                </li>
                <li>
                  <strong className="font-medium text-texto">Dentro do item</strong>{" "}
                  markdown vira formatação: <code>#</code> título,{" "}
                  <code>-</code> lista, <code>- [ ]</code> tarefa (que dá pra
                  marcar com um toque).
                </li>
                <li>
                  <strong className="font-medium text-texto">No computador</strong>
                  , <code>nuvem push</code> sincroniza uma pasta de arquivos{" "}
                  <code>.md</code> com isto aqui.
                </li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) => (
            <CartaoItem key={item.id} item={item} />
          ))}
        </div>
      )}

      {itens.length > 0 && (
        <p className="mt-6 hidden text-center text-[11px] text-suave/60 sm:block">
          atalhos: <kbd>/</kbd> buscar · <kbd>n</kbd> novo
        </p>
      )}
    </main>
  );
}
