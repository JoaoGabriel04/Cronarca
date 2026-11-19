import { estadoInicial } from '@cronarca/game-core';
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
    expect((await acao('contratar', { classe: 'lanceiro' }, 0)).status).toBe(200);
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
    expect((await acao('contratar', { classe: 'lanceiro' }, 0)).status).toBe(200);
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
    expect((await acao('contratar', { classe: 'lanceiro' }, 1)).status).toBe(409);
  });
});

// Trava por jogador (pg_advisory_xact_lock em apagarProgresso e executarAcao). O teste SEGURA o mesmo lock por fora:
// com ele tomado, o reset e a ação do mesmo jogador têm de ficar esperando (se o reset não tomasse o lock, terminaria
// na hora e o teste falharia). Quando o lock é solto, a ordem de chegada manda, e o ESTADO FINAL é conferido nas duas
// ordens possíveis. Acoplamento consciente: a chave do lock aqui repete a de travarJogador (repositorio.ts).
describe('apagarProgresso com ações do mesmo jogador em paralelo (trava por jogador)', () => {
  const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

  async function segurarLock(userId: string) {
    let soltar!: () => void;
    const solta = new Promise<void>((ok) => (soltar = ok));
    let tomado!: () => void;
    const pronto = new Promise<void>((ok) => (tomado = ok));
    const transacao = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
        tomado();
        await solta;
      },
      { timeout: 30_000 },
    );
    await pronto;
    return { soltar: () => soltar(), transacao };
  }

  /** Dispara agora (o supertest só envia quando alguém o "espera") e marca quando terminou. */
  function disparar<T>(requisicao: PromiseLike<T>) {
    const marca = { terminou: false };
    const resposta = Promise.resolve(requisicao).then((r) => {
      marca.terminou = true;
      return r;
    });
    return { marca, resposta };
  }

  /** Conta com progresso (um aventureiro a mais, rev 1) e 5 min de relógio. */
  async function comProgresso() {
    const j = await jogador();
    await j.a.get('/game/state');
    j.relogio.avancar(5 * MIN);
    expect((await j.acao('contratar', { classe: 'lanceiro' }, 0)).status).toBe(200);
    const antes = await j.doBanco();
    expect(antes.rev).toBe(1);
    expect(antes.estado.aventureiros).toHaveLength(2);
    return j;
  }

  function conferirReinoNovo(estado: Awaited<ReturnType<Awaited<ReturnType<typeof comProgresso>>['doBanco']>>['estado'], agora: number) {
    const inicial = estadoInicial({ semente: 42, agora });
    expect(estado.aventureiros).toHaveLength(1);
    expect(estado.slots.pedreira_1).toEqual(inicial.slots.pedreira_1);
    expect(estado.recursos).toEqual(inicial.recursos);
    expect(estado.t).toBe(agora);
  }

  it('ação chegou ANTES do reset: as duas esperam o lock; depois dele a ação vale e o reset zera tudo (rev 3)', async () => {
    const { userId, relogio, acao, a, doBanco } = await comProgresso();
    const lock = await segurarLock(userId);
    const x = disparar(acao('construir', { slot: 'pedreira_1' }, 1));
    await esperar(200);
    const r = disparar(a.post('/game/reset').send({ confirmacao: 'APAGAR' }));
    await esperar(200);
    // Sem a trava em apagarProgresso o reset terminaria aqui, com o lock ainda preso.
    expect(r.marca.terminou, 'o reset não pode terminar com o lock do jogador preso').toBe(false);
    expect(x.marca.terminou, 'a ação não pode terminar com o lock do jogador preso').toBe(false);

    lock.soltar();
    const [resAcao, resReset] = await Promise.all([x.resposta, r.resposta, lock.transacao]);
    expect(resAcao.status).toBe(200); // aplicada, e logo depois apagada pelo reset
    expect(resAcao.body.rev).toBe(2);
    expect(resReset.status).toBe(200);
    expect(resReset.body.rev).toBe(3);

    const final = await doBanco();
    expect(final.rev).toBe(3); // o rev só sobe, uma vez por escrita
    conferirReinoNovo(final.estado, relogio.agora().getTime());
    expect(final.estado.slots.pedreira_1.obraAte).toBeNull(); // nada da ação sobrou depois do reset
  });

  it('reset chegou ANTES da ação: a ação com o rev antigo vira 409 e não é aplicada depois do reset (rev 2)', async () => {
    const { userId, relogio, acao, a, doBanco } = await comProgresso();
    const lock = await segurarLock(userId);
    const r = disparar(a.post('/game/reset').send({ confirmacao: 'APAGAR' }));
    await esperar(200);
    const x = disparar(acao('construir', { slot: 'pedreira_1' }, 1));
    await esperar(200);
    expect(r.marca.terminou, 'o reset não pode terminar com o lock do jogador preso').toBe(false);
    expect(x.marca.terminou, 'a ação não pode terminar com o lock do jogador preso').toBe(false);

    lock.soltar();
    const [resReset, resAcao] = await Promise.all([r.resposta, x.resposta, lock.transacao]);
    expect(resReset.status).toBe(200);
    expect(resReset.body.rev).toBe(2);
    expect(resAcao.status).toBe(409);
    expect(resAcao.body.erro).toBe('rev_desatualizada');
    expect(resAcao.body.rev).toBe(2);

    const final = await doBanco();
    expect(final.rev).toBe(2); // a recusa não gravou nada
    conferirReinoNovo(final.estado, relogio.agora().getTime());
    expect(final.estado.slots.pedreira_1.obraAte).toBeNull();
  });
});
