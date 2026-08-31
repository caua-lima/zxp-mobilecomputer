#!/usr/bin/env node

/**
 * nuvem — o `git push` do seu cofre de ideias.
 *
 *   nuvem login <url> <token>   guarda o endereço e o token nesta pasta
 *   nuvem status                mostra o que mudou aqui e o que mudou lá
 *   nuvem push                  manda suas alterações pra nuvem
 *   nuvem pull                  traz o que você escreveu pelo celular
 *   nuvem sync                  pull e depois push
 *
 * Como ele decide o que mudou (a parte que importa):
 *
 * Cada item tem duas impressões digitais guardadas em .nuvem/estado.json — a do
 * arquivo como ele estava na última sincronização, e a que o servidor devolveu
 * naquele momento. Comparando as duas com a situação atual dá pra saber, sem
 * relógio e sem adivinhação, quem mexeu: você, o servidor, ou os dois. Quando
 * os dois mexeram, isso é um conflito e nada é sobrescrito calado.
 *
 * Sem dependências: só o que vem com o Node.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PASTAS = {
  projeto: "projetos",
  ideia: "ideias",
  nota: "notas",
  referencia: "referencias",
};

const TIPOS = Object.keys(PASTAS);
const SITUACOES = ["ativo", "pausado", "feito", "arquivado"];

// ─────────────────────────────────────────────────────────────── aparência ──

const colorido = process.stdout.isTTY && !process.env.NO_COLOR;
const cor = (codigo) => (texto) =>
  colorido ? `\x1b[${codigo}m${texto}\x1b[0m` : texto;

const cinza = cor("90");
const verde = cor("32");
const azul = cor("34");
const amarelo = cor("33");
const vermelho = cor("31");
const forte = cor("1");

function morrer(mensagem) {
  console.error(vermelho(`erro: ${mensagem}`));
  process.exit(1);
}

// ──────────────────────────────────────────────────────────── configuração ──

/** Sobe as pastas procurando .nuvem, como o git faz com .git. */
function acharRaiz(inicio = process.cwd()) {
  let atual = path.resolve(inicio);

  for (;;) {
    if (existsSync(path.join(atual, ".nuvem", "config.json"))) return atual;

    const pai = path.dirname(atual);
    if (pai === atual) return null;
    atual = pai;
  }
}

async function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(await readFile(arquivo, "utf8"));
  } catch {
    return padrao;
  }
}

async function escreverJson(arquivo, dados) {
  await mkdir(path.dirname(arquivo), { recursive: true });
  await writeFile(arquivo, JSON.stringify(dados, null, 2) + "\n", "utf8");
}

async function abrirCofre() {
  const raiz = acharRaiz();

  if (!raiz) {
    morrer(
      "esta pasta não é um cofre. Rode:  nuvem login https://sua-nuvem.vercel.app SEU_TOKEN",
    );
  }

  const config = await lerJson(path.join(raiz, ".nuvem", "config.json"), {});
  const estado = await lerJson(path.join(raiz, ".nuvem", "estado.json"), {
    itens: {},
  });

  const url = process.env.NUVEM_URL || config.url;
  const token = process.env.NUVEM_TOKEN || config.token;

  if (!url || !token) morrer("faltou url ou token no .nuvem/config.json");

  return { raiz, url, token, estado };
}

async function salvarEstado(cofre) {
  await escreverJson(path.join(cofre.raiz, ".nuvem", "estado.json"), {
    url: cofre.url,
    itens: cofre.estado.itens,
  });
}

// ─────────────────────────────────────────────────────────────────── rede ──

async function api(cofre, caminho, opcoes = {}) {
  const endereco = new URL(caminho, cofre.url);

  let resposta;
  try {
    resposta = await fetch(endereco, {
      ...opcoes,
      headers: {
        Authorization: `Bearer ${cofre.token}`,
        "Content-Type": "application/json",
        ...opcoes.headers,
      },
    });
  } catch (erro) {
    morrer(`não consegui falar com ${endereco.origin} (${erro.message})`);
  }

  if (resposta.status === 401) {
    morrer("token recusado. Confere o TOKEN_SYNC do servidor.");
  }

  if (!resposta.ok) {
    morrer(`servidor respondeu ${resposta.status}: ${await resposta.text()}`);
  }

  return resposta.json();
}

// ─────────────────────────────────────────────────────────────── arquivos ──

function hashTexto(texto) {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Normaliza a quebra de linha: no Windows o editor grava CRLF e isso não é mudança. */
function normalizar(texto) {
  return texto.replace(/\r\n/g, "\n");
}

function paraSlug(texto) {
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return limpo || "item";
}

/**
 * Lê o cabeçalho entre --- e --- e devolve os campos + o corpo.
 * Formato simples de propósito: `chave: valor`, uma por linha.
 */
function lerFrontmatter(texto) {
  const linhas = normalizar(texto).split("\n");

  if (linhas[0]?.trim() !== "---") {
    return { campos: {}, corpo: normalizar(texto).trim() };
  }

  const fim = linhas.indexOf("---", 1);
  if (fim === -1) return { campos: {}, corpo: normalizar(texto).trim() };

  const campos = {};
  for (const linha of linhas.slice(1, fim)) {
    const separador = linha.indexOf(":");
    if (separador === -1) continue;

    const chave = linha.slice(0, separador).trim();
    const valor = linha.slice(separador + 1).trim();
    if (chave) campos[chave] = valor;
  }

  return { campos, corpo: linhas.slice(fim + 1).join("\n").trim() };
}

function escreverFrontmatter(item) {
  const cabecalho = [
    "---",
    `titulo: ${item.titulo}`,
    `tipo: ${item.tipo}`,
    `status: ${item.status}`,
    `tags: ${(item.tags || []).join(", ")}`,
    `slug: ${item.slug}`,
    "---",
    "",
  ].join("\n");

  return `${cabecalho}${item.conteudo.trim()}\n`;
}

/**
 * Caminho sempre com barra pra frente, inclusive no Windows.
 * O estado.json pode acabar num pendrive, num outro computador, num Mac —
 * separador de pasta não é lugar de guardar sistema operacional.
 */
function caminhoDoItem(item) {
  return `${PASTAS[item.tipo] || PASTAS.nota}/${item.slug}.md`;
}

/**
 * Arquivo sem cabeçalho: o título é o primeiro `# assim`, e essa linha sai do
 * corpo — senão o painel mostraria o título duas vezes. Sem nenhum título, vale
 * o nome do arquivo.
 */
function adivinharTitulo(corpo, padrao) {
  const linhas = corpo.split("\n");
  const primeira = linhas.findIndex((linha) => linha.trim() !== "");
  const cabecalho =
    primeira >= 0 ? /^#\s+(.+)$/.exec(linhas[primeira].trim()) : null;

  if (!cabecalho) return { titulo: padrao, corpo };

  return {
    titulo: cabecalho[1].trim(),
    corpo: linhas.slice(primeira + 1).join("\n").trim(),
  };
}

/** Só as pastas conhecidas entram. Assim um README.md solto nunca vira item. */
async function lerArquivos(raiz) {
  const encontrados = [];

  for (const [tipo, pasta] of Object.entries(PASTAS)) {
    const completo = path.join(raiz, pasta);
    if (!existsSync(completo)) continue;

    for (const nome of await readdir(completo)) {
      if (!nome.endsWith(".md")) continue;

      // O .local.md é a cópia guardada num conflito: ele tem o mesmo slug do
      // arquivo bom e, se entrasse aqui, os dois disputariam o mesmo item —
      // com a sua versão descartada voltando a ser enviada.
      if (nome.endsWith(".local.md")) continue;

      const relativo = `${pasta}/${nome}`;
      const texto = normalizar(await readFile(path.join(raiz, relativo), "utf8"));
      const { campos, corpo } = lerFrontmatter(texto);

      const semCabecalho = adivinharTitulo(corpo, nome.replace(/\.md$/, ""));

      encontrados.push({
        caminho: relativo,
        hash: hashTexto(texto),
        slug: campos.slug || "",
        titulo: campos.titulo || semCabecalho.titulo,
        tipo: TIPOS.includes(campos.tipo) ? campos.tipo : tipo,
        status: SITUACOES.includes(campos.status) ? campos.status : "ativo",
        tags: (campos.tags || "")
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        conteudo: campos.titulo ? corpo : semCabecalho.corpo,
      });
    }
  }

  return encontrados;
}

// ────────────────────────────────────────────────────────────── comparação ──

/**
 * O coração do CLI: junta arquivos, servidor e o que ficou registrado da última
 * vez, e classifica cada item numa das situações abaixo.
 */
async function comparar(cofre) {
  const arquivos = await lerArquivos(cofre.raiz);
  const { itens: remotos } = await api(cofre, "/api/sync");

  const porSlugRemoto = new Map(remotos.map((item) => [item.slug, item]));
  const porSlugLocal = new Map();
  const novos = [];

  for (const arquivo of arquivos) {
    if (arquivo.slug) porSlugLocal.set(arquivo.slug, arquivo);
    else novos.push(arquivo);
  }

  const plano = {
    novos,
    enviar: [],
    baixar: [],
    apagarNoServidor: [],
    apagarLocal: [],
    conflitos: [],
    iguais: 0,
    esquecer: [],
  };

  const slugs = new Set([
    ...porSlugLocal.keys(),
    ...porSlugRemoto.keys(),
    ...Object.keys(cofre.estado.itens),
  ]);

  for (const slug of slugs) {
    const local = porSlugLocal.get(slug);
    const remoto = porSlugRemoto.get(slug);
    const registro = cofre.estado.itens[slug];

    const remotoVivo = remoto && !remoto.apagado_em;
    const localMudou = local ? !registro || local.hash !== registro.arquivoHash : false;
    const remotoMudou = remoto
      ? !registro || remoto.hash !== registro.servidorHash
      : Boolean(registro);

    if (local && !remoto) {
      // Tem slug mas o servidor não conhece: banco novo, ou item recriado.
      plano.enviar.push({ arquivo: local, baseHash: "" });
      continue;
    }

    if (local && remotoVivo) {
      if (!localMudou && !remotoMudou) plano.iguais++;
      else if (localMudou && !remotoMudou)
        plano.enviar.push({ arquivo: local, baseHash: remoto.hash });
      else if (!localMudou && remotoMudou) plano.baixar.push(remoto);
      else plano.conflitos.push({ slug, arquivo: local, remoto });

      continue;
    }

    if (local && remoto && !remotoVivo) {
      // Apagado lá. Se você mexeu aqui depois, isso é conflito.
      if (localMudou) plano.conflitos.push({ slug, arquivo: local, remoto });
      else plano.apagarLocal.push({ slug, caminho: local.caminho });

      continue;
    }

    if (!local && remotoVivo) {
      // Nunca esteve aqui (item criado no celular) ou você apagou o arquivo.
      if (!registro) plano.baixar.push(remoto);
      else if (remotoMudou) plano.conflitos.push({ slug, arquivo: null, remoto });
      else plano.apagarNoServidor.push({ slug, baseHash: remoto.hash });

      continue;
    }

    // Não existe mais em lugar nenhum: só resta limpar o registro.
    if (registro) plano.esquecer.push(slug);
  }

  return plano;
}

// ─────────────────────────────────────────────────────────────── comandos ──

async function comandoLogin(argumentos) {
  const [url, token] = argumentos;

  if (!url || !token) {
    morrer("uso: nuvem login <url> <token>");
  }

  let endereco;
  try {
    endereco = new URL(url);
  } catch {
    return morrer(`endereço inválido: ${url}`);
  }

  const raiz = process.cwd();
  await escreverJson(path.join(raiz, ".nuvem", "config.json"), {
    url: endereco.origin,
    token,
  });

  for (const pasta of Object.values(PASTAS)) {
    await mkdir(path.join(raiz, pasta), { recursive: true });
  }

  const cofre = await abrirCofre();
  const { itens } = await api(cofre, "/api/sync");

  console.log(verde("pronto."), cinza(`cofre em ${raiz}`));
  console.log(cinza(`${itens.length} item(ns) na nuvem. Rode: nuvem pull`));
}

async function comandoStatus() {
  const cofre = await abrirCofre();
  const plano = await comparar(cofre);

  const linhas = [];

  for (const arquivo of plano.novos) {
    linhas.push(`${verde("novo   ")} ${arquivo.caminho}`);
  }
  for (const { arquivo } of plano.enviar) {
    linhas.push(`${verde("enviar ")} ${arquivo.caminho}`);
  }
  for (const remoto of plano.baixar) {
    linhas.push(`${azul("baixar ")} ${remoto.slug} ${cinza(remoto.titulo)}`);
  }
  for (const { slug } of plano.apagarNoServidor) {
    linhas.push(`${amarelo("apagar ")} ${slug} ${cinza("(apagado aqui)")}`);
  }
  for (const { caminho } of plano.apagarLocal) {
    linhas.push(`${amarelo("remover")} ${caminho} ${cinza("(apagado na nuvem)")}`);
  }
  for (const { slug } of plano.conflitos) {
    linhas.push(`${vermelho("conflito")} ${slug} ${cinza("mudou nos dois lados")}`);
  }

  if (linhas.length === 0) {
    console.log(verde("tudo em dia."), cinza(`${plano.iguais} item(ns)`));
    return plano;
  }

  console.log(linhas.join("\n"));
  console.log(cinza(`\n${plano.iguais} item(ns) sem mudança`));

  if (plano.conflitos.length > 0) {
    console.log(
      cinza(
        "\nconflito = editado aqui e na nuvem. Resolva com:" +
          "\n  nuvem pull --forcar   (vale a versão da nuvem; sua cópia vira .local.md)" +
          "\n  nuvem push --forcar   (vale a sua versão daqui)",
      ),
    );
  }

  return plano;
}

async function comandoPush(opcoes) {
  const cofre = await abrirCofre();
  const plano = await comparar(cofre);

  const envios = [];

  for (const arquivo of plano.novos) {
    envios.push({
      arquivo,
      corpo: {
        slug_sugerido: paraSlug(
          arquivo.titulo || path.basename(arquivo.caminho, ".md"),
        ),
        titulo: arquivo.titulo,
        tipo: arquivo.tipo,
        status: arquivo.status,
        tags: arquivo.tags,
        conteudo: arquivo.conteudo,
      },
    });
  }

  for (const { arquivo, baseHash } of plano.enviar) {
    envios.push({
      arquivo,
      corpo: {
        slug: arquivo.slug,
        base_hash: baseHash,
        titulo: arquivo.titulo,
        tipo: arquivo.tipo,
        status: arquivo.status,
        tags: arquivo.tags,
        conteudo: arquivo.conteudo,
      },
    });
  }

  if (opcoes.forcar) {
    for (const { arquivo, remoto } of plano.conflitos) {
      if (!arquivo) continue;

      envios.push({
        arquivo,
        corpo: {
          slug: arquivo.slug || remoto.slug,
          titulo: arquivo.titulo,
          tipo: arquivo.tipo,
          status: arquivo.status,
          tags: arquivo.tags,
          conteudo: arquivo.conteudo,
        },
      });
    }
  }

  const remocoes = opcoes.apagar ? plano.apagarNoServidor : [];

  if (envios.length === 0 && remocoes.length === 0) {
    console.log(verde("nada pra enviar."));

    if (plano.apagarNoServidor.length > 0) {
      console.log(
        cinza(
          `${plano.apagarNoServidor.length} arquivo(s) apagado(s) aqui. Pra apagar na nuvem também: nuvem push --apagar`,
        ),
      );
    }

    if (plano.conflitos.length > 0) {
      console.log(vermelho(`${plano.conflitos.length} conflito(s).`), cinza("veja: nuvem status"));
    }

    return;
  }

  const { resultados } = await api(cofre, "/api/sync", {
    method: "POST",
    body: JSON.stringify({
      itens: envios.map((envio) => envio.corpo),
      apagar: remocoes.map(({ slug, baseHash }) => ({
        slug,
        base_hash: baseHash,
      })),
      forcar: Boolean(opcoes.forcar),
    }),
  });

  let enviados = 0;
  let recusados = 0;

  for (const resultado of resultados) {
    const envio = envios[resultado.indice];

    if (resultado.acao === "conflito") {
      recusados++;
      console.log(
        `${vermelho("conflito")} ${resultado.slug} ${cinza("mudou na nuvem enquanto isso")}`,
      );
      continue;
    }

    if (resultado.acao === "ausente") {
      recusados++;
      console.log(
        `${vermelho("recusado")} ${envio?.arquivo.caminho ?? resultado.slug} ${cinza("(falta título)")}`,
      );
      continue;
    }

    if (!envio) {
      // Veio da lista de remoções.
      if (resultado.acao === "apagado") {
        delete cofre.estado.itens[resultado.slug];
        enviados++;
        console.log(`${amarelo("apagado")} ${resultado.slug}`);
      }
      continue;
    }

    const arquivo = envio.arquivo;
    let caminho = arquivo.caminho;
    let hashArquivo = arquivo.hash;

    // Item novo: o servidor decidiu o slug final. Grava ele no arquivo pra
    // este arquivo e aquele item ficarem ligados pra sempre.
    if (!arquivo.slug) {
      const texto = escreverFrontmatter({
        titulo: arquivo.titulo,
        tipo: arquivo.tipo,
        status: arquivo.status,
        tags: arquivo.tags,
        slug: resultado.slug,
        conteudo: arquivo.conteudo,
      });

      const destino = caminhoDoItem({ tipo: arquivo.tipo, slug: resultado.slug });
      await mkdir(path.dirname(path.join(cofre.raiz, destino)), { recursive: true });
      await writeFile(path.join(cofre.raiz, destino), texto, "utf8");

      if (destino !== arquivo.caminho) {
        await rm(path.join(cofre.raiz, arquivo.caminho), { force: true });
      }

      caminho = destino;
      hashArquivo = hashTexto(texto);
    }

    cofre.estado.itens[resultado.slug] = {
      caminho,
      arquivoHash: hashArquivo,
      servidorHash: resultado.hash,
    };

    if (resultado.acao !== "igual") {
      enviados++;
      const etiqueta = resultado.acao === "criado" ? verde("criado ") : verde("enviado");
      console.log(`${etiqueta} ${caminho}`);
    }
  }

  for (const slug of plano.esquecer) delete cofre.estado.itens[slug];
  await salvarEstado(cofre);

  console.log(
    `\n${forte(`${enviados} enviado(s)`)}` +
      (recusados ? vermelho(`, ${recusados} recusado(s)`) : ""),
  );

  if (recusados) {
    console.log(cinza("pra resolver: nuvem pull (traz a versão da nuvem) ou nuvem push --forcar"));
  }
}

async function comandoPull(opcoes) {
  const cofre = await abrirCofre();
  const plano = await comparar(cofre);

  const baixar = [...plano.baixar];

  if (opcoes.forcar) {
    for (const conflito of plano.conflitos) baixar.push(conflito.remoto);
  }

  const remover = opcoes.apagar ? plano.apagarLocal : [];

  if (baixar.length === 0 && remover.length === 0) {
    console.log(verde("nada pra baixar."));

    if (plano.apagarLocal.length > 0) {
      console.log(
        cinza(
          `${plano.apagarLocal.length} item(ns) apagado(s) na nuvem. Pra remover o arquivo aqui: nuvem pull --apagar`,
        ),
      );
    }

    if (plano.conflitos.length > 0) {
      console.log(vermelho(`${plano.conflitos.length} conflito(s).`), cinza("veja: nuvem status"));
    }

    return;
  }

  const { itens } = await api(cofre, "/api/sync?completo=1");
  const completos = new Map(itens.map((item) => [item.slug, item]));

  let escritos = 0;

  for (const alvo of baixar) {
    const item = completos.get(alvo.slug);
    if (!item || item.apagado_em) continue;

    const destino = caminhoDoItem(item);
    const completo = path.join(cofre.raiz, destino);
    const registro = cofre.estado.itens[item.slug];

    // Sua versão não some: vira um .local.md ao lado, pra você comparar.
    if (opcoes.forcar && existsSync(completo)) {
      const atual = normalizar(await readFile(completo, "utf8"));

      if (!registro || hashTexto(atual) !== registro.arquivoHash) {
        const backup = completo.replace(/\.md$/, ".local.md");
        await writeFile(backup, atual, "utf8");
        console.log(`${amarelo("guardado")} ${path.relative(cofre.raiz, backup)}`);
      }
    }

    const texto = escreverFrontmatter(item);
    await mkdir(path.dirname(completo), { recursive: true });
    await writeFile(completo, texto, "utf8");

    // Mudou de tipo lá? Some com o arquivo na pasta antiga.
    if (registro && registro.caminho !== destino) {
      await rm(path.join(cofre.raiz, registro.caminho), { force: true });
    }

    cofre.estado.itens[item.slug] = {
      caminho: destino,
      arquivoHash: hashTexto(texto),
      servidorHash: item.hash,
    };

    escritos++;
    console.log(`${azul("baixado")} ${destino}`);
  }

  for (const { slug, caminho } of remover) {
    await rm(path.join(cofre.raiz, caminho), { force: true });
    delete cofre.estado.itens[slug];
    console.log(`${amarelo("removido")} ${caminho}`);
  }

  for (const slug of plano.esquecer) delete cofre.estado.itens[slug];
  await salvarEstado(cofre);

  console.log(`\n${forte(`${escritos} baixado(s)`)}`);
}

async function comandoSync(opcoes) {
  await comandoPull(opcoes);
  console.log("");
  await comandoPush(opcoes);
}

function ajuda() {
  console.log(`
${forte("nuvem")} — seu cofre de projetos, ideias e notas

  ${forte("nuvem login <url> <token>")}   liga esta pasta à sua nuvem
  ${forte("nuvem status")}                o que mudou aqui e o que mudou lá
  ${forte("nuvem push")}                  manda as suas alterações
  ${forte("nuvem pull")}                  traz o que você escreveu pelo celular
  ${forte("nuvem sync")}                  pull e depois push

  opções:
    --apagar    também sincroniza remoções (sem isto, nada é apagado)
    --forcar    resolve conflito: no push vale o daqui, no pull vale o de lá

  os arquivos ficam em projetos/, ideias/, notas/ e referencias/ —
  markdown puro, com um cabeçalho entre --- e ---
`);
}

// ────────────────────────────────────────────────────────────────── início ──

const [comando, ...resto] = process.argv.slice(2);

const opcoes = {
  apagar: resto.includes("--apagar"),
  forcar: resto.includes("--forcar"),
};

const argumentos = resto.filter((valor) => !valor.startsWith("--"));

try {
  switch (comando) {
    case "login":
      await comandoLogin(argumentos);
      break;
    case "status":
      await comandoStatus();
      break;
    case "push":
      await comandoPush(opcoes);
      break;
    case "pull":
      await comandoPull(opcoes);
      break;
    case "sync":
      await comandoSync(opcoes);
      break;
    case undefined:
    case "ajuda":
    case "--help":
    case "-h":
      ajuda();
      break;
    default:
      morrer(`comando desconhecido: ${comando}. Veja: nuvem ajuda`);
  }
} catch (erro) {
  morrer(erro.message);
}
