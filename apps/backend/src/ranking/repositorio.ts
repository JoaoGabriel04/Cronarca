// Ranking (Portão 15). A entrada de cada jogador só muda nos marcos (era,
// ciclo, relíquias), sempre a partir do estado do servidor; o tempo jogado
// acumula no GameState a cada requisição de jogo e vai à entrada no marco.
import {
  chaveRanking, nomePublico, RANKING, somaDeAtividade,
  type AbaRanking, type EstadoJogo, type LinhaRanking, type RespostaRanking,
} from '@cronarca/game-core';
import type { PrismaClient } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';

type Cliente = PrismaClient | Prisma.TransactionClient;

/** A mesma ordem do índice ranking_ordem_idx, mais o id para ficar estável. */
const ORDEM = [
  { era: 'desc' },
  { ciclo: 'desc' },
  { reliquias: 'desc' },
  { marcoEm: 'asc' },
  { userId: 'asc' },
] satisfies Prisma.RankingEntryOrderByWithRelationInput[];

/**
 * Soma ao tempo jogado o intervalo desde a última requisição de jogo (se
 * couber na janela) e marca esta. Se outra requisição gravou no meio, esta
 * não soma nada: perde no máximo um intervalo, nunca conta duas vezes.
 */
export async function registrarAtividade(db: Cliente, userId: string, agora: number): Promise<void> {
  const linha = await db.gameState.findUnique({ where: { userId }, select: { ultimaAtividadeEm: true } });
  if (!linha) return;
  const ultima = linha.ultimaAtividadeEm;
  if (ultima && ultima.getTime() >= agora) return;
  const soma = somaDeAtividade(ultima?.getTime() ?? null, agora, RANKING.janelaAtividadeMs);
  await db.gameState.updateMany({
    where: { userId, ultimaAtividadeEm: ultima },
    data: { ultimaAtividadeEm: new Date(agora), ...(soma > 0 ? { tempoJogado: { increment: soma } } : {}) },
  });
}

/** Convidado não tem entrada no ranking até vincular a conta (Portão B). */
async function eConvidado(db: Cliente, userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { convidado: true } });
  return u?.convidado === true;
}

/** Cria a entrada de um reino novo (todo reino de conta vinculada entra, desde o ciclo 1). Não mexe numa que já exista. */
export async function criarEntrada(db: Cliente, userId: string, estado: EstadoJogo, agora: number): Promise<void> {
  if (await eConvidado(db, userId)) return;
  await db.rankingEntry.createMany({
    data: [{ userId, ...chaveRanking(estado), tempoJogado: 0n, marcoEm: new Date(agora) }],
    skipDuplicates: true,
  });
}

/** Marco: grava a posição nova e o tempo jogado até agora; o marco desempata. */
export async function gravarMarco(db: Cliente, userId: string, estado: EstadoJogo, agora: number): Promise<void> {
  if (await eConvidado(db, userId)) return;
  const { tempoJogado } = await db.gameState.findUniqueOrThrow({ where: { userId }, select: { tempoJogado: true } });
  const dados = { ...chaveRanking(estado), tempoJogado, marcoEm: new Date(agora) };
  await db.rankingEntry.upsert({ where: { userId }, create: { userId, ...dados }, update: dados });
}

type Entrada = { userId: string; era: number; ciclo: number; reliquias: number; tempoJogado: bigint; marcoEm: Date; user: { nome: string } };

function paraLinha(e: Entrada, posicao: number, userId: string): LinhaRanking {
  return {
    posicao,
    nome: nomePublico(e.user.nome),
    era: e.era,
    ciclo: e.ciclo,
    reliquias: e.reliquias,
    tempoJogadoMs: Number(e.tempoJogado),
    voce: e.userId === userId,
  };
}

/** Quem fica à frente de `m` na ordem do ranking. */
function aFrenteDe(m: Entrada): Prisma.RankingEntryWhereInput {
  const { era, ciclo, reliquias, marcoEm } = m;
  return {
    OR: [
      { era: { gt: era } },
      { era, ciclo: { gt: ciclo } },
      { era, ciclo, reliquias: { gt: reliquias } },
      { era, ciclo, reliquias, marcoEm: { lt: marcoEm } },
      { era, ciclo, reliquias, marcoEm, userId: { lt: m.userId } },
    ],
  };
}

/** As primeiras posições (da aba) e a linha de quem pediu, com a posição real. */
export async function listarRanking(prisma: PrismaClient, userId: string, aba: AbaRanking, agora: number): Promise<RespostaRanking> {
  const incluir = { user: { select: { nome: true } } } as const;
  const minha = await prisma.rankingEntry.findUnique({ where: { userId }, include: incluir });
  const era = aba === 'era' ? (minha?.era ?? 1) : null;
  const filtro: Prisma.RankingEntryWhereInput = era === null ? {} : { era };

  const topo = await prisma.rankingEntry.findMany({ where: filtro, orderBy: ORDEM, take: RANKING.tamanhoLista, include: incluir });
  const linhas = topo.map((e, i) => paraLinha(e, i + 1, userId));

  let jogador: LinhaRanking | null = linhas.find((l) => l.voce) ?? null;
  if (!jogador && minha) {
    const antes = await prisma.rankingEntry.count({ where: { AND: [filtro, aFrenteDe(minha)] } });
    jogador = paraLinha(minha, antes + 1, userId);
  }
  return { aba, era, linhas, jogador, geradoEm: agora };
}
