import { randomUUID } from 'node:crypto';
import { duracaoExpedicaoMs, MAPA } from '@cronarca/game-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_JOGO } from '../../src/config.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador, MIN, SEG } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('POST /game/actions: aplicar e recusar', () => {
  it('recusa sem recurso com 422, sem mudar o rev nem gravar o estado', async () => {
    const { a, acao, doBanco } = await jogador();
    await a.get('/game/state');
    const res = await acao('construir', { slot: 'pedreira_1' }, 0);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ ok: false, erro: 'recursos_insuficientes', rev: 0 });
    expect(res.body.estado.slots.pedreira_1.nivel).toBe(0);
    expect((await doBanco()).rev).toBe(0);
  });

  it('aplica com o relógio do servidor, cobra e sobe o rev', async () => {
    const { a, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');
    relogio.avancar(5 * MIN);
    const antes = (await a.get('/game/state')).body.estado;

    const res = await acao('construir', { slot: 'pedreira_1' }, 0);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, rev: 1, repetida: false });
    expect(res.body.estado.slots.pedreira_1.obraAte).not.toBeNull();
    expect(res.body.estado.recursos.madeira).toBeLessThan(antes.recursos.madeira);
    expect(res.body.estado.recursos.ferro).toBeLessThan(antes.recursos.ferro);

    const gravado = await doBanco();
    expect(gravado.rev).toBe(1);
    expect(gravado.estado.slots.pedreira_1.obraAte).toBe(res.body.estado.slots.pedreira_1.obraAte);
    expect(gravado.atualizadoEm.getTime()).toBe(relogio.agora().getTime());
  });

  it('rev velho: 409 com o estado e o rev atuais', async () => {
    const { a, relogio, acao } = await jogador();
    await a.get('/game/state');
    relogio.avancar(5 * MIN);
    await acao('construir', { slot: 'pedreira_1' }, 0);

    const res = await acao('contratar', {}, 0);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ erro: 'rev_desatualizada', rev: 1 });
    expect(res.body.estado.slots.pedreira_1.obraAte).not.toBeNull();
  });

  it('a ascensão passa pelo mesmo caminho e é recusada sem os objetivos', async () => {
    const { a, acao } = await jogador();
    await a.get('/game/state');
    const res = await acao('ascender', {}, 0);
    expect(res.status).toBe(422);
    expect(res.body.erro).toBe('objetivos_pendentes');
  });
});

describe('POST /game/actions: idempotência e concorrência', () => {
  it('a mesma chave repetida devolve a mesma resposta e não cobra de novo', async () => {
    const { a, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');
    relogio.avancar(5 * MIN);
    const chave = randomUUID();

    const r1 = await acao('construir', { slot: 'pedreira_1' }, 0, chave);
    const depois1 = await doBanco();
    const r2 = await acao('construir', { slot: 'pedreira_1' }, 0, chave);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ ok: true, repetida: true, rev: 1 });
    expect(await doBanco()).toEqual(depois1);
    expect(await prisma.actionLog.count()).toBe(1);
  });

  it('a mesma chave enviada em paralelo é aplicada uma vez só', async () => {
    const { a, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');
    relogio.avancar(5 * MIN);
    const chave = randomUUID();

    const respostas = await Promise.all([1, 2, 3].map(() => acao('construir', { slot: 'pedreira_1' }, 0, chave)));
    for (const r of respostas) {
      expect(r.status).toBe(200);
      expect(r.body.rev).toBe(1);
    }
    expect(respostas.filter((r) => r.body.repetida === false)).toHaveLength(1);
    expect((await doBanco()).rev).toBe(1);
    expect(await prisma.actionLog.count()).toBe(1);
  });

  it('chaves diferentes com o mesmo rev em paralelo: uma vence, as outras recebem 409', async () => {
    const { a, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');
    relogio.avancar(10 * MIN);

    const respostas = await Promise.all([
      acao('construir', { slot: 'pedreira_1' }, 0),
      acao('construir', { slot: 'serraria_2' }, 0),
      acao('contratar', {}, 0),
    ]);
    const status = respostas.map((r) => r.status).sort();
    expect(status.filter((s) => s === 200)).toHaveLength(1);
    expect(status.filter((s) => s === 409)).toHaveLength(2);
    expect((await doBanco()).rev).toBe(1);
  });

  it('uma recusa fica guardada: reenviar a mesma chave recebe a mesma recusa', async () => {
    const { a, relogio, acao } = await jogador();
    await a.get('/game/state');
    const chave = randomUUID();
    expect((await acao('construir', { slot: 'pedreira_1' }, 0, chave)).status).toBe(422);

    relogio.avancar(5 * MIN); // agora daria para pagar
    const res = await acao('construir', { slot: 'pedreira_1' }, 0, chave);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ ok: false, erro: 'recursos_insuficientes', repetida: true });
    expect((await acao('construir', { slot: 'pedreira_1' }, 0)).status).toBe(200);
  });
});

describe('POST /game/actions: entrada', () => {
  it('recusa o que não for intenção válida', async () => {
    const { a, acao } = await jogador();
    const base = { idempotencyKey: randomUUID(), revEsperada: 0 };
    const casos = [
      [await acao('construir', { slot: 'pedreira_1', nivel: 10 }, 0), 'acao_invalida'],
      [await acao('construir', { slot: 'castelo_9' }, 0), 'acao_invalida'],
      [await acao('ganhar_ouro', { quantidade: 1e9 }, 0), 'acao_invalida'],
      [await acao('clicar', { objeto: 'serraria_1', quantidade: 10_000 }, 0), 'acao_invalida'],
      [await a.post('/game/actions').send({ ...base, tipo: 'contratar', dados: {}, recursos: { ouro: 1e9 } }), 'dados_invalidos'],
      [await a.post('/game/actions').send({ ...base, tipo: 'contratar', idempotencyKey: 'abc' }), 'dados_invalidos'],
      [await a.post('/game/actions').send({ tipo: 'contratar', idempotencyKey: randomUUID() }), 'dados_invalidos'],
    ] as const;
    for (const [res, erro] of casos) {
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe(erro);
    }
    expect(await prisma.actionLog.count()).toBe(0);
  });

  it('recusa requisição de outra origem', async () => {
    const { a } = await jogador();
    const res = await a
      .post('/game/actions')
      .set('Origin', 'https://outro.site')
      .send({ tipo: 'contratar', dados: {}, idempotencyKey: randomUUID(), revEsperada: 0 });
    expect(res.status).toBe(403);
  });

  it('limita o número de requisições por usuário', async () => {
    const { a, relogio, acao } = await jogador();
    await a.get('/game/state');
    const N = CONFIG_JOGO.limiteAcoesPorJanela;
    for (let i = 0; i < N; i++) expect((await acao('contratar', {}, 99)).status).toBe(409);
    const bloqueada = await acao('contratar', {}, 99);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.headers['retry-after']).toBeDefined();

    relogio.avancar(CONFIG_JOGO.limiteAcoesJanelaMs);
    expect((await acao('contratar', {}, 99)).status).toBe(409);
  });
});

describe('POST /game/actions: cliques e sorteios', () => {
  it('cliques em lote: o servidor limita ao que o tempo permite', async () => {
    const { a, relogio, acao } = await jogador();
    await a.get('/game/state');

    const r1 = await acao('clicar', { objeto: 'serraria_1', quantidade: 100 }, 0);
    expect(r1.status).toBe(200);
    expect(r1.body.cliquesAceitos).toBe(5); // limite por objeto (5/s), dos dados do game-core

    const r2 = await acao('clicar', { objeto: 'serraria_1', quantidade: 100 }, 1);
    expect(r2.status).toBe(422);
    expect(r2.body.erro).toBe('limite_cliques');

    relogio.avancar(SEG);
    const r3 = await acao('clicar', { objeto: 'serraria_1', quantidade: 3 }, 1);
    expect(r3.body).toMatchObject({ ok: true, cliquesAceitos: 3, rev: 2 });

    const r4 = await acao('clicar', { objeto: 'arvore_inexistente', quantidade: 1 }, 2);
    expect(r4.status).toBe(422);
    expect(r4.body.erro).toBe('objeto_invalido');
  });

  it('clique em árvore e pedra do mapa: o servidor confere o objeto na lista clicaveis do meta', async () => {
    const { a, acao } = await jogador();
    const inicial = (await a.get('/game/state')).body.estado;
    const arvore = MAPA.clicaveis.find((o) => o.tipo === 'arvore')!;
    const pedra = MAPA.clicaveis.find((o) => o.variante === 'pedra_minerio')!;
    const flores = MAPA.props.find((o) => o.tipo === 'flores')!;

    const r1 = await acao('clicar', { objeto: arvore.id, quantidade: 1 }, 0);
    expect(r1.status).toBe(200);
    expect(r1.body.estado.recursos.madeira).toBeGreaterThan(inicial.recursos.madeira);
    const r2 = await acao('clicar', { objeto: pedra.id, quantidade: 1 }, 1);
    expect(r2.status).toBe(200);
    expect(r2.body.estado.recursos.pedra).toBeGreaterThan(inicial.recursos.pedra);

    const naoClicavel = await acao('clicar', { objeto: flores.id, quantidade: 1 }, 2);
    expect(naoClicavel.status).toBe(422);
    expect(naoClicavel.body.erro).toBe('objeto_invalido');
    const inexistente = await acao('clicar', { objeto: 'a9999', quantidade: 1 }, 2);
    expect(inexistente.body.erro).toBe('objeto_invalido');
  });

  it('o resultado da expedição é sorteado na partida e só aparece na volta', async () => {
    const { a, relogio, acao, doBanco } = await jogador();
    await a.get('/game/state');

    const res = await acao('partir_expedicao', { destino: 'floresta_lobos', grupo: ['a1'] }, 0);
    expect(res.status).toBe(200);
    expect(res.body.estado.expedicoes).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/vitoria|saque|feridos|resultados|segredo/);

    // O sorteio já está guardado no servidor.
    const gravado = await doBanco();
    const id = res.body.estado.expedicoes[0].id as string;
    expect(gravado.estado.segredo.resultados[id]).toBeDefined();

    relogio.avancar(duracaoExpedicaoMs('floresta_lobos', 0) + SEG);
    const volta = (await a.get('/game/state')).body.estado;
    expect(volta.expedicoes).toHaveLength(0);
    expect(volta.aventureiros[0].estado).not.toBe('em_expedicao');
  });

  it('o cliente não escolhe o sorteio: mesma semente e mesmas ações dão o mesmo resultado', async () => {
    const resultados = [];
    for (let i = 0; i < 2; i++) {
      await limparBanco();
      const { a, acao, doBanco } = await jogador();
      await a.get('/game/state');
      await acao('partir_expedicao', { destino: 'floresta_lobos', grupo: ['a1'] }, 0);
      resultados.push((await doBanco()).estado.segredo.resultados);
    }
    expect(resultados[0]).toEqual(resultados[1]);
  });
});
