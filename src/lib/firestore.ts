/**
 * Conexão com o Firestore, só pelo servidor.
 *
 * Usa o SDK de administrador: ele entra com a chave da conta de serviço e
 * ignora as regras de segurança do banco. É por isso que o banco pode ficar em
 * modo produção, com as regras fechando tudo — o navegador nunca fala com o
 * Firestore; só este servidor fala, e só depois de conferir a sua sessão.
 *
 * Nada aqui roda no navegador, e nenhuma variável tem NEXT_PUBLIC_ no nome de
 * propósito: a chave privada dá acesso total ao banco.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const NOME_COLECAO = "itens";

/**
 * O emulador local (usado nos testes) não pede credencial: basta o endereço
 * dele e um id de projeto qualquer.
 */
function usandoEmulador() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export function bancoConfigurado() {
  if (usandoEmulador()) return Boolean(process.env.FIREBASE_PROJECT_ID);

  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

/**
 * A chave privada chega do ambiente com quebras de linha de duas formas
 * possíveis: reais (campo multilinha da Vercel) ou como o texto "\n" (colada do
 * arquivo JSON). Aceita as duas, e também tolera aspas sobrando nas pontas —
 * erros de colagem que dariam uma mensagem de PEM inválido bem pouco útil.
 */
function chavePrivada() {
  return (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
}

let banco: Firestore | null = null;

export function firestore(): Firestore {
  if (banco) return banco;

  if (!bancoConfigurado()) {
    throw new Error(
      "Firebase não configurado: faltam FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY.",
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID!;

  // getApps() evita criar um segundo app a cada recarga do modo de
  // desenvolvimento, que reexecuta este módulo sem reiniciar o processo.
  const app =
    getApps()[0] ??
    initializeApp(
      usandoEmulador()
        ? { projectId }
        : {
            credential: cert({
              projectId,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
              privateKey: chavePrivada(),
            }),
          },
    );

  banco = getFirestore(app);
  return banco;
}

export function colecao() {
  return firestore().collection(NOME_COLECAO);
}

/** Códigos de erro do Firestore (gRPC) que o domínio trata como situação normal. */
export const ERRO_NAO_ENCONTRADO = 5;
export const ERRO_JA_EXISTE = 6;

export function codigoDoErro(erro: unknown) {
  return (erro as { code?: number | string } | null)?.code;
}
