// Pesquisas da Era I (handoff, "Economia v0"). Uma por vez. Tempo em segundos.
import type { Recurso } from './recursos.ts';

export const PESQUISAS_IDS = ['hospitalidade', 'cartografia', 'colheita_farta', 'estradas_reais', 'carta_real', 'coletor_1', 'coletor_2'] as const;
export type PesquisaId = (typeof PESQUISAS_IDS)[number];

export interface DadosPesquisa {
  nome: string;
  efeito: string;
  /** Texto do cartão no Modal Pesquisa (Figma). */
  descricao: string;
  custo: Partial<Record<Recurso, number>>;
  segundos: number;
  requer: PesquisaId[];
  /** Ganho por clique que esta pesquisa soma (Portão GPC): só madeira e pedra; ver ganhoCliqueMicro. */
  gpc?: number;
}

export const PESQUISAS: Record<PesquisaId, DadosPesquisa> = {
  hospitalidade: {
    nome: 'Hospitalidade', efeito: '+1 vaga na guilda por Taverna',
    descricao: 'Cada taverna abre uma vaga extra na guilda.',
    custo: { saber: 40 }, segundos: 60, requer: [],
  },
  cartografia: {
    nome: 'Cartografia', efeito: 'abre a Mina e o Pântano',
    descricao: 'Revela a Mina Abandonada e o Pântano Sombrio no mapa.',
    custo: { saber: 60 }, segundos: 90, requer: [],
  },
  colheita_farta: {
    nome: 'Colheita Farta', efeito: '+10% de comida',
    descricao: '+10% de comida produzida.',
    custo: { saber: 30 }, segundos: 120, requer: [],
  },
  estradas_reais: {
    nome: 'Estradas Reais', efeito: 'abre a Cripta',
    descricao: 'Abre a rota da Cripta do Rei Cinzento.',
    custo: { saber: 150, ouro: 40 }, segundos: 120, requer: ['cartografia'],
  },
  carta_real: {
    nome: 'Carta Real', efeito: 'objetivo da Era I',
    descricao: 'Objetivo da Era I: o rei aceita ouvir a guilda.',
    custo: { saber: 300, ouro: 80 }, segundos: 180, requer: ['estradas_reais'],
  },
  // Ofício do coletor (progressão do clique, esquema 12): cada nível soma +1 ao ganho por clique de madeira e pedra.
  // Valores iniciais aprovados em 18/11, a calibrar. O teto da Era I (GPC 3) vale por FORMULAS.clique.tetoGpcPorEra.
  coletor_1: {
    nome: 'Ofício do coletor I', efeito: '+1 por clique (madeira e pedra)',
    descricao: 'Mãos treinadas rendem mais por clique em árvores, pedras, Serraria e Pedreira.',
    custo: { saber: 80 }, segundos: 90, requer: [], gpc: 1,
  },
  coletor_2: {
    nome: 'Ofício do coletor II', efeito: '+1 por clique (madeira e pedra)',
    descricao: 'O ofício vira costume: mais um ponto por clique em madeira e pedra.',
    custo: { saber: 250, ouro: 40 }, segundos: 150, requer: ['coletor_1'], gpc: 1,
  },
};
