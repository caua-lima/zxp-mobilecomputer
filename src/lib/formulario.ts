/** Estado que as ações do servidor devolvem pros formulários do painel. */
export type EstadoForm = {
  erro?: string;
  salvoEm?: number;
};

export const estadoInicial: EstadoForm = {};
