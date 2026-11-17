// Destinos de expedição (handoff "Economia v0"; ids da spec do mapa, seção 6).
// Duração em segundos; saque = faixa [mínimo, máximo] por recurso.
import type { PesquisaId } from './pesquisas.ts';
import type { Recurso } from './recursos.ts';
import { TEXTOS_QG } from './qg.ts';

// O das Ruínas do Quartel General vem primeiro: é o que o jogador descobre cedo (Portão 21).
export const DESTINOS_IDS = ['ruinas_qg', 'floresta_lobos', 'ruinas', 'mina', 'pantano', 'cripta'] as const;
export type DestinoId = (typeof DESTINOS_IDS)[number];

export interface DadosDestino {
  nome: string;
  perigo: number;
  segundos: number;
  saque: Partial<Record<Recurso, readonly [number, number]>>;
  requer: PesquisaId | null;
  /** Texto do Figma (tela Expedições). */
  descricao: string;
}

export const TAMANHO_MAXIMO_GRUPO = 3;

/** Faixas de perigo para mostrar ao jogador ("Perigo médio"), pelo perigo do destino. */
export const FAIXAS_PERIGO: readonly { ate: number; nome: string }[] = [
  { ate: 19, nome: 'baixo' },
  { ate: 39, nome: 'médio' },
  { ate: 59, nome: 'alto' },
  { ate: Number.POSITIVE_INFINITY, nome: 'muito alto' },
];

export const DESTINOS: Record<DestinoId, DadosDestino> = {
  ruinas_qg: {
    nome: 'Ruínas do Quartel General', perigo: 6, segundos: 40, requer: null, descricao: TEXTOS_QG.descricaoDestino,
    saque: { pedra: [12, 20], madeira: [15, 25], ouro: [3, 6] },
  },
  floresta_lobos: {
    nome: 'Floresta dos Lobos', perigo: 9, segundos: 30, requer: null, descricao: 'Trilhas de caça cheias de lobos famintos.',
    saque: { madeira: [25, 45], comida: [20, 40], ferro: [4, 9], ouro: [0.4, 1] },
  },
  ruinas: {
    nome: 'Ruínas Esquecidas', perigo: 20, segundos: 55, requer: null, descricao: 'Muros caídos de um povo sem nome.',
    saque: { pedra: [10, 20], ferro: [4, 10], ouro: [9, 20], saber: [1, 2.2] },
  },
  mina: {
    nome: 'Mina Abandonada', perigo: 30, segundos: 120, requer: 'cartografia', descricao: 'Galerias fundas onde ainda se ouve o eco.',
    saque: { pedra: [30, 60], ferro: [8, 16], ouro: [2, 5] },
  },
  pantano: {
    nome: 'Pântano Sombrio', perigo: 48, segundos: 180, requer: 'cartografia', descricao: 'Névoa baixa e coisas que se movem nela.',
    saque: { comida: [20, 40], saber: [3, 6], ouro: [6, 14], ferro: [4, 10] },
  },
  cripta: {
    nome: 'Cripta do Rei Cinzento', perigo: 70, segundos: 300, requer: 'estradas_reais', descricao: 'O primeiro governante do tempo ainda guarda o trono.',
    saque: { ouro: [30, 60], saber: [8, 15], ferro: [10, 20] },
  },
};

/** Textos da gaveta de Destinos no celular (Figma "Gaveta Destinos (aberta)", Portão 14). */
export const TEXTOS_GAVETA_DESTINOS = {
  titulo: 'Destinos',
  abrir: 'Abrir a lista de destinos',
  fechar: 'Fechar a lista de destinos',
  nota: 'Mina e Pântano: Cartografia. Cripta: Estradas Reais.',
  /** Quantos destinos aparecem com a gaveta fechada. */
  fechadaMostra: 2,
} as const;
