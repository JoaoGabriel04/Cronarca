// Estado de jogo no banco: leitura, criação e aplicação de ações com
// idempotência (ActionLog) e controle de concorrência (rev).
import {
  aplicarAcao, carregarEstado, chaveRanking, estadoInicial, mudouMarco, objetosDoMapa, VERSAO_ESQUEMA,
  type Acao, type ErroAcao, type EstadoJogo,
} from '@cronarca/game-core';
import type { PrismaClient } from '../db.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { criarEntrada, gravarMarco } from '../ranking/repositorio.ts';

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface Registro {
  estado: EstadoJogo;
  rev: number;
}

/** O que fica no ActionLog para repetir a mesma resposta. */
export type ResultadoGuardado =
  | { ok: true; cliquesAceitos?: number }
  | { ok: false; erro: ErroAcao };

export type SaidaAcao =
  | ({ tipo: 'aplicada' | 'recusada' | 'repetida'; resultado: ResultadoGuardado } & Registro)
  | ({ tipo: 'conflito' } & Registro);

const paraJson = (v: unknown) => v as Prisma.InputJsonValue;

/** Árvores e pedras clicáveis (id -> recurso): o mesmo mapa para todos (A13). */
const OBJETOS_DO_MAPA = objetosDoMapa();

/**
 * Fila por jogador: ações e reset da mesma conta passam uma de cada vez. Sem isso, no READ COMMITTED uma
 * requisição podia consultar o log (chave nova), ver a vencedora confirmar e só então ler o estado com rev
 * novo, devolvendo 409 para uma chave que já tinha sido aplicada. O lock vale até o fim da transação.
 */
async function travarJogador(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
}

/** Lê o estado do jogador; se ainda não existe, cria o do início do ciclo. */
export async function obterOuCriarEstado(
  db: Cliente,
  userId: string,
  agora: number,
  sortearSemente: () => number,
): Promise<Registro> {
  let linha = await db.gameState.findUnique({ where: { userId } });
  if (!linha) {
    const inicial = estadoInicial({ semente: sortearSemente(), agora });
    // ON CONFLICT DO NOTHING: duas primeiras leituras ao mesmo tempo criam um só.
    await db.gameState.createMany({
      data: [{ userId, rev: 0, atualizadoEm: new Date(agora), estado: paraJson(inicial), versaoEsquema: VERSAO_ESQUEMA }],
      skipDuplicates: true,
    });
    linha = await db.gameState.findUniqueOrThrow({ where: { userId } });
    // Todo reino entra no ranking desde o ciclo 1 (Portão 15).
    await criarEntrada(db, userId, carregarEstado(linha.estado, linha.versaoEsquema), agora);
  }
  // Estados de esquemas anteriores são migrados na leitura e gravados na versão atual.
  return { estado: carregarEstado(linha.estado, linha.versaoEsquema), rev: linha.rev };
}

class RevMudou extends Error {}

function chaveUnica(erro: unknown) {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

export interface PedidoAcao {
  userId: string;
  acao: Acao;
  idempotencyKey: string;
  revEsperada: number;
  agora: number;
  sortearSemente: () => number;
}

/**
 * Aplica uma ação uma única vez por idempotencyKey. A mesma chave repetida
 * devolve o resultado guardado; rev diferente do esperado é conflito.
 * Recusas também ficam no log, para o reenvio receber a mesma recusa.
 */
export async function executarAcao(prisma: PrismaClient, p: PedidoAcao): Promise<SaidaAcao> {
  const onde = { userId_idempotencyKey: { userId: p.userId, idempotencyKey: p.idempotencyKey } };

  try {
    return await prisma.$transaction(async (tx): Promise<SaidaAcao> => {
      await travarJogador(tx, p.userId);
      const anterior = await tx.actionLog.findUnique({ where: onde });
      const atual = await obterOuCriarEstado(tx, p.userId, p.agora, p.sortearSemente);
      if (anterior) return { tipo: 'repetida', resultado: anterior.resultado as ResultadoGuardado, ...atual };
      if (atual.rev !== p.revEsperada) return { tipo: 'conflito', ...atual };

      // Clique: o servidor confere o objeto na lista `clicaveis` do mapa fixo (A13, seção 5b).
      const opcoes = p.acao.tipo === 'clicar' ? { objetosDoMapa: OBJETOS_DO_MAPA } : {};
      const r = aplicarAcao(atual.estado, p.acao, p.agora, opcoes);
      const log = { userId: p.userId, idempotencyKey: p.idempotencyKey, tipo: p.acao.tipo };

      if (!r.ok) {
        const resultado: ResultadoGuardado = { ok: false, erro: r.erro };
        await tx.actionLog.create({ data: { ...log, resultado: paraJson(resultado), rev: atual.rev } });
        return { tipo: 'recusada', resultado, estado: r.estado, rev: atual.rev };
      }

      const rev = atual.rev + 1;
      // Só grava se ninguém mudou o estado desde a leitura.
      const { count } = await tx.gameState.updateMany({
        where: { userId: p.userId, rev: atual.rev },
        data: { rev, estado: paraJson(r.estado), atualizadoEm: new Date(r.estado.t), versaoEsquema: VERSAO_ESQUEMA },
      });
      if (count === 0) throw new RevMudou();
      // Marco (ascensão, era, ciclo, relíquias): o ranking muda junto, na mesma transação.
      if (mudouMarco(chaveRanking(atual.estado), chaveRanking(r.estado))) {
        await gravarMarco(tx, p.userId, r.estado, p.agora);
      }

      const resultado: ResultadoGuardado =
        r.cliquesAceitos === undefined ? { ok: true } : { ok: true, cliquesAceitos: r.cliquesAceitos };
      await tx.actionLog.create({ data: { ...log, resultado: paraJson(resultado), rev } });
      return { tipo: 'aplicada', resultado, estado: r.estado, rev };
    });
  } catch (erro) {
    if (!(erro instanceof RevMudou) && !chaveUnica(erro)) throw erro;
    // Outra requisição venceu a corrida. Se foi a mesma chave, repete a
    // resposta dela; se não, o cliente estava com rev velho.
    const anterior = await prisma.actionLog.findUnique({ where: onde });
    const atual = await obterOuCriarEstado(prisma, p.userId, p.agora, p.sortearSemente);
    if (anterior) return { tipo: 'repetida', resultado: anterior.resultado as ResultadoGuardado, ...atual };
    return { tipo: 'conflito', ...atual };
  }
}

/**
 * Apaga o progresso da conta (Configurações, zona de risco): estado do início,
 * com sorteios novos e sem relíquias. O rev continua subindo (o
 * cliente descarta estado com rev menor que o que já tem). O reino novo
 * volta ao ranking do zero: ciclo 1, sem relíquias e sem tempo jogado.
 */
export async function apagarProgresso(prisma: PrismaClient, userId: string, agora: number, sortearSemente: () => number): Promise<Registro> {
  return prisma.$transaction(async (tx) => {
    await travarJogador(tx, userId);
    await obterOuCriarEstado(tx, userId, agora, sortearSemente);
    const estado = estadoInicial({ semente: sortearSemente(), agora });
    const linha = await tx.gameState.update({
      where: { userId },
      data: {
        rev: { increment: 1 }, estado: paraJson(estado), atualizadoEm: new Date(agora), versaoEsquema: VERSAO_ESQUEMA,
        tempoJogado: 0n, ultimaAtividadeEm: new Date(agora),
      },
    });
    await gravarMarco(tx, userId, estado, agora);
    return { estado, rev: linha.rev };
  });
}
