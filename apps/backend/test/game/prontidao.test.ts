// GET /game/readiness (Portão 20d-2): prontidão da tropa para uma fase, só leitura.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('GET /game/readiness', () => {
  it('exige sessão', async () => {
    const a = agente(criarAppTeste());
    expect((await a.get('/game/readiness?fase=1')).status).toBe(401);
  });

  it('conta nova, fase 1, com o Lanceiro inicial: poder 33, bloqueada, falta 33 para o mínimo, corpo a corpo', async () => {
    const { a } = await jogador();
    const id = (await a.get('/game/state')).body.estado.aventureiros[0].id as string;
    const r = await a.get(`/game/readiness?fase=1&tropa=${id}`);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({
      fase: 1,
      tropa: [id],
      prontidao: { poder: 33, poderDoEco: 75, minimo: 66, recomendado: 77, falta: 33, estado: 'bloqueada' },
      composicao: 'corpo_a_corpo',
    });
  });

  it('o poder acompanha o equipamento (arma melhorada sobe o poder) e a resposta é determinística', async () => {
    const { a, acao } = await jogador();
    const est = (await a.get('/game/state')).body;
    const id = est.estado.aventureiros[0].id as string;
    const antes = (await a.get(`/game/readiness?fase=1&tropa=${id}`)).body.prontidao.poder as number;
    expect((await acao('melhorar_equipamento', { aventureiro: id, peca: 'arma' }, est.rev)).status).toBe(200);
    const r1 = await a.get(`/game/readiness?fase=1&tropa=${id}`);
    const r2 = await a.get(`/game/readiness?fase=1&tropa=${id}`);
    expect(r1.body.prontidao.poder).toBeGreaterThan(antes);
    expect(r1.body.prontidao).toEqual(r2.body.prontidao);
  });

  it('tropa vazia (sem o parâmetro): poder 0, bloqueada, equilibrada', async () => {
    const { a } = await jogador();
    const r = await a.get('/game/readiness?fase=4');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tropa: [], composicao: 'equilibrada', prontidao: { poder: 0, falta: r.body.prontidao.minimo, estado: 'bloqueada' } });
  });

  it('só leitura: o estado, a revisão e o instante gravados não mudam', async () => {
    const { a, doBanco } = await jogador();
    await a.get('/game/state');
    const id = (await a.get('/game/state')).body.estado.aventureiros[0].id as string;
    const antes = await doBanco();
    for (const fase of [1, 10, 100]) expect((await a.get(`/game/readiness?fase=${fase}&tropa=${id}`)).status).toBe(200);
    const depois = await doBanco();
    expect(depois.estado).toEqual(antes.estado);
    expect(depois.rev).toBe(antes.rev);
    expect(depois.atualizadoEm).toEqual(antes.atualizadoEm);
  });

  it('valida a entrada: fase fora de 1 a 600, não numérica ou ausente; ids repetidos, em excesso ou parâmetros desconhecidos', async () => {
    const { a } = await jogador();
    const id = (await a.get('/game/state')).body.estado.aventureiros[0].id as string;
    for (const q of ['', 'fase=0', 'fase=601', 'fase=-1', 'fase=1.5', 'fase=abc', 'fase=1&x=2', `fase=1&tropa=${id},${id}`, 'fase=1&tropa=a1,a2,a3,a4,a5,a6,a7,a8,a9']) {
      const r = await a.get(`/game/readiness?${q}`);
      expect([q, r.status, r.body.erro]).toEqual([q, 400, 'dados_invalidos']);
    }
    expect((await a.get('/game/readiness?fase=600')).status).toBe(200);
  });

  it('aventureiro que não é do jogador: 404 (só o próprio estado é lido)', async () => {
    const { a } = await jogador();
    const r = await a.get('/game/readiness?fase=1&tropa=a999');
    expect([r.status, r.body.erro]).toEqual([404, 'aventureiro_inexistente']);
  });

  it.todo('fase bloqueada (403 fase_bloqueada) quando a anterior não foi vencida: depende do progresso de campanha, Portão 23 ou 25');
});
