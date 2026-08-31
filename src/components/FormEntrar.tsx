"use client";

import { useActionState, useRef } from "react";

import { entrar } from "@/app/acoes";
import { estadoInicial } from "@/lib/formulario";

export function FormEntrar({ destino }: { destino: string }) {
  const [estado, acao, entrando] = useActionState(entrar, estadoInicial);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="destino" value={destino} />

      <input
        type="password"
        name="senha"
        autoFocus
        autoComplete="current-password"
        placeholder="Senha"
        onKeyDown={(evento) => {
          if (evento.key !== "Enter") return;
          evento.preventDefault();
          formulario.current?.requestSubmit();
        }}
        className="rounded-xl border border-borda bg-superficie px-4 py-3 text-base text-texto outline-none transition-colors focus:border-destaque placeholder:text-suave/60"
      />

      {estado.erro && <p className="text-sm text-perigo">{estado.erro}</p>}

      <button
        type="submit"
        disabled={entrando}
        className="rounded-xl bg-destaque px-4 py-3 text-sm font-semibold text-fundo transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
