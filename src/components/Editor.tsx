"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { apagar, salvarItem } from "@/app/acoes";
import { estadoInicial } from "@/lib/formulario";
import { markdownParaHtml } from "@/lib/markdown";
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

/**
 * A tela de escrever. Serve pro item novo e pro item existente — a diferença é
 * só o `slug` escondido, que é o que faz a ação do servidor criar ou atualizar.
 */
export function Editor({
  item,
  tipoInicial = "nota",
}: {
  item?: Item;
  tipoInicial?: Tipo;
}) {
  const [estado, salvar, salvando] = useActionState(salvarItem, estadoInicial);

  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [tipo, setTipo] = useState<Tipo>(item?.tipo ?? tipoInicial);
  const [status, setStatus] = useState<Situacao>(item?.status ?? "ativo");
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [conteudo, setConteudo] = useState(item?.conteudo ?? "");
  const [aba, setAba] = useState<"escrever" | "ver">("escrever");

  const formulario = useRef<HTMLFormElement>(null);

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

  const mudou = agora !== ultimoSalvo;

  // Ctrl+S / Cmd+S salva, como em qualquer editor.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") {
        evento.preventDefault();
        formulario.current?.requestSubmit();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-fundo/85 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-sm text-suave transition-colors hover:text-texto"
        >
          ← Tudo
        </Link>

        <span className="min-w-0 flex-1 truncate text-xs text-suave">
          {salvando
            ? "salvando…"
            : mudou
              ? "não salvo"
              : estado.salvoEm
                ? "salvo"
                : item
                  ? `#${item.slug}`
                  : ""}
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
          disabled={salvando}
          className="rounded-lg bg-destaque px-3 py-1.5 text-sm font-semibold text-fundo transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Salvar
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
          className="w-full bg-transparent text-2xl font-semibold text-texto outline-none placeholder:text-suave/50"
        />

        <div className="flex flex-wrap gap-2">
          <select
            name="tipo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as Tipo)}
            className={campoBase}
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
          />
        </div>

        <div className="flex gap-1 text-sm">
          {(["escrever", "ver"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setAba(valor)}
              className={`rounded-lg px-3 py-1 transition-colors ${
                aba === valor
                  ? "bg-elevado text-texto"
                  : "text-suave hover:text-texto"
              }`}
            >
              {valor === "escrever" ? "Escrever" : "Ver"}
            </button>
          ))}
        </div>

        {/*
          A caixa de texto continua no DOM na aba "Ver" (só escondida): é ela
          que carrega o conteúdo no envio do formulário.
        */}
        <textarea
          name="conteudo"
          value={conteudo}
          onChange={(evento) => setConteudo(evento.target.value)}
          hidden={aba === "ver"}
          placeholder="Escreve aqui. Aceita markdown: # título, - lista, - [ ] tarefa, **negrito**."
          spellCheck
          className="min-h-[55vh] flex-1 resize-none rounded-2xl border border-borda bg-superficie p-4 font-mono text-sm leading-relaxed text-texto outline-none transition-colors focus:border-destaque placeholder:text-suave/50"
        />

        {aba === "ver" && (
          <div
            className="prosa min-h-[55vh] flex-1 rounded-2xl border border-borda bg-superficie p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </form>
    </div>
  );
}
