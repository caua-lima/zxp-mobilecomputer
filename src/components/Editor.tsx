"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { apagar, salvarItem } from "@/app/acoes";
import { dataCompleta, hora } from "@/lib/datas";
import { estadoInicial } from "@/lib/formulario";
import { alternarTarefa, markdownParaHtml } from "@/lib/markdown";
import {
  rotuloSituacao,
  rotuloTipo,
  situacoes,
  tipos,
  type Item,
  type Situacao,
  type Tipo,
} from "@/lib/tipos";

const campoBase =
  "rounded-xl border border-borda bg-superficie px-3 py-2 text-sm text-texto outline-none transition-colors focus:border-destaque";

/** Quanto tempo parado antes de gravar sozinho. */
const ESPERA_AUTOSALVAMENTO = 1200;

/**
 * A tela de escrever e de ler. Serve pro item novo e pro existente — a diferença
 * é só o `slug` escondido, que é o que faz a ação do servidor criar ou atualizar.
 *
 * Item que já existe salva sozinho: você escreve, para, e um instante depois ele
 * já está gravado. O botão Salvar continua ali porque saber que dá pra salvar
 * agora é diferente de confiar que salvou.
 */
export function Editor({
  item,
  tipoInicial = "nota",
}: {
  item?: Item;
  tipoInicial?: Tipo;
}) {
  const [estado, salvar, salvando] = useActionState(salvarItem, estadoInicial);
  const router = useRouter();

  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [tipo, setTipo] = useState<Tipo>(item?.tipo ?? tipoInicial);
  const [status, setStatus] = useState<Situacao>(item?.status ?? "ativo");
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [conteudo, setConteudo] = useState(item?.conteudo ?? "");

  // Item com texto abre pra ler: no celular, isso é a diferença entre olhar uma
  // anotação e levar um teclado na cara.
  const [modo, setModo] = useState<"ler" | "escrever">(
    item?.conteudo.trim() ? "ler" : "escrever",
  );

  const formulario = useRef<HTMLFormElement>(null);
  const caixaDeTexto = useRef<HTMLTextAreaElement>(null);

  // "Tem coisa não salva?" é só uma comparação: o que está na tela agora contra
  // o que estava quando o servidor confirmou o último salvamento.
  const agora = JSON.stringify([titulo, tipo, status, tags, conteudo]);
  const [ultimoSalvo, setUltimoSalvo] = useState(agora);
  const [confirmacaoVista, setConfirmacaoVista] = useState(estado.salvoEm);

  if (estado.salvoEm !== confirmacaoVista) {
    // Ajuste durante a renderização (e não num efeito): o React reexecuta este
    // componente na hora, sem pintar a tela com o estado velho no meio.
    setConfirmacaoVista(estado.salvoEm);
    setUltimoSalvo(agora);
  }

  // Qual versão do texto o servidor recusou. Enquanto for esta, não adianta
  // insistir sozinho — seria um pedido por segundo com o banco fora do ar.
  const [falhaVista, setFalhaVista] = useState(estado.falhouEm);
  const [versaoRecusada, setVersaoRecusada] = useState<string | null>(null);

  const [saindo, setSaindo] = useState(false);

  if (estado.falhouEm !== falhaVista) {
    setFalhaVista(estado.falhouEm);
    setVersaoRecusada(agora);
    // Falhou: fica na tela, com o texto à vista. Sair agora seria perder.
    setSaindo(false);
  }

  const mudou = agora !== ultimoSalvo;

  // Salvar sozinho, mas só o que já existe. Item novo precisa de um clique:
  // criar sem querer um item vazio a cada rascunho seria pior que digitar.
  useEffect(() => {
    if (!item || !mudou || salvando || versaoRecusada === agora) return;

    const relogio = setTimeout(
      () => formulario.current?.requestSubmit(),
      ESPERA_AUTOSALVAMENTO,
    );

    return () => clearTimeout(relogio);
  }, [item, mudou, salvando, agora, versaoRecusada]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const salvarAgora =
        (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s";

      if (salvarAgora) {
        evento.preventDefault();
        formulario.current?.requestSubmit();
        return;
      }

      if (evento.key === "Escape" && item) setModo("ler");
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [item]);

  // Pediu pra voltar com coisa não salva: espera a gravação terminar e só então
  // navega. É o mesmo motivo do aviso do navegador — a lista pode esperar meio
  // segundo, o que você escreveu não pode se perder.
  useEffect(() => {
    if (!saindo || salvando || mudou) return;
    router.push("/");
  }, [saindo, salvando, mudou, router]);

  // Fechar a aba com texto não salvo pede confirmação do navegador.
  useEffect(() => {
    if (!mudou) return;

    function aoSair(evento: BeforeUnloadEvent) {
      evento.preventDefault();
    }

    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [mudou]);

  const html = useMemo(() => markdownParaHtml(conteudo), [conteudo]);

  /** Onde termina a linha `numero`, contado em caracteres do texto inteiro. */
  function fimDaLinha(texto: string, numero: number) {
    const linhas = texto.split("\n");
    const antes = linhas
      .slice(0, numero)
      .reduce((soma, linha) => soma + linha.length + 1, 0);

    return antes + (linhas[numero]?.length ?? 0);
  }

  function irParaEscrita(linha?: number) {
    setModo("escrever");

    // Deixa o React trocar a tela antes de pedir o foco e posicionar o cursor.
    setTimeout(() => {
      const caixa = caixaDeTexto.current;
      if (!caixa) return;

      caixa.focus();

      const posicao =
        linha === undefined
          ? caixa.value.length
          : fimDaLinha(caixa.value, linha);

      caixa.setSelectionRange(posicao, posicao);
    }, 0);
  }

  /** Voltar pra lista sem deixar rastro de texto perdido. */
  function aoVoltar(evento: React.MouseEvent<HTMLAnchorElement>) {
    if (!mudou) return;

    evento.preventDefault();

    // Item novo não salva sozinho: aqui só existe perguntar.
    if (!item) {
      if (confirm("Sair sem criar? O que você escreveu se perde.")) {
        router.push("/");
      }
      return;
    }

    setSaindo(true);
    formulario.current?.requestSubmit();
  }

  /** Um toque na leitura: marca a tarefa, segue o link, ou abre pra escrever. */
  function aoTocarNaLeitura(evento: React.MouseEvent<HTMLDivElement>) {
    const alvo = evento.target as HTMLElement;
    if (alvo.closest("a")) return;

    const marca = alvo.closest<HTMLElement>("[data-tarefa]");
    if (marca?.dataset.tarefa) {
      const linha = Number(marca.dataset.tarefa);
      setConteudo((texto) => alternarTarefa(texto, linha));
      return;
    }

    const bloco = alvo.closest<HTMLElement>("[data-linha]");
    irParaEscrita(bloco?.dataset.linha ? Number(bloco.dataset.linha) : undefined);
  }

  const situacaoDoSalvamento = salvando
    ? "salvando…"
    : mudou
      ? "não salvo"
      : estado.salvoEm
        ? `salvo ${hora(estado.salvoEm)}`
        : item
          ? `#${item.slug}`
          : "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-fundo/85 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          onClick={aoVoltar}
          className="rounded-lg px-2 py-1 text-sm text-suave transition-colors hover:text-texto"
        >
          ← Tudo
        </Link>

        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            mudou && !salvando ? "text-aviso" : "text-suave"
          }`}
        >
          {situacaoDoSalvamento}
        </span>

        {item && (
          <form
            action={apagar}
            onSubmit={(evento) => {
              if (!confirm(`Apagar "${item.titulo}"?`)) evento.preventDefault();
            }}
          >
            <input type="hidden" name="slug" value={item.slug} />
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-sm text-suave transition-colors hover:text-perigo"
            >
              Apagar
            </button>
          </form>
        )}

        <button
          type="submit"
          form="editor"
          disabled={salvando || (!mudou && Boolean(item))}
          className="rounded-lg bg-destaque px-3 py-1.5 text-sm font-semibold text-fundo transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {item ? "Salvar" : "Criar"}
        </button>
      </header>

      <form
        id="editor"
        ref={formulario}
        action={salvar}
        className="flex flex-1 flex-col gap-3 px-4 py-4"
      >
        {item && <input type="hidden" name="slug" value={item.slug} />}

        {estado.erro && (
          <p className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">
            {estado.erro}
          </p>
        )}

        <input
          name="titulo"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="Título"
          autoFocus={!item}
          maxLength={200}
          className="font-display w-full bg-transparent text-2xl font-semibold text-texto outline-none placeholder:text-fraco"
        />

        <div className="flex flex-wrap gap-2">
          <select
            name="tipo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as Tipo)}
            className={campoBase}
            aria-label="Tipo"
          >
            {tipos.map((valor) => (
              <option key={valor} value={valor}>
                {rotuloTipo[valor]}
              </option>
            ))}
          </select>

          <select
            name="status"
            value={status}
            onChange={(evento) => setStatus(evento.target.value as Situacao)}
            className={campoBase}
            aria-label="Situação"
          >
            {situacoes.map((valor) => (
              <option key={valor} value={valor}>
                {rotuloSituacao[valor]}
              </option>
            ))}
          </select>

          <input
            name="tags"
            value={tags}
            onChange={(evento) => setTags(evento.target.value)}
            placeholder="tags, separadas, por vírgula"
            className={`${campoBase} min-w-40 flex-1`}
            aria-label="Tags"
          />
        </div>

        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => irParaEscrita()}
            className={`rounded-lg px-3 py-1 transition-colors ${
              modo === "escrever"
                ? "bg-elevado text-texto"
                : "text-suave hover:text-texto"
            }`}
          >
            Escrever
          </button>

          <button
            type="button"
            onClick={() => setModo("ler")}
            className={`rounded-lg px-3 py-1 transition-colors ${
              modo === "ler"
                ? "bg-elevado text-texto"
                : "text-suave hover:text-texto"
            }`}
          >
            Ler
          </button>

          <span className="ml-auto hidden text-[11px] text-fraco sm:block">
            {modo === "ler"
              ? "toque no texto pra editar ali · toque no ○ pra marcar"
              : "Ctrl+S salva · Esc volta pra leitura"}
          </span>
        </div>

        {/*
          A caixa de texto continua no DOM na leitura (só escondida): é ela que
          carrega o conteúdo no envio do formulário.
        */}
        <textarea
          ref={caixaDeTexto}
          name="conteudo"
          value={conteudo}
          onChange={(evento) => setConteudo(evento.target.value)}
          hidden={modo === "ler"}
          placeholder="Escreve aqui. Aceita markdown: # título, - lista, - [ ] tarefa, **negrito**."
          spellCheck
          className="min-h-[55vh] flex-1 resize-none rounded-2xl border border-borda bg-superficie p-4 font-mono text-sm leading-relaxed text-texto outline-none transition-colors focus:border-destaque placeholder:text-fraco"
        />

        {modo === "ler" &&
          (conteudo.trim() ? (
            <div
              onClick={aoTocarNaLeitura}
              className="prosa min-h-[55vh] flex-1 cursor-text rounded-2xl border border-borda bg-superficie p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <button
              type="button"
              onClick={() => irParaEscrita()}
              className="min-h-[55vh] flex-1 rounded-2xl border border-dashed border-borda p-4 text-sm text-suave transition-colors hover:border-destaque hover:text-destaque"
            >
              Sem conteúdo ainda. Toque pra escrever.
            </button>
          ))}

        {item && (
          <p className="pb-2 text-[11px] text-fraco">
            criado em {dataCompleta(item.criado_em)} · #{item.slug}
          </p>
        )}
      </form>
    </div>
  );
}
