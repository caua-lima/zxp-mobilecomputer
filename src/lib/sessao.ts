/**
 * Sessão e segredos.
 *
 * Um usuário só (você), então nada de tabela de usuários: uma senha no ambiente
 * e um cookie assinado com HMAC. O cookie guarda só a data de validade e a
 * assinatura — não dá pra forjar sem o SESSAO_SEGREDO, e trocar o segredo
 * desconecta todos os aparelhos de uma vez.
 *
 * Tudo aqui usa Web Crypto (e não o `crypto` do Node) de propósito: este
 * arquivo também roda no proxy, que é um ambiente Edge sem os módulos do Node.
 */

export const NOME_COOKIE = "nuvem_sessao";

/** 30 dias. Você não quer digitar senha toda vez que abrir no celular. */
export const DURACAO_SESSAO = 60 * 60 * 24 * 30;

export function acessoConfigurado() {
  return Boolean(process.env.SENHA && process.env.SESSAO_SEGREDO);
}

let chaveCache: Promise<CryptoKey> | null = null;

function chaveHmac(): Promise<CryptoKey> {
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo) throw new Error("SESSAO_SEGREDO não configurado.");

  chaveCache ??= crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return chaveCache;
}

function paraHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function assinar(texto: string) {
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chaveHmac(),
    new TextEncoder().encode(texto),
  );

  return paraHex(assinatura);
}

/**
 * Compara sem vazar tempo.
 *
 * Um `===` sai no primeiro caractere diferente, e essa diferença de tempo é
 * medível pela rede — dá pra descobrir um segredo caractere por caractere.
 * Aqui todo o texto é sempre percorrido.
 */
function iguaisEmTempoConstante(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diferenca === 0;
}

/** Valor pronto pro cookie: validade + assinatura. */
export async function criarSessao(): Promise<string> {
  const validade = Date.now() + DURACAO_SESSAO * 1000;
  return `${validade}.${await assinar(String(validade))}`;
}

export async function sessaoValida(valor: string | undefined): Promise<boolean> {
  if (!valor || !process.env.SESSAO_SEGREDO) return false;

  const [validade, assinatura] = valor.split(".");
  if (!validade || !assinatura) return false;

  const expiraEm = Number(validade);
  if (!Number.isFinite(expiraEm) || expiraEm < Date.now()) return false;

  return iguaisEmTempoConstante(assinatura, await assinar(validade));
}

/** Confere a senha do painel. Compara digests pra não vazar o tamanho da senha. */
export async function senhaConfere(tentativa: string): Promise<boolean> {
  const senha = process.env.SENHA;
  if (!senha || !tentativa) return false;

  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(tentativa)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(senha)),
  ]);

  return iguaisEmTempoConstante(paraHex(a), paraHex(b));
}

/** Confere o token que o CLI manda no header Authorization. */
export async function tokenSyncConfere(cabecalho: string | null) {
  const esperado = process.env.TOKEN_SYNC;
  if (!esperado || !cabecalho) return false;

  const enviado = cabecalho.replace(/^Bearer /i, "").trim();
  if (!enviado) return false;

  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(enviado)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(esperado)),
  ]);

  return iguaisEmTempoConstante(paraHex(a), paraHex(b));
}
