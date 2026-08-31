/**
 * Freio de tentativas de senha.
 *
 * Fica na memória do processo. Em serverless isso significa que o contador não
 * é compartilhado entre instâncias — e tudo bem: o objetivo não é bloqueio
 * militar, é tirar do ataque a velocidade de milhares de tentativas por minuto.
 * Se um dia virar problema de verdade, o lugar certo é uma tabela no banco.
 */

const tentativas = new Map<string, { falhas: number; ate: number }>();

const LIMITE = 8;
const JANELA_MS = 10 * 60 * 1000;

export function bloqueado(chave: string) {
  const registro = tentativas.get(chave);
  if (!registro) return false;

  if (Date.now() > registro.ate) {
    tentativas.delete(chave);
    return false;
  }

  return registro.falhas >= LIMITE;
}

export function registrarFalha(chave: string) {
  const agora = Date.now();
  const registro = tentativas.get(chave);

  if (!registro || agora > registro.ate) {
    tentativas.set(chave, { falhas: 1, ate: agora + JANELA_MS });
    return;
  }

  registro.falhas += 1;
}

export function limparFalhas(chave: string) {
  tentativas.delete(chave);
}
