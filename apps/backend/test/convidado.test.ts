import { randomUUID } from 'node:crypto';
import { reliquiasNaAscensao, validarEstado } from '@cronarca/game-core';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_AUTH, CONFIG_CONVIDADO } from '../src/config.ts';
import { agente, cookiesDe, criarAppTeste, criarRelogio } from './helpers/app.ts';
import { limparBanco, prisma } from './helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const MIN = 60_000;
const HORA = 60 * MIN;

async function novoConvidado(app = criarAppTeste()) {
  const a = agente(app);
  const res = await a.post('/auth/convidado').send({});
  return { a, res, app };
}

describe('POST /auth/convidado: criação', () => {
  it('cria usuário sem e-mail e sem senha, com sessão em cookie httpOnly', async () => {
    const { a, res } = await novoConvidado();
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ email: null, convidado: true, temSenha: false, vinculoPendente: false, provedores: [] });
    expect(res.body.usuario.nome).toMatch(/^Convidado \d{4}$/);
    expect((res.headers['set-cookie'] as unknown as string[]).join()).toMatch(/HttpOnly/);
    expect(cookiesDe(res)[CONFIG_AUTH.cookieSessao]).toBeTruthy();

    const u = await prisma.user.findUniqueOrThrow({ where: { id: res.body.usuario.id } });
    expect(u).toMatchObject({ email: null, senhaHash: null, convidado: true, emailVerificado: false });
    expect((await a.get('/auth/me')).body.usuario.id).toBe(u.id);
  });

  it('recusa corpo com campos a mais (o servidor decide tudo)', async () => {
    const res = await agente(criarAppTeste()).post('/auth/convidado').send({ nome: 'Rei' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('exige a mesma origem, como as demais rotas que mudam estado', async () => {
    const res = await request(criarAppTeste()).post('/auth/convidado').set('Origin', 'http://outro.site').send({});
    expect(res.status).toBe(403);
  });

  it('convidado não entra por senha e não tem entrada no ranking', async () => {
    const { a, res } = await novoConvidado();
    expect((await agente(criarAppTeste()).post('/auth/login').send({ email: 'convidado@teste.local', senha: 'qualquer-coisa' })).status).toBe(401);
    expect((await a.get('/game/state')).status).toBe(200);
    expect(await prisma.gameState.count({ where: { userId: res.body.usuario.id } })).toBe(1);
    expect(await prisma.rankingEntry.count()).toBe(0);
    const r = await a.get('/ranking');
    expect(r.status).toBe(200);
    expect(r.body.jogador).toBeNull();
  });
});

// "Convidado mostra progresso antigo": com uma sessão de verdade e progresso na conta, tocar em "Jogar sem conta"
// cria um usuário NOVO (nunca reaproveita a conta da sessão) e o jogo dele nasce do zero. A conta antiga fica intacta.
// (O cache do navegador, que era a outra metade do problema, é do cliente: o SWR só roda no contêiner do frontend.)
describe('POST /auth/convidado: com sessão ativa', () => {
  it('cria um convidado novo com o jogo do zero e não mexe na conta que estava logada', async () => {
    const relogio = criarRelogio();
    const a = agente(criarAppTeste({ agora: relogio.agora }));
    const cadastro = await a.post('/auth/cadastro').send({ nome: 'Aldric', email: 'aldric@teste.local', senha: 'fogueira123' });
    const antigo = cadastro.body.usuario.id as string;
    expect((await a.get('/game/state')).status).toBe(200);
    relogio.avancar(5 * MIN);
    const contratou = await a.post('/game/actions').send({ tipo: 'contratar', dados: { classe: 'lanceiro' }, idempotencyKey: randomUUID(), revEsperada: 0 });
    expect(contratou.status).toBe(200);
    const antes = await prisma.gameState.findUniqueOrThrow({ where: { userId: antigo } });
    expect(antes.rev).toBe(1);

    // O mesmo agente (o jar de cookies) ainda tem a sessão do Aldric quando pede o convidado.
    expect((await a.get('/auth/me')).body.usuario.id).toBe(antigo);
    const convidado = await a.post('/auth/convidado').send({});
    expect(convidado.status).toBe(201);
    const novo = convidado.body.usuario.id as string;
    expect(novo).not.toBe(antigo);
    expect((await a.get('/auth/me')).body.usuario).toMatchObject({ id: novo, convidado: true });

    const estado = await a.get('/game/state');
    expect(estado.status).toBe(200);
    expect(estado.body.rev).toBe(0);
    expect(estado.body.estado.aventureiros).toHaveLength(1);
    expect(estado.body.estado.slots.pedreira_1.nivel).toBe(0);
    expect(estado.body.estado.reliquias).toEqual({ total: 0, gastas: 0, niveis: {} });

    const depois = await prisma.gameState.findUniqueOrThrow({ where: { userId: antigo } });
    expect(depois.rev).toBe(antes.rev);
    expect(JSON.stringify(depois.estado)).toBe(JSON.stringify(antes.estado));
    expect(await prisma.user.count()).toBe(2);
  });
});

describe('POST /auth/convidado: tetos', () => {
  async function semear(n: number, criadoEm: Date) {
    await prisma.user.createMany({ data: Array.from({ length: n }, (_, i) => ({ nome: `Convidado ${i}`, convidado: true, criadoEm })) });
  }

  it(`teto total de ${CONFIG_CONVIDADO.totalPorJanela} por hora, contado no banco: o reinício não zera`, async () => {
    const relogio = criarRelogio();
    await semear(CONFIG_CONVIDADO.totalPorJanela - 1, relogio.agora());
    const app = criarAppTeste({ agora: relogio.agora });
    expect((await agente(app).post('/auth/convidado').send({})).status).toBe(201); // o 200º
    const bloqueado = await agente(app).post('/auth/convidado').send({});
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro).toBe('convidados_esgotados');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);

    // "Reinício": outro app, outro limitador em memória. O banco ainda manda.
    const reiniciado = criarAppTeste({ agora: relogio.agora });
    expect((await agente(reiniciado).post('/auth/convidado').send({})).status).toBe(429);

    relogio.avancar(HORA + 1);
    expect((await agente(reiniciado).post('/auth/convidado').send({})).status).toBe(201);
  });

  it('só convidados contam no teto (contas comuns não)', async () => {
    const relogio = criarRelogio();
    await prisma.user.createMany({ data: Array.from({ length: 250 }, (_, i) => ({ nome: `U${i}`, email: `u${i}@t.local`, criadoEm: relogio.agora() })) });
    expect((await agente(criarAppTeste({ agora: relogio.agora })).post('/auth/convidado').send({})).status).toBe(201);
  });

  it(`por IP: ${CONFIG_CONVIDADO.porIpPorJanela} por hora quando ligado; o 6º do mesmo IP recebe 429 e outro IP passa`, async () => {
    const relogio = criarRelogio();
    const app = criarAppTeste({ agora: relogio.agora, limiteConvidadoIp: true });
    const criar = (xff: string) => agente(app).post('/auth/convidado').set('X-Forwarded-For', xff).send({});
    for (let i = 0; i < CONFIG_CONVIDADO.porIpPorJanela; i++) expect((await criar('203.0.113.5')).status).toBe(201);
    const sexto = await criar('203.0.113.5');
    expect(sexto.status).toBe(429);
    expect(sexto.body.erro).toBe('muitas_tentativas');
    expect((await criar('198.51.100.9')).status).toBe(201);
    // Forjar o começo do cabeçalho não ajuda: vale o último endereço público, que o proxy acrescentou.
    expect((await criar('1.2.3.4, 203.0.113.5')).status).toBe(429);
    relogio.avancar(HORA + 1);
    expect((await criar('203.0.113.5')).status).toBe(201);
  });

  it('por IP desligado (o padrão): só o teto total vale', async () => {
    const app = criarAppTeste();
    for (let i = 0; i < CONFIG_CONVIDADO.porIpPorJanela + 2; i++) {
      expect((await agente(app).post('/auth/convidado').set('X-Forwarded-For', '203.0.113.5').send({})).status).toBe(201);
    }
  });

  it('ipPrivado reconhece redes privadas e locais (o sinal de que o proxy não repassou o IP do jogador)', async () => {
    const { ipPrivado } = await import('../src/auth/rotas.ts');
    for (const ip of ['10.1.2.3', '172.20.0.5', '192.168.0.9', '127.0.0.1', '::1', '::ffff:172.20.0.5', 'fd00::1']) expect(ipPrivado(ip), ip).toBe(true);
    for (const ip of ['203.0.113.5', '172.32.0.1', '8.8.8.8']) expect(ipPrivado(ip), ip).toBe(false);
  });
});

describe('ranking e convidado', () => {
  /** Reino pronto para ascender, direto no banco (como em ranking.test.ts). */
  async function prepararAscensao(userId: string) {
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    const e = validarEstado(linha.estado, linha.versaoEsquema);
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    e.reliquias = { total: 6, gastas: 3, niveis: {} };
    await prisma.gameState.update({ where: { userId }, data: { estado: e as never } });
  }
  const acao = (a: ReturnType<typeof agente>, tipo: string, rev: number) =>
    a.post('/game/actions').send({ tipo, dados: tipo === 'contratar' ? { classe: 'lanceiro' } : {}, idempotencyKey: randomUUID(), revEsperada: rev });

  it('um marco do convidado (ascensão) não cria entrada no ranking', async () => {
    const relogio = criarRelogio();
    const { a, res } = await novoConvidado(criarAppTeste({ agora: relogio.agora }));
    const userId = res.body.usuario.id as string;
    await a.get('/game/state');
    await prepararAscensao(userId);
    relogio.avancar(MIN);
    expect((await acao(a, 'contratar', 0)).status).toBe(200);
    relogio.avancar(MIN);
    expect((await acao(a, 'ascender', 1)).status).toBe(200);
    expect(await prisma.rankingEntry.count({ where: { userId } })).toBe(0);
    expect((await a.get('/ranking')).body.jogador).toBeNull();
  });

  it('ao vincular entra com o estado ATUAL (ciclo 2), tempo acumulado e marcoEm = agora', async () => {
    const relogio = criarRelogio();
    const app = criarAppTeste({ agora: relogio.agora });
    const { a, res } = await novoConvidado(app);
    const userId = res.body.usuario.id as string;
    await a.get('/game/state');
    await prepararAscensao(userId);
    relogio.avancar(MIN);
    await acao(a, 'contratar', 0);
    relogio.avancar(MIN);
    await acao(a, 'ascender', 1);
    expect(await prisma.rankingEntry.count()).toBe(0);

    relogio.avancar(10 * MIN);
    const v = await a.post('/auth/vincular/email').send({ nome: 'Isadora', email: 'isa@teste.local', senha: 'fogueira123' });
    expect(v.status).toBe(200);
    const e = await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } });
    const tempo = (await prisma.gameState.findUniqueOrThrow({ where: { userId } })).tempoJogado;
    expect(e).toMatchObject({ era: 1, ciclo: 2, reliquias: 6 + reliquiasNaAscensao(1), tempoJogado: tempo });
    expect(e.marcoEm.getTime()).toBe(relogio.agora().getTime());
    expect((await a.get('/ranking')).body.jogador).toMatchObject({ nome: 'Isadora', ciclo: 2, voce: true });
  });

  it('desempate coerente: quem estava na mesma posição antes do vínculo fica à frente; quem chega depois, atrás', async () => {
    const relogio = criarRelogio();
    const app = criarAppTeste({ agora: relogio.agora });
    const antes = await prisma.user.create({ data: { nome: 'Antes', email: 'antes@t.local' } });
    await prisma.rankingEntry.create({ data: { userId: antes.id, era: 1, ciclo: 1, reliquias: 0, marcoEm: new Date(relogio.agora().getTime() - HORA) } });

    const { a, res } = await novoConvidado(app);
    await a.get('/game/state');
    relogio.avancar(MIN);
    expect((await a.post('/auth/vincular/email').send({ nome: 'Convidada', email: 'c@teste.local', senha: 'fogueira123' })).status).toBe(200);

    relogio.avancar(MIN);
    const depois = await prisma.user.create({ data: { nome: 'Depois', email: 'depois@t.local' } });
    await prisma.rankingEntry.create({ data: { userId: depois.id, era: 1, ciclo: 1, reliquias: 0, marcoEm: relogio.agora() } });

    const nomes = (await a.get('/ranking')).body.linhas.map((l: { nome: string }) => l.nome);
    expect(nomes.indexOf('Antes')).toBeLessThan(nomes.findIndex((n: string) => n.startsWith('Convidada')));
    expect(nomes.findIndex((n: string) => n.startsWith('Convidada'))).toBeLessThan(nomes.indexOf('Depois'));
    expect(res.status).toBe(201);
  });
});
