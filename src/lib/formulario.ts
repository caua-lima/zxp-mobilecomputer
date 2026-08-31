/** Estado que as ações do servidor devolvem pros formulários do painel. */
export type EstadoForm = {
  erro?: string;
  salvoEm?: number;
  /**
   * Quando a gravação falhou. O editor usa isto pra não ficar tentando salvar
   * em laço com o banco fora do ar: depois de uma falha, ele espera você mexer
   * no texto de novo (ou clicar em Salvar) antes de tentar outra vez.
   */
  falhouEm?: number;
  /** Preenchido pela captura rápida, pra oferecer o link do item recém-criado. */
  slug?: string;
  titulo?: string;
};

export const estadoInicial: EstadoForm = {};
