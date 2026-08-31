/**
 * Markdown suficiente — títulos, listas, tarefas, citação, código, negrito,
 * itálico e link. Nada de tabela, nota de rodapé ou HTML embutido.
 *
 * É uma escolha, não preguiça: uma biblioteca de markdown é a maior dependência
 * que este projeto teria, e o que ela resolve a mais só aparece em documento
 * que você não escreve num campo de texto no celular. Se um dia precisar de
 * tabela, troque só este arquivo por `marked` — o resto do app não sabe a
 * diferença.
 *
 * Regra de ouro: escapa TUDO primeiro, formata depois. Assim nenhum texto
 * colado (de um e-mail, de um site) consegue injetar HTML na página.
 */

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formatação que vive dentro de uma linha. O texto já chegou escapado. */
function inline(texto: string) {
  return (
    texto
      // Código primeiro: o que está entre crases não vira negrito nem link.
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      // Só http(s) e caminho interno viram link. `javascript:` fica como texto.
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
  );
}

export function markdownParaHtml(texto: string): string {
  const linhas = escapar(texto.replace(/\r\n/g, "\n")).split("\n");
  const saida: string[] = [];

  let paragrafo: string[] = [];
  let lista: "ul" | "ol" | null = null;
  let citacao: string[] = [];
  let codigo: string[] | null = null;

  // Cada bloco carrega a linha onde começou no texto original. É isso que faz
  // um toque na leitura abrir o editor com o cursor naquele exato ponto, em vez
  // de jogar você no começo de tudo pra procurar de novo onde estava.
  let inicioParagrafo = 0;
  let inicioCitacao = 0;
  let inicioCodigo = 0;

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      saida.push(
        `<p data-linha="${inicioParagrafo}">${inline(paragrafo.join(" "))}</p>`,
      );
      paragrafo = [];
    }
  };

  const fecharLista = () => {
    if (lista) {
      saida.push(`</${lista}>`);
      lista = null;
    }
  };

  const fecharCitacao = () => {
    if (citacao.length) {
      saida.push(
        `<blockquote data-linha="${inicioCitacao}">${inline(citacao.join(" "))}</blockquote>`,
      );
      citacao = [];
    }
  };

  const fecharTudo = () => {
    fecharParagrafo();
    fecharLista();
    fecharCitacao();
  };

  for (const [numeroDaLinha, linha] of linhas.entries()) {
    if (linha.trimStart().startsWith("```")) {
      if (codigo) {
        saida.push(
          `<pre data-linha="${inicioCodigo}"><code>${codigo.join("\n")}</code></pre>`,
        );
        codigo = null;
      } else {
        fecharTudo();
        codigo = [];
        inicioCodigo = numeroDaLinha;
      }
      continue;
    }

    if (codigo) {
      codigo.push(linha);
      continue;
    }

    if (!linha.trim()) {
      fecharTudo();
      continue;
    }

    const titulo = /^(#{1,4})\s+(.*)$/.exec(linha);
    if (titulo) {
      fecharTudo();
      const nivel = titulo[1].length + 1; // # vira h2: o h1 é o título do item.
      saida.push(
        `<h${nivel} data-linha="${numeroDaLinha}">${inline(titulo[2])}</h${nivel}>`,
      );
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(linha)) {
      fecharTudo();
      saida.push("<hr />");
      continue;
    }

    const marcador = /^\s*([-*+])\s+(.*)$/.exec(linha);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(linha);

    if (marcador || numero) {
      fecharParagrafo();
      fecharCitacao();

      const tipo = marcador ? "ul" : "ol";
      if (lista !== tipo) {
        fecharLista();
        saida.push(`<${tipo}>`);
        lista = tipo;
      }

      const conteudo = (marcador ? marcador[2] : numero![1]).trim();
      const tarefa = /^\[([ xX])\]\s*(.*)$/.exec(conteudo);

      if (tarefa) {
        const feita = tarefa[1].toLowerCase() === "x";
        // Só a marca é botão. O texto ao lado continua sendo texto — quem quer
        // corrigir a frase não marca a tarefa sem querer.
        saida.push(
          `<li class="tarefa${feita ? " feita" : ""}" data-linha="${numeroDaLinha}">` +
            `<span class="marca" data-tarefa="${numeroDaLinha}" role="button" ` +
            `aria-label="${feita ? "Desmarcar" : "Marcar"} tarefa">` +
            `${feita ? "✔" : "○"}</span>` +
            `<span>${inline(tarefa[2])}</span></li>`,
        );
      } else {
        saida.push(`<li data-linha="${numeroDaLinha}">${inline(conteudo)}</li>`);
      }

      continue;
    }

    const citada = /^\s*&gt;\s?(.*)$/.exec(linha);
    if (citada) {
      fecharParagrafo();
      fecharLista();
      if (!citacao.length) inicioCitacao = numeroDaLinha;
      citacao.push(citada[1]);
      continue;
    }

    fecharLista();
    fecharCitacao();
    if (!paragrafo.length) inicioParagrafo = numeroDaLinha;
    paragrafo.push(linha.trim());
  }

  if (codigo) {
    saida.push(
      `<pre data-linha="${inicioCodigo}"><code>${codigo.join("\n")}</code></pre>`,
    );
  }
  fecharTudo();

  return saida.join("\n");
}

/**
 * Marca ou desmarca a tarefa daquela linha e devolve o texto inteiro.
 *
 * Trabalha no markdown, não no HTML: a fonte da verdade continua sendo o texto
 * que você escreveu — o que o `nuvem pull` traz é isto, não uma marcação
 * paralela guardada em outro lugar.
 */
export function alternarTarefa(texto: string, numeroDaLinha: number) {
  const linhas = texto.split("\n");
  const linha = linhas[numeroDaLinha];

  if (linha === undefined) return texto;

  linhas[numeroDaLinha] = linha.replace(/\[([ xX])\]/, (todo, marca) =>
    marca === " " ? "[x]" : "[ ]",
  );

  return linhas.join("\n");
}

/** Quantas tarefas existem e quantas já foram feitas. Vira "2/5" no cartão. */
export function contarTarefas(texto: string) {
  const tarefas = texto.match(/^\s*[-*+]\s+\[[ xX]\]/gm) ?? [];
  const feitas = tarefas.filter((linha) => /\[[xX]\]/.test(linha)).length;

  return { total: tarefas.length, feitas };
}

/** Texto limpo pro cartão da lista: sem marcação, sem quebra de linha. */
export function resumo(texto: string, limite = 180) {
  const plano = texto
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return plano.length > limite ? `${plano.slice(0, limite).trimEnd()}…` : plano;
}
