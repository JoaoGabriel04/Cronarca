// Portão 22 ponta a ponta: contratar com a classe escolhida, Alojamento atravessando a ascensão e save do esquema 10.
import { randomUUID } from 'node:crypto';
import { CLASSES, micro, VERSAO_ESQUEMA } from '@cronarca/game-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste, criarRelogio } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador, MIN } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

async function comRecursos(j: Awaited<ReturnType<typeof jogador>>) {
  await j.a.get('/game/state');
  const base = await j.doBanco();
  const e = structuredClone(base.estado);
  e.recursos.ouro = micro(5000);
  e.recursos.comida = micro(250);
  await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: e as never } });
  return base.rev;
}

describe('POST /game/actions: contratar com classe', () => {
  it('sem classe (cliente antigo) ou com classe inválida: 400 acao_invalida, nada é cobrado', async () => {
    const j = await jogador();
    const rev = await comRecursos(j);
    for (const dados of [{}, { classe: 'ladino' }, { classe: 'lanceiro', nivel: 20 }]) {
      const r = await j.acao('contratar', dados, rev);
      expect(r.status).toBe(400);
      expect(r.body.erro).toBe('acao_invalida');
    }
    expect((await j.doBanco()).estado.aventureiros).toHaveLength(1);
  });

  it('cada uma das quatro classes: o servidor grava a classe pedida, fora do Alojamento, e cobra o custo de sempre', async () => {
    const j = await jogador();
    let rev = await comRecursos(j);
    const antes = (await j.doBanco()).estado.recursos.ouro;
    for (const classe of CLASSES.slice(0, 3)) {
      const r = await j.acao('contratar', { classe }, rev);
      expect(r.status).toBe(200);
      rev = r.body.rev;
      expect(r.body.estado.aventureiros.at(-1)).toMatchObject({ classe, alojado: false, nivel: 1 });
    }
    const gravado = (await j.doBanco()).estado;
    expect(gravado.aventureiros.slice(1).map((a) => a.classe)).toEqual(CLASSES.slice(0, 3));
    expect(gravado.contratacoes).toBe(3);
    expect(gravado.recursos.ouro).toBeLessThan(antes);
  });

  it('a mesma chave não contrata duas vezes; a quarta vaga fecha a guilda (422 guilda_cheia)', async () => {
    const j = await jogador();
    const rev = await comRecursos(j);
    const chave = randomUUID();
    const um = await j.acao('contratar', { classe: 'arqueiro' }, rev, chave);
    expect(um.status).toBe(200);
    const repetida = await j.acao('contratar', { classe: 'arqueiro' }, rev, chave);
    expect(repetida.body.repetida).toBe(true);
    expect((await j.doBanco()).estado.aventureiros).toHaveLength(2);
    let r = um.body.rev as number;
    for (const classe of ['cavaleiro', 'mago_do_tempo']) r = (await j.acao('contratar', { classe }, r)).body.rev;
    const cheia = await j.acao('contratar', { classe: 'lanceiro' }, r);
    expect(cheia.status).toBe(422);
    expect(cheia.body.erro).toBe('guilda_cheia');
  });
});

describe('Alojamento atravessa a ascensão (servidor)', () => {
  async function prepararAscensao(j: Awaited<ReturnType<typeof jogador>>) {
    await j.a.get('/game/state');
    const base = await j.doBanco();
    const e = structuredClone(base.estado);
    e.qg = { estado: 'reerguido', desde: e.t, nivel: 1 };
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    const molde = e.aventureiros[0]!;
    e.aventureiros = [2, 9, 6, 12, 4].map((nivel, i) => ({ ...molde, id: `a${i + 1}`, nome: `Heroi ${i + 1}`, nivel, classe: CLASSES[i % 4]! }));
    e.proximoId = 20;
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: e as never } });
    return base.rev;
  }

  it('os 3 mais fortes ficam alojados no ciclo 2, com os mesmos ids; o resto sai da guilda; F5 mostra o mesmo', async () => {
    const j = await jogador();
    const rev = await prepararAscensao(j);
    j.relogio.avancar(MIN);
    const r = await j.acao('ascender', {}, rev);
    expect(r.status).toBe(200);
    expect(r.body.estado.ciclo).toBe(2);
    const ficaram = r.body.estado.aventureiros as { id: string; nivel: number; alojado: boolean }[];
    expect(ficaram.map((a) => a.id).sort()).toEqual(['a2', 'a3', 'a4']);
    expect(ficaram.every((a) => a.alojado)).toBe(true);
    const gravado = (await j.doBanco()).estado;
    expect(gravado.aventureiros.map((a) => a.id).sort()).toEqual(['a2', 'a3', 'a4']);
    expect(gravado.qg).toMatchObject({ estado: 'reerguido', nivel: 1 });
    expect(gravado.cronica.filter((l) => /deixou a guilda/.test(l.texto))).toHaveLength(2);
    expect((await j.a.get('/game/state')).body.estado.aventureiros).toHaveLength(3);
    // E dá para contratar 4 novos na Taverna sem tocar no Alojamento.
    let rv = (await j.a.get('/game/state')).body.rev as number;
    const e = structuredClone(gravado);
    e.recursos.ouro = micro(5000);
    e.recursos.comida = micro(250);
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: e as never } });
    for (let i = 0; i < 4; i++) {
      const c = await j.acao('contratar', { classe: 'lanceiro' }, rv);
      expect(c.status, `contratação ${i + 1}`).toBe(200);
      rv = c.body.rev;
    }
    expect((await j.acao('contratar', { classe: 'lanceiro' }, rv)).body.erro).toBe('guilda_cheia');
  });

  it('convidado: o mesmo caminho', async () => {
    const relogio = criarRelogio();
    const a = agente(criarAppTeste({ agora: relogio.agora }));
    const c = await a.post('/auth/convidado').send({});
    expect(c.status).toBe(201);
    const userId = c.body.usuario.id as string;
    await a.get('/game/state');
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    const e = structuredClone(linha.estado) as any;
    e.qg = { estado: 'reerguido', desde: e.t, nivel: 1 };
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' }));
    e.aventureiros = [3, 7].map((nivel, i) => ({ ...e.aventureiros[0], id: `a${i + 1}`, nome: `Heroi ${i + 1}`, nivel }));
    await prisma.gameState.update({ where: { userId }, data: { estado: e } });
    relogio.avancar(MIN);
    const r = await a.post('/game/actions').send({ tipo: 'ascender', dados: {}, idempotencyKey: randomUUID(), revEsperada: linha.rev });
    expect(r.status).toBe(200);
    expect(r.body.estado.aventureiros.map((x: { id: string }) => x.id).sort()).toEqual(['a1', 'a2']);
    expect(r.body.estado.aventureiros.every((x: { alojado: boolean }) => x.alojado)).toBe(true);
  });
});

describe('save do esquema 10 no banco', () => {
  it('é lido e migrado (alojado false, QG com nível) e a próxima ação grava no esquema 12', async () => {
    const j = await jogador();
    await j.a.get('/game/state');
    const base = await j.doBanco();
    const v10 = structuredClone(base.estado) as any;
    v10.versao = 10;
    v10.qg = { estado: 'reerguido', desde: v10.t };
    for (const a of v10.aventureiros) delete a.alojado;
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: v10, versaoEsquema: 10 } });

    const lido = (await j.a.get('/game/state')).body.estado;
    expect(lido.versao).toBe(VERSAO_ESQUEMA);
    expect(lido.qg).toMatchObject({ estado: 'reerguido', nivel: 1 });
    expect(lido.aventureiros.every((a: { alojado: boolean }) => a.alojado === false)).toBe(true);
    // Ler não grava; a ação grava na versão nova.
    expect((await prisma.gameState.findUniqueOrThrow({ where: { userId: j.userId } })).versaoEsquema).toBe(10);
    const r = await j.acao('fechar_prologo', {}, base.rev);
    expect(r.status).toBe(200);
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId: j.userId } });
    expect(linha.versaoEsquema).toBe(12);
    expect((linha.estado as any).aventureiros[0].alojado).toBe(false);
  });
});
