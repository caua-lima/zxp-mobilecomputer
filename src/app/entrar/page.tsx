import type { Metadata } from "next";

import { FormEntrar } from "@/components/FormEntrar";
import { acessoConfigurado } from "@/lib/sessao";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar(props: PageProps<"/entrar">) {
  const parametros = await props.searchParams;
  const bruto = parametros.destino;
  const destino = typeof bruto === "string" && /^\/(?!\/)/.test(bruto) ? bruto : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Nuvem</h1>
          <p className="mt-1 text-sm text-suave">
            Seus projetos, ideias e notas.
          </p>
        </div>

        {acessoConfigurado() ? (
          <FormEntrar destino={destino} />
        ) : (
          <p className="rounded-xl border border-amarelo/40 bg-amarelo/10 px-4 py-3 text-sm text-amarelo">
            Falta configurar <code>SENHA</code> e <code>SESSAO_SEGREDO</code>.
            Veja o README.
          </p>
        )}
      </div>
    </main>
  );
}
