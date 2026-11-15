// Eventos aleatórios (handoff "Economia v0"). Sorteio no servidor, igual chance entre os 6.

export const EVENTOS_IDS = [
  'mercador_viajante', 'bandidos', 'tempestade', 'festival_colheita', 'incendio', 'cometa',
] as const;
export type EventoId = (typeof EVENTOS_IDS)[number];

export const NOMES_EVENTOS: Record<EventoId, string> = {
  mercador_viajante: 'Mercador Viajante',
  bandidos: 'Bandidos na Estrada',
  tempestade: 'Tempestade',
  festival_colheita: 'Festival da Colheita',
  incendio: 'Incêndio',
  cometa: 'Cometa',
};

/** Intervalo entre eventos, em minutos (sorteio uniforme). */
export const INTERVALO_EVENTOS_MIN = [10, 20] as const;

export const EVENTO_PARAMETROS = {
  /** Mercador: troca e prazo para responder (sem resposta vale Ignorar). */
  mercador: { madeiraPaga: 100, ouroRecebido: 15, prazoSegundos: 120 },
  /** Bandidos: perda sem Muralha (fração de ouro e de comida). */
  bandidos: { perdaOuro: 0.15, perdaComida: 0.15, muralhaMinima: 1 },
  /**
   * Ganhos (Portão 18a): o maior entre o valor fixo e uma fração do teto do
   * recurso, para continuarem valendo com o armazém grande. Com o teto de 300
   * do começo, vale o fixo. O Cometa usa uma fração menor: o saber só serve às
   * pesquisas, que custam 580 no ciclo inteiro.
   */
  tempestade: { madeira: 30, fracaoDoTeto: 0.1 },
  festival_colheita: { comida: 40, fracaoDoTeto: 0.1 },
  /** Perdas não crescem: eventos acontecem também offline. */
  incendio: { perdaMadeira: 0.1 },
  cometa: { saber: 20, fracaoDoTeto: 0.03 },
} as const;
