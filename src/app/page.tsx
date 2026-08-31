import Link from "next/link";

import { sair } from "./acoes";
import { CartaoItem } from "@/components/CartaoItem";
import { exigirSessao } from "@/lib/guarda";
import { ehTipo, listar, rotuloTipo, tagsEmUso, tipos, type Item } from "@/lib/itens";
import { bancoConfigurado } from "@/lib/supabase";

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
  let tags: { tag: string; total: number }[] = [];
  let falha = "";

  if (bancoConfigurado()) {
    try {
      [itens, tags] = await Promise.all([
        listar({ busca, tipo, tag, incluirArquivados: arquivados }),
        tagsEmUso(),
      ]);
    } catch (erro) {
      console.error("[painel] falha ao listar:", erro);
      falha =
        "Não consegui falar com o banco. Confere as variáveis do Supabase e se a tabela `itens` já foi criada.";
    }
  }

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
          {itens.length} {itens.length === 1 ? "item" : "itens"}
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

      <form action="/" className="mb-3">
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        {arquivados && <input type="hidden" name="arquivados" value="1" />}

        <input
          type="search"
          name="q"
          defaultValue={busca}
          placeholder="Buscar no título e no conteúdo…"
          className="w-full rounded-xl border border-borda bg-superficie px-4 py-2.5 text-sm text-texto outline-none transition-colors focus:border-destaque placeholder:text-suave/60"
        />
      </form>

      <div className="mb-3 flex flex-wrap gap-1.5">
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
          </Link>
        ))}

        <Link
          href={comFiltro({ arquivados: arquivados ? undefined : "1" })}
          className={`${chip(arquivados)} ml-auto`}
        >
          {arquivados ? "Ocultar arquivados" : "Ver arquivados"}
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {tag && (
            <Link href={comFiltro({ tag: undefined })} className={chip(true)}>
              #{tag} ✕
            </Link>
          )}

          {!tag &&
            tags.slice(0, 12).map(({ tag: nome, total }) => (
              <Link
                key={nome}
                href={comFiltro({ tag: nome })}
                className={chip(false)}
              >
                #{nome} <span className="text-suave/60">{total}</span>
              </Link>
            ))}
        </div>
      )}

      {itens.length === 0 && !falha ? (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-16 text-center">
          <p className="text-sm text-suave">
            {busca || tipo || tag
              ? "Nada com esses filtros."
              : "Vazio por enquanto. O primeiro item pode ser aquela ideia que você não quer esquecer."}
          </p>
          <Link
            href="/novo"
            className="mt-4 inline-block rounded-lg border border-borda px-4 py-2 text-sm transition-colors hover:border-destaque hover:text-destaque"
          >
            Criar item
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) => (
            <CartaoItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
