"use client";

/**
 * Rede de segurança: qualquer erro no servidor (Firestore fora do ar, projeto
 * ainda sem banco criado) vira esta tela em vez de uma página em branco.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-suave">Alguma coisa quebrou aqui do lado.</p>

      {error.digest && (
        <code className="text-xs text-fraco">{error.digest}</code>
      )}

      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-borda px-4 py-2 text-sm transition-colors hover:border-destaque hover:text-destaque"
      >
        Tentar de novo
      </button>
    </main>
  );
}
