// Portão 21 ponta a ponta: o jogador manda a expedição às Ruínas do Quartel General, as Ruínas aparecem, ele reergue
// pagando, e o estado persiste (F5). Servidor autoritativo: o cliente só manda intenções.
import { randomUUID } from 'node:crypto';
import { DESTINO_QG, duracaoExpedicaoMs, micro, QG } from '@cronarca/game-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste, criarRelogio } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { jogador, MIN, SEG } from './ajuda.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

/**
 * Parte, espera a volta e grava. A leitura (GET) mostra o estado liquidado mas não grava; o que grava é a próxima
 * ação, então uma ação neutra (fechar o prólogo) persiste a volta, como acontece no jogo de verdade.
 */
async function descobrir(j: Awaited<ReturnType<typeof jogador>>) {
  await j.a.get('/game/state');
  const partida = await j.acao('partir_expedicao', { destino: DESTINO_QG, grupo: ['a1'] }, 0);
  expect(partida.status).toBe(200);
  j.relogio.avancar(duracaoExpedicaoMs(DESTINO_QG, 0) + SEG);
  const volta = await j.a.get('/game/state');
  expect((await j.acao('fechar_prologo', {}, volta.body.rev)).status).toBe(200);
  return { partida, volta };
}

describe('descoberta do Quartel General pelo servidor', () => {
  it('o estado novo começa com o QG oculto, e o cliente vê só estado e desde', async () => {
    const { a } = await jogador();
    const r = await a.get('/game/state');
    expect(r.body.estado.qg).toMatchObject({ estado: 'oculto' });
    expect(Object.keys(r.body.estado.qg).sort()).toEqual(['desde', 'estado']);
    expect(r.body.estado.versao).toBe(10);
  });

  it('a expedição conclui e revela as Ruínas, vitória ou recuo; o sorteio segue escondido', async () => {
    const j = await jogador();
    const { partida, volta } = await descobrir(j);
    expect(JSON.stringify(partida.body)).not.toMatch(/vitoria|saque|feridos|resultados|segredo/);
    expect(volta.body.estado.expedicoes).toHaveLength(0);
    expect(volta.body.estado.qg.estado).toBe('ruinas');
    const gravado = (await j.doBanco()).estado;
    expect(gravado.qg.estado).toBe('ruinas');
    expect(gravado.diario).toContain('quartel_general');
    expect(gravado.relatorios.at(-1)?.destino).toBe(DESTINO_QG);
  });

  it('depois de descoberto, ninguém parte de novo para as Ruínas (destino_bloqueado)', async () => {
    const j = await jogador();
    await descobrir(j);
    const rev = (await j.a.get('/game/state')).body.rev as number;
    const r = await j.acao('partir_expedicao', { destino: DESTINO_QG, grupo: ['a1'] }, rev);
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('destino_bloqueado');
  });
});

describe('reerguer o Quartel General', () => {
  const reerguer = (j: Awaited<ReturnType<typeof jogador>>, rev: number, chave?: string) => j.acao('reerguer_qg', {}, rev, chave);

  it('antes de descobrir: 422 qg_indisponivel, sem cobrar', async () => {
    const j = await jogador();
    await j.a.get('/game/state');
    const r = await reerguer(j, 0);
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('qg_indisponivel');
    expect((await j.doBanco()).rev).toBe(0);
  });

  it('sem recursos: 422 recursos_insuficientes e nada muda; com recursos: cobra madeira 80 e pedra 20', async () => {
    const j = await jogador();
    await descobrir(j);
    // Esvazia a pedra no banco (o servidor é a autoridade; aqui o teste monta o cenário).
    const antes = await j.doBanco();
    const pobre = structuredClone(antes.estado);
    pobre.recursos.pedra = micro(5);
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: pobre as never } });
    const recusa = await reerguer(j, antes.rev);
    expect(recusa.status).toBe(422);
    expect(recusa.body.erro).toBe('recursos_insuficientes');
    expect(recusa.body.estado.qg.estado).toBe('ruinas');
    expect((await j.doBanco()).rev).toBe(antes.rev);

    const rico = structuredClone(pobre);
    rico.recursos.madeira = micro(200);
    rico.recursos.pedra = micro(60);
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: rico as never } });
    const ok = await reerguer(j, antes.rev);
    expect(ok.status).toBe(200);
    expect(ok.body.estado.qg.estado).toBe('reerguido');
    // Liquidado até agora: a produção do instante entra, então confere a diferença de custo no estado gravado.
    const gravado = (await j.doBanco()).estado;
    expect(gravado.qg.estado).toBe('reerguido');
    expect(gravado.recursos.pedra).toBe(micro(60) - micro(QG.custoReerguer.pedra));
    expect(gravado.recursos.madeira).toBeGreaterThanOrEqual(micro(200) - micro(QG.custoReerguer.madeira));
  });

  it('a mesma chave repetida devolve a mesma resposta sem cobrar de novo; outra chave recebe qg_indisponivel', async () => {
    const j = await jogador();
    await descobrir(j);
    const base = await j.doBanco();
    const rico = structuredClone(base.estado);
    rico.recursos.madeira = micro(300);
    rico.recursos.pedra = micro(100);
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: rico as never } });

    const chave = randomUUID();
    const um = await reerguer(j, base.rev, chave);
    expect(um.status).toBe(200);
    const depoisDoPrimeiro = await j.doBanco();
    const repetida = await reerguer(j, base.rev, chave);
    expect(repetida.status).toBe(200);
    expect(repetida.body.repetida).toBe(true);
    const aposRepetir = await j.doBanco();
    expect(aposRepetir.rev).toBe(depoisDoPrimeiro.rev);
    expect(aposRepetir.estado.recursos.pedra).toBe(depoisDoPrimeiro.estado.recursos.pedra);

    const outra = await reerguer(j, depoisDoPrimeiro.rev, randomUUID());
    expect(outra.status).toBe(422);
    expect(outra.body.erro).toBe('qg_indisponivel');
    expect((await j.doBanco()).estado.recursos.pedra).toBe(depoisDoPrimeiro.estado.recursos.pedra);
  });

  it('F5: o estado persiste (nova leitura mostra reerguido) e atravessa a leitura como outra sessão', async () => {
    const j = await jogador();
    await descobrir(j);
    const base = await j.doBanco();
    const rico = structuredClone(base.estado);
    rico.recursos.madeira = micro(300);
    rico.recursos.pedra = micro(100);
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: rico as never } });
    expect((await reerguer(j, base.rev)).status).toBe(200);
    j.relogio.avancar(10 * MIN);
    expect((await j.a.get('/game/state')).body.estado.qg.estado).toBe('reerguido');
    // Outra sessão da mesma conta (login pelo e-mail) vê o mesmo estado.
    const outra = agente(criarAppTeste({ agora: j.relogio.agora }));
    expect((await outra.post('/auth/login').send({ email: 'aldric@teste.local', senha: 'fogueira123' })).status).toBe(200);
    expect((await outra.get('/game/state')).body.estado.qg.estado).toBe('reerguido');
  });

  it('convidado: descobre, reergue e persiste igual', async () => {
    const relogio = criarRelogio();
    const app = criarAppTeste({ agora: relogio.agora });
    const a = agente(app);
    const c = await a.post('/auth/convidado').send({});
    expect(c.status).toBe(201);
    const userId = c.body.usuario.id as string;
    await a.get('/game/state');
    const acao = (tipo: string, dados: Record<string, unknown>, rev: number) => a.post('/game/actions').send({ tipo, dados, idempotencyKey: randomUUID(), revEsperada: rev });
    expect((await acao('partir_expedicao', { destino: DESTINO_QG, grupo: ['a1'] }, 0)).status).toBe(200);
    relogio.avancar(duracaoExpedicaoMs(DESTINO_QG, 0) + SEG);
    expect((await a.get('/game/state')).body.estado.qg.estado).toBe('ruinas');
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    const rico = structuredClone(linha.estado) as { recursos: Record<string, number> };
    rico.recursos.madeira = micro(300);
    rico.recursos.pedra = micro(100);
    await prisma.gameState.update({ where: { userId }, data: { estado: rico as never } });
    expect((await acao('reerguer_qg', {}, linha.rev)).status).toBe(200);
    expect((await a.get('/game/state')).body.estado.qg.estado).toBe('reerguido');
  });
});

describe('ascensão mantém o Quartel General', () => {
  it('um save com QG reerguido continua reerguido no ciclo 2', async () => {
    const j = await jogador();
    await j.a.get('/game/state');
    const base = await j.doBanco();
    const pronto = structuredClone(base.estado);
    pronto.qg = { estado: 'reerguido', desde: pronto.t };
    pronto.pesquisas.concluidas.push('carta_real');
    pronto.objetivos.criptaVencida = true;
    pronto.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    await prisma.gameState.update({ where: { userId: j.userId }, data: { estado: pronto as never } });
    j.relogio.avancar(MIN);
    const r = await j.acao('ascender', {}, base.rev);
    expect(r.status).toBe(200);
    expect(r.body.estado.ciclo).toBe(2);
    expect(r.body.estado.qg.estado).toBe('reerguido');
  });
});
