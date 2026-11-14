import { randomUUID } from 'node:crypto';
import { validarEstado, type EstadoJogo } from '@cronarca/game-core';
import { agente, criarAppTeste, criarRelogio } from '../helpers/app.ts';
import { prisma } from '../helpers/prisma.ts';

export const SEG = 1000;
export const MIN = 60 * SEG;

/** App com relógio controlado e um jogador já logado. */
export async function jogador() {
  const relogio = criarRelogio();
  const a = agente(criarAppTeste({ agora: relogio.agora }));
  const res = await a.post('/auth/cadastro').send({ nome: 'Aldric', email: 'aldric@teste.local', senha: 'fogueira123' });
  const userId = res.body.usuario.id as string;

  function acao(tipo: string, dados: Record<string, unknown>, revEsperada: number, idempotencyKey: string = randomUUID()) {
    return a.post('/game/actions').send({ tipo, dados, idempotencyKey, revEsperada });
  }

  async function doBanco(): Promise<{ estado: EstadoJogo; rev: number; atualizadoEm: Date }> {
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    return { estado: validarEstado(linha.estado, linha.versaoEsquema), rev: linha.rev, atualizadoEm: linha.atualizadoEm };
  }

  return { a, userId, relogio, acao, doBanco };
}
