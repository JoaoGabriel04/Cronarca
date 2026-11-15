// A Falha (Portão 18b; CRONARCA_COMBATE_E_MAPA.md, seção 1.10): um nível por
// era, que começa em 0 e sobe 1 a cada Ascensão, até o máximo. Deixa o ciclo
// seguinte mais difícil. Falha 0 é o jogo de antes. Só números e textos: a
// lógica fica em src/formulas.ts (contas inteiras, em pontos-base).
import type { DestinoId } from './expedicoes.ts';
import type { PesquisaId } from './pesquisas.ts';

export const FALHA = {
  nivelMaximo: 10,
  /** Tempo de obras e pesquisas: +3% por nível. Não mexe em custo. */
  tempoPorNivel: 0.03,
  /** Custo (saber e ouro) das pesquisas da cadeia da Carta Real: +5% por nível. */
  custoPesquisaPorNivel: 0.05,
  pesquisasAfetadas: ['estradas_reais', 'carta_real'] as readonly PesquisaId[],
  /**
   * Perigo da Cripta por nível. 0 por enquanto (decisão do Portão 18b): os
   * aventureiros ainda recomeçam a cada ascensão, e +10 por nível deixaria a
   * Cripta fora de alcance. Liga no Portão 25, quando eles atravessarem a ascensão.
   */
  destinoAfetado: 'cripta' as DestinoId,
  perigoPorNivel: 0,
  perigoMaximo: 170,
} as const;

export const TEXTOS_FALHA = {
  lore: 'A cada recomeço, o Relógio falha mais.',
  noMaximo: 'A Falha já está no máximo: o Relógio não falha mais do que isto.',
} as const;
