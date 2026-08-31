import Link from "next/link";

import { Etiqueta } from "@/components/Etiqueta";
import { quandoFoi } from "@/lib/datas";
import { resumo } from "@/lib/markdown";
import { rotuloSituacao, rotuloTipo, type Item, type Situacao } from "@/lib/tipos";

const tomDaSituacao: Record<Situacao, "neutro" | "verde" | "amarelo"> = {
  ativo: "neutro",
  pausado: "amarelo",
  feito: "verde",
  arquivado: "neutro",
};

export function CartaoItem({ item }: { item: Item }) {
  const previa = resumo(item.conteudo);

  return (
    <Link
      href={`/item/${item.slug}`}
      className="group flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4 transition-colors hover:border-destaque/50 hover:bg-elevado focus-visible:border-destaque focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta tom="destaque">{rotuloTipo[item.tipo]}</Etiqueta>
        {item.status !== "ativo" && (
          <Etiqueta tom={tomDaSituacao[item.status]}>
            {rotuloSituacao[item.status]}
          </Etiqueta>
        )}
        <span className="ml-auto text-[11px] text-suave">
          {quandoFoi(item.atualizado_em)}
        </span>
      </div>

      <h2 className="text-base leading-snug font-semibold text-texto group-hover:text-destaque-forte">
        {item.titulo}
      </h2>

      {previa && (
        <p className="line-clamp-3 text-sm leading-relaxed text-suave">
          {previa}
        </p>
      )}

      {item.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {item.tags.map((tag) => (
            <span key={tag} className="text-[11px] text-suave">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
