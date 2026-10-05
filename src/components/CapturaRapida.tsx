"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { capturar } from "@/app/acoes";
import { estadoInicial } from "@/lib/formulario";
import { rotuloTipo, tipos, type Tipo } from "@/lib/tipos";

/**
 * Uma linha só: escreve e dá Enter. O item nasce com título e mais nada — o
 * resto você preenche quando (e se) aquilo virar alguma coisa.
 */
export function CapturaRapida({
  tipoPadrao = "ideia",
  tagAtual,
}: {
  tipoPadrao?: Tipo;
  tagAtual?: string;
}) {
  const [estado, anotar, anotando] = useActionState(capturar, estadoInicial);
  const formulario = useRef<HTMLFormElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Anotou: limpa e devolve o cursor, pronto pra próxima. Sem isso, anotar três
  // ideias seguidas vira três cliques no campo.
  useEffect(() => {
    if (!estado.salvoEm) return;

    formulario.current?.reset();
    campo.current?.focus();
  }, [estado.salvoEm]);

  return (
    <form
      ref={formulario}
      action={anotar}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-borda bg-superficie p-2"
    >
      {/* A tag do filtro entra junto: anotando dentro de #rumo, já nasce #rumo. */}
      {tagAtual && <input type="hidden" name="tag" value={tagAtual} />}

      <input
        ref={campo}
        name="titulo"
        maxLength={200}
        autoComplete="off"
        // Enter envia, sempre. O navegador já faria isso sozinho, mas isto aqui
        // é a promessa da caixa: escreveu, apertou Enter, anotou.
        onKeyDown={(evento) => {
          if (evento.key !== "Enter") return;
          evento.preventDefault();
          formulario.current?.requestSubmit();
        }}
        placeholder="Anotar rápido — uma ideia, um projeto, um lembrete…"
        // No celular a frase fica com a linha inteira; tipo e botão descem.
        className="flex-1 basis-full bg-transparent px-2 py-1.5 text-sm text-texto outline-none sm:basis-0 sm:min-w-48 placeholder:text-fraco"
      />

      <select
        name="tipo"
        defaultValue={tipoPadrao}
        aria-label="Tipo do que está anotando"
        className="rounded-lg border border-borda bg-elevado px-2 py-1.5 text-xs text-suave outline-none focus:border-destaque"
      >
        {tipos.map((valor) => (
          <option key={valor} value={valor}>
            {rotuloTipo[valor]}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={anotando}
        className="ml-auto rounded-lg bg-elevado px-3 py-1.5 text-xs font-semibold text-texto transition-colors hover:bg-destaque hover:text-fundo disabled:opacity-50"
      >
        {anotando ? "Anotando…" : "Anotar"}
      </button>

      {estado.slug && (
        <p className="w-full px-2 pb-1 text-[11px] text-suave">
          anotado ·{" "}
          <Link href={`/item/${estado.slug}`} className="text-destaque underline">
            abrir {estado.titulo}
          </Link>
        </p>
      )}
    </form>
  );
}
