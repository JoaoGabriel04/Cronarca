// Construções (handoff: "Dados do jogo" e "Economia v0").
// custoBase = custo do nível 1 (decisão do Portão 4); níveis seguintes pela fórmula.
// producao = unidades por segundo, por nível.
import type { PesquisaId } from './pesquisas.ts';
import type { Recurso } from './recursos.ts';

export const TIPOS_CONSTRUCAO = [
  'casa', 'armazem', 'celeiro', 'serraria', 'pedreira',
  'scriptorium', 'forja', 'mercado', 'taverna', 'muralha',
] as const;
export type TipoConstrucao = (typeof TIPOS_CONSTRUCAO)[number];

export interface DadosConstrucao {
  nome: string;
  efeito: string;
  custoBase: Partial<Record<Recurso, number>>;
  /**
   * Fator de crescimento do custo só desta construção (padrão: FORMULAS.construcao.fatorCusto).
   * Para quem tem custoBase acima do teto base (300) e não caberia no Armazém 10.
   */
  fatorCusto?: number;
  /**
   * Custo só do nível 1 (construir), no lugar de custoBase. O nível 2 em diante
   * segue a fórmula com custoBase.
   */
  custoNivel1?: Partial<Record<Recurso, number>>;
  producao?: { recurso: Recurso; porSegundo: number };
  /**
   * Clique no mapa abre um painel em vez de coletar (handoff: o Scriptorium
   * abre a Pesquisa). Sem isso, a produtora rende o recurso no clique e as
   * demais abrem o Melhorar.
   */
  cliqueAbre?: 'pesquisa';
  /**
   * Pesquisa exigida para construir (Catálogo, estado Bloqueada). Nenhuma
   * construção da v0 tem requisito: o campo existe para as eras futuras.
   */
  requer?: PesquisaId;
}

export const NIVEL_MAXIMO_CONSTRUCAO = 10;

export const CONSTRUCOES: Record<TipoConstrucao, DadosConstrucao> = {
  casa: { nome: 'Casa', efeito: '+4 aldeões por nível', custoBase: { madeira: 120, pedra: 60 } },
  armazem: { nome: 'Armazém', efeito: 'guarda mais recursos', custoBase: { madeira: 150, pedra: 100 } },
  celeiro: { nome: 'Celeiro', efeito: 'guarda mais comida', custoBase: { madeira: 130, pedra: 50 } },
  serraria: {
    nome: 'Serraria', efeito: 'produz madeira', custoBase: { madeira: 210, ferro: 12 },
    producao: { recurso: 'madeira', porSegundo: 1.0 },
  },
  pedreira: {
    nome: 'Pedreira', efeito: 'produz pedra', custoBase: { madeira: 180, ferro: 8 },
    producao: { recurso: 'pedra', porSegundo: 0.8 },
  },
  scriptorium: {
    nome: 'Scriptorium', efeito: 'produz saber', custoBase: { madeira: 160, pedra: 120 },
    producao: { recurso: 'saber', porSegundo: 0.12 }, cliqueAbre: 'pesquisa',
  },
  forja: {
    nome: 'Forja', efeito: 'produz ferro', custoBase: { pedra: 200, madeira: 100 },
    producao: { recurso: 'ferro', porSegundo: 0.15 },
  },
  // Nível 1 sem ouro: é a única fonte passiva de ouro e a conta nova tem só os
  // 40 de ouro que pagam a 1ª contratação (auditoria dos aldeões, opção c2).
  mercado: {
    nome: 'Mercado', efeito: 'rende ouro', custoBase: { madeira: 240, ouro: 40 }, custoNivel1: { madeira: 240 },
    producao: { recurso: 'ouro', porSegundo: 0.04 },
  },
  taverna: { nome: 'Taverna', efeito: '+1 vaga na guilda por nível', custoBase: { madeira: 300, ouro: 60 } },
  // Pedra 400 > 300: com o fator 1,55 a Muralha 9 e 10 passariam do Armazém 10.
  muralha: { nome: 'Muralha', efeito: 'defende a vila de bandidos', custoBase: { pedra: 400, ferro: 40 }, fatorCusto: 1.5 },
};
