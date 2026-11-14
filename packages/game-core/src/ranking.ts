// Ranking (Portão 15): regras puras usadas pelo servidor (marco, tempo jogado,
// nome público) e pelo cliente (formato da resposta e textos da tabela).
import { z } from 'zod';
import { ABAS_RANKING } from '../data/ranking.ts';

export type AbaRanking = (typeof ABAS_RANKING)[number];

/** Posição de um jogador: o que ordena o ranking (sem o desempate). */
export interface ChaveRanking {
  era: number;
  ciclo: number;
  reliquias: number;
}

/** A chave sai do estado do servidor: relíquias totais (as gastas também contam). */
export function chaveRanking(e: { era: number; ciclo: number; reliquias: { total: number } }): ChaveRanking {
  return { era: e.era, ciclo: e.ciclo, reliquias: e.reliquias.total };
}

/** Mudou a posição (ascensão, era, ciclo ou relíquias)? Então é um marco. */
export function mudouMarco(a: ChaveRanking, b: ChaveRanking): boolean {
  return a.era !== b.era || a.ciclo !== b.ciclo || a.reliquias !== b.reliquias;
}

/**
 * Ordem do ranking: era desc, ciclo desc, relíquias desc, quem chegou primeiro
 * (marco mais antigo) e, por fim, o id (só para a ordem ser estável). A mesma
 * do índice `ranking_ordem_idx` e da consulta do servidor.
 */
export function compararRanking(
  a: ChaveRanking & { marcoEm: number; userId: string },
  b: ChaveRanking & { marcoEm: number; userId: string },
): number {
  return (
    b.era - a.era ||
    b.ciclo - a.ciclo ||
    b.reliquias - a.reliquias ||
    a.marcoEm - b.marcoEm ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
}

/**
 * Milissegundos que uma requisição soma ao tempo jogado: o intervalo desde a
 * anterior, se couber na janela; a primeira requisição e as que voltam de uma
 * pausa longa não somam.
 */
export function somaDeAtividade(ultimaMs: number | null, agoraMs: number, janelaMs: number): number {
  if (ultimaMs === null) return 0;
  const intervalo = agoraMs - ultimaMs;
  return intervalo > 0 && intervalo <= janelaMs ? intervalo : 0;
}

/**
 * Nome mostrado a outros jogadores: o primeiro nome e a inicial do último
 * sobrenome ("Marcos Vieira" → "Marcos V."). O nome completo não sai do servidor.
 */
export function nomePublico(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Aventureiro';
  const primeiro = partes[0]!;
  if (partes.length === 1) return primeiro;
  const inicial = [...partes[partes.length - 1]!][0]!.toLocaleUpperCase('pt-BR');
  return `${primeiro} ${inicial}.`;
}

/** Coluna Tempo: "45 min" abaixo de 1 h, "41h" a partir dela (horas inteiras, para baixo). */
export function formatarTempoJogado(ms: number): string {
  const minutos = Math.floor(Math.max(0, ms) / 60_000);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h`;
}

const esquemaLinha = z.strictObject({
  posicao: z.number().int().min(1),
  nome: z.string(),
  era: z.number().int().min(1),
  ciclo: z.number().int().min(1),
  reliquias: z.number().int().min(0),
  tempoJogadoMs: z.number().int().min(0),
  voce: z.boolean(),
});

/** Resposta de GET /ranking. `jogador` é a linha de quem pediu (null se ainda não tem reino). */
export const esquemaRespostaRanking = z.strictObject({
  aba: z.enum(ABAS_RANKING),
  /** Era filtrada na aba "era" (a do jogador); null na Geral. */
  era: z.number().int().min(1).nullable(),
  linhas: z.array(esquemaLinha),
  jogador: esquemaLinha.nullable(),
  /** Instante (relógio do servidor) em que a lista foi lida. */
  geradoEm: z.number().int(),
});

export type LinhaRanking = z.infer<typeof esquemaLinha>;
export type RespostaRanking = z.infer<typeof esquemaRespostaRanking>;
