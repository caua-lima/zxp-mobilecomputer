import type { Metadata } from "next";

import { Editor } from "@/components/Editor";
import { exigirSessao } from "@/lib/guarda";
import { ehTipo } from "@/lib/itens";

export const metadata: Metadata = { title: "Novo" };

export default async function Novo(props: PageProps<"/novo">) {
  await exigirSessao();

  const parametros = await props.searchParams;
  const tipo = parametros.tipo;

  return <Editor tipoInicial={ehTipo(tipo) ? tipo : "nota"} />;
}
