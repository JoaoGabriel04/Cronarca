import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador, MIN } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('POST /game/reset (apagar progresso)', () => {
  it('exige sessão', async () => {
    const a = agente(criarAppTeste());
    expect((await a.post('/game/reset').send({ confirmacao: 'APAGAR' })).status).toBe(401);
  });

  it('sem a palavra exata não apaga nada', async () => {
    const { a, acao, doBanco } = await jogador();
    await a.get('/game/state');
    expect((await acao('contratar', {}, 0)).status).toBe(200);
    const antes = await doBanco();
    for (const corpo of [{}, { confirmacao: 'apagar' }, { confirmacao: 'APAGAR', extra: 1 }]) {
      const r = await a.post('/game/reset').send(corpo);
      expect(r.status).toBe(400);
      expect(r.body.erro).toBe('confirmacao_invalida');
    }
    expect(await doBanco()).toEqual(antes);
  });

  it('recomeça do estado inicial, sobe o rev e volta ao ranking do zero', async () => {
    const { a, userId, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');
    expect((await acao('contratar', {}, 0)).status).toBe(200);
    await prisma.gameState.update({
      where: { userId },
      data: { estado: { ...(await doBanco()).estado, reliquias: { total: 9, gastas: 3, niveis: { legado: 1 } } } as never },
    });
    await prisma.rankingEntry.update({ where: { userId }, data: { ciclo: 2, reliquias: 9, tempoJogado: 999n } });
    await prisma.gameState.update({ where: { userId }, data: { tempoJogado: 999n } });
    relogio.avancar(5 * MIN);

    const r = await a.post('/game/reset').send({ confirmacao: 'APAGAR' });
    expect(r.status).toBe(200);
    expect(r.body.rev).toBe(2);
    expect(r.body.estado.ciclo).toBe(1);
    expect(r.body.estado.aventureiros).toHaveLength(1);
    expect(r.body.estado.reliquias).toEqual({ total: 0, gastas: 0, niveis: {} });
    expect(r.body.estado).not.toHaveProperty('segredo');

    const gravado = await doBanco();
    expect(gravado.rev).toBe(2);
    expect(gravado.estado.t).toBe(relogio.agora().getTime());
    const entrada = await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } });
    expect(entrada).toMatchObject({ era: 1, ciclo: 1, reliquias: 0, tempoJogado: 0n });
    expect(entrada.marcoEm.getTime()).toBe(relogio.agora().getTime());
    expect((await prisma.gameState.findUniqueOrThrow({ where: { userId } })).tempoJogado).toBe(0n);

    // Ações com o rev antigo viram conflito; com o novo, seguem.
    expect((await acao('contratar', {}, 1)).status).toBe(409);
  });
});
