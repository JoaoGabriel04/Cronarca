import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador, MIN } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('GET /game/state', () => {
  it('exige sessão', async () => {
    const a = agente(criarAppTeste());
    expect((await a.get('/game/state')).status).toBe(401);
    expect((await a.post('/game/actions').send({})).status).toBe(401);
  });

  it('cria o estado na primeira leitura, uma vez só, mesmo com leituras simultâneas', async () => {
    const { a, userId } = await jogador();
    const [r1, r2, r3] = await Promise.all([a.get('/game/state'), a.get('/game/state'), a.get('/game/state')]);
    for (const r of [r1, r2, r3]) {
      expect(r.status).toBe(200);
      expect(r.body.rev).toBe(0);
    }
    expect(await prisma.gameState.count({ where: { userId } })).toBe(1);
    expect(r1.body.estado).toEqual(r2.body.estado);
    expect(r1.body.estado.ciclo).toBe(1);
    expect(r1.body.estado.aventureiros).toHaveLength(1);
  });

  it('o estado novo traz o mapa fixo (A13): só a versão, sem semente de mundo', async () => {
    const { a, doBanco } = await jogador();
    const res = await a.get('/game/state');
    expect(res.body.estado.mundo).toEqual({ versaoMapa: 2 });
    expect((await doBanco()).estado.mundo).toEqual({ versaoMapa: 2 });
  });

  it('save de desenvolvimento do esquema 3 (mundo por semente) migra na leitura', async () => {
    const { a, userId, doBanco } = await jogador();
    const atual = (await a.get('/game/state')).body.estado;
    const gravado = (await doBanco()).estado as Record<string, unknown>;
    await prisma.gameState.update({
      where: { userId },
      data: { estado: { ...gravado, versao: 3, mundo: { semente: 7, versaoGerador: 1 } }, versaoEsquema: 3 },
    });
    const res = await a.get('/game/state');
    expect(res.status).toBe(200);
    expect(res.body.estado.mundo).toEqual({ versaoMapa: 1 });
    expect(res.body.estado.recursos).toEqual(atual.recursos);
  });

  it('nunca devolve a parte secreta e não deixa a resposta em cache', async () => {
    const { a } = await jogador();
    const res = await a.get('/game/state');
    expect(res.body.estado).not.toHaveProperty('segredo');
    expect(JSON.stringify(res.body)).not.toMatch(/segredo|"rng"|proximoEventoEm|resultados/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('liquida pelo relógio do servidor a cada leitura, sem gravar', async () => {
    const { a, relogio, doBanco } = await jogador();
    const antes = await a.get('/game/state');
    const gravado = await doBanco();

    relogio.avancar(2 * MIN);
    const depois = await a.get('/game/state');
    expect(depois.body.estado.recursos.madeira).toBeGreaterThan(antes.body.estado.recursos.madeira);
    expect(depois.body.estado.t).toBe(antes.body.estado.t + 2 * MIN);
    expect(depois.body.agora).toBe(relogio.agora().getTime());

    // A liquidação é determinística: a leitura não precisa escrever.
    const aindaGravado = await doBanco();
    expect(aindaGravado.rev).toBe(0);
    expect(aindaGravado.atualizadoEm).toEqual(gravado.atualizadoEm);
  });
});
