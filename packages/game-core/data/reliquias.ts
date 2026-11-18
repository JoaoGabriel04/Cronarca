// Relíquias, a moeda de ascensão (handoff "Dados do jogo").
// custoBase em relíquias; custo do próximo nível pela fórmula.

export const RELIQUIAS_IDS = [
  'maos_calejadas', 'bencao_colheita', 'legado', 'caminhos_eternos', 'sabedoria_ancestral', 'linhagem_heroica',
] as const;
export type ReliquiaId = (typeof RELIQUIAS_IDS)[number];

export interface DadosReliquia {
  nome: string;
  efeito: string;
  nivelMaximo: number;
  custoBase: number;
}

export const RELIQUIAS: Record<ReliquiaId, DadosReliquia> = {
  maos_calejadas: { nome: 'Mãos Calejadas', efeito: '+0,25 por clique em madeira e pedra', nivelMaximo: 10, custoBase: 3 },
  bencao_colheita: { nome: 'Bênção da Colheita', efeito: '+10% de toda a produção', nivelMaximo: 10, custoBase: 5 },
  legado: { nome: 'Legado', efeito: 'cada ciclo começa com 60 madeira, 30 pedra, 40 comida', nivelMaximo: 8, custoBase: 3 },
  caminhos_eternos: { nome: 'Caminhos Eternos', efeito: 'expedições 6% mais rápidas', nivelMaximo: 5, custoBase: 6 },
  sabedoria_ancestral: { nome: 'Sabedoria Ancestral', efeito: '+15% de saber', nivelMaximo: 8, custoBase: 5 },
  linhagem_heroica: { nome: 'Linhagem Heroica', efeito: 'novos aventureiros chegam um nível acima', nivelMaximo: 5, custoBase: 8 },
};
