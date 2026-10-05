"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Quanto tempo parado antes de perguntar pro servidor. */
const ESPERA = 300;

/**
 * Busca que acontece enquanto você digita — sem botão, sem Enter.
 *
 * `extras` é a query string dos outros filtros já ligados (tipo, tag), pronta
 * como texto: passar um objeto faria este componente recalcular a cada
 * renderização do pai sem nada ter mudado de verdade.
 */
export function Busca({ valor, extras }: { valor: string; extras: string }) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(valor);

  useEffect(() => {
    if (texto.trim() === valor) return;

    const relogio = setTimeout(() => {
      const query = new URLSearchParams(extras);
      if (texto.trim()) query.set("q", texto.trim());

      const destino = query.toString() ? `/?${query}` : "/";
      router.replace(destino, { scroll: false });
    }, ESPERA);

    return () => clearTimeout(relogio);
  }, [texto, valor, extras, router]);

  // Atalhos de quem está no computador: "/" busca, "n" cria, Esc limpa.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(
        alvo?.tagName ?? "",
      );

      if (evento.key === "Escape" && alvo === campo.current) {
        setTexto("");
        return;
      }

      if (digitando || evento.ctrlKey || evento.metaKey || evento.altKey) return;

      if (evento.key === "/") {
        evento.preventDefault();
        campo.current?.focus();
      }

      if (evento.key.toLowerCase() === "n") {
        evento.preventDefault();
        router.push("/novo");
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [router]);

  return (
    <div className="relative mb-3">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-fraco"
      >
        ⌕
      </span>

      <input
        ref={campo}
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Buscar no título e no conteúdo…"
        aria-label="Buscar"
        className="w-full rounded-xl border border-borda bg-superficie py-2.5 pr-4 pl-9 text-sm text-texto outline-none transition-colors focus:border-destaque placeholder:text-fraco"
      />
    </div>
  );
}
