import type { Metadata } from "next";

import { FormEntrar } from "@/components/FormEntrar";
import { MarcaEmpilhada } from "@/components/Marca";
import { acessoConfigurado } from "@/lib/sessao";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar(props: PageProps<"/entrar">) {
  const parametros = await props.searchParams;
  const bruto = parametros.destino;
  const destino = typeof bruto === "string" && /^\/(?!\/)/.test(bruto) ? bruto : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-9">
          <MarcaEmpilhada />
        </div>

        {acessoConfigurado() ? (
          <FormEntrar destino={destino} />
        ) : (
          <p className="rounded-xl border border-aviso/40 bg-aviso/10 px-4 py-3 text-sm text-aviso">
            Falta configurar <code>SENHA</code> e <code>SESSAO_SEGREDO</code>.
            Veja o README.
          </p>
        )}
      </div>
    </main>
  );
}
