// Modal Ranking (Portão 15, Figma "Modal Ranking - Desktop/Mobile"): o que a
// tabela mostra a partir da resposta de GET /ranking. Puro e testado.

import { formatarTempoJogado, type AbaRanking, type LinhaRanking, type RespostaRanking } from '@cronarca/game-core';

const ROMANOS = ['I', 'II', 'III', 'IV'];
const romano = (n: number) => ROMANOS[n - 1] ?? String(n);
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const formatarInteiro = (n: number) => numero.format(n);

export type SeloPosicao = 'ouro' | 'prata' | 'bronze' | null;

export interface LinhaTela {
  chave: string;
  posicao: string;
  /** Selo das três primeiras posições (Figma: quadrado dourado, prateado e de bronze). */
  selo: SeloPosicao;
  nome: string;
  era: string;
  ciclo: string;
  reliquias: string;
  tempo: string;
  voce: boolean;
}

const SELOS: SeloPosicao[] = ['ouro', 'prata', 'bronze'];

function paraTela(l: LinhaRanking): LinhaTela {
  return {
    chave: `${l.posicao}-${l.voce ? 'voce' : l.nome}`,
    posicao: String(l.posicao),
    selo: SELOS[l.posicao - 1] ?? null,
    nome: l.nome,
    era: romano(l.era),
    ciclo: formatarInteiro(l.ciclo),
    reliquias: formatarInteiro(l.reliquias),
    tempo: formatarTempoJogado(l.tempoJogadoMs),
    voce: l.voce,
  };
}

export interface DadosRanking {
  linhas: LinhaTela[];
  /** Linha do jogador presa embaixo, depois de "· · ·", quando ele está fora da lista. */
  presa: LinhaTela | null;
  vazio: boolean;
}

export function dadosRanking(r: RespostaRanking): DadosRanking {
  const linhas = r.linhas.map(paraTela);
  const presa = r.jogador && !r.linhas.some((l) => l.voce) ? paraTela(r.jogador) : null;
  return { linhas, presa, vazio: linhas.length === 0 };
}

/** "atualizado agora", "atualizado há 2 min", "atualizado há 1 h". */
export function textoAtualizado(recebidoEm: number, agora: number): string {
  const min = Math.floor(Math.max(0, agora - recebidoEm) / 60_000);
  if (min < 1) return 'atualizado agora';
  if (min < 60) return `atualizado há ${min} min`;
  return `atualizado há ${Math.floor(min / 60)} h`;
}

export interface AbaTela {
  id: AbaRanking | 'amigos';
  rotulo: string;
  /** Amigos: sem sistema de amigos na v0 ("Em breve"). */
  ativa: boolean;
}

/** Abas do Figma: Geral, a era do jogador e Amigos (desativada). */
export function abasRanking(eraDoJogador: number): AbaTela[] {
  return [
    { id: 'geral', rotulo: 'Geral', ativa: true },
    { id: 'era', rotulo: `Era ${romano(eraDoJogador)}`, ativa: true },
    { id: 'amigos', rotulo: 'Amigos', ativa: false },
  ];
}

export const rotaRanking = (aba: AbaRanking) => `/api/ranking?aba=${aba}`;
