import Link from "next/link";

import { ZxpMark } from "@/components/Marca";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <ZxpMark size={44} />
      <p className="text-sm text-suave">
        Esse item não existe (ou foi apagado).
      </p>
      <Link
        href="/"
        className="rounded-lg border border-borda px-4 py-2 text-sm transition-colors hover:border-destaque hover:text-destaque"
      >
        Voltar pra lista
      </Link>
    </main>
  );
}
