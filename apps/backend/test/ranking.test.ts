import { randomUUID } from 'node:crypto';
import { esquemaRespostaRanking, RANKING, reliquiasNaAscensao, validarEstado } from '@cronarca/game-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste, criarRelogio } from './helpers/app.ts';
import { criarUsuario, limparBanco, prisma } from './helpers/prisma.ts';

const SEG = 1000;
const MIN = 60 * SEG;

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

/** Um app (relógio único) e quantos jogadores logados o teste quiser. */
function mundo() {
  const relogio = criarRelogio();
  const app = criarAppTeste({ agora: relogio.agora });
  let n = 0;
  async function entrar(nome: string) {
    n += 1;
    const a = agente(app);
    const res = await a.post('/auth/cadastro').send({ nome, email: `j${n}@teste.local`, senha: 'fogueira123' });
    const userId = res.body.usuario.id as string;
    const acao = (tipo: string, dados: Record<string, unknown>, revEsperada: number) =>
      a.post('/game/actions').send({ tipo, dados, idempotencyKey: randomUUID(), revEsperada });
    const ranking = async (aba?: string) => {
      const r = await a.get('/ranking').query(aba ? { aba } : {});
      expect(r.status).toBe(200);
      return esquemaRespostaRanking.parse(r.body);
    };
    return { a, userId, acao, ranking };
  }
  return { relogio, app, entrar };
}

/** Entrada direta no banco (jogadores que não precisam logar). */
async function entrada(nome: string, era: number, ciclo: number, reliquias: number, marcoEm: Date) {
  const u = await criarUsuario({ nome });
  await prisma.rankingEntry.create({ data: { userId: u.id, era, ciclo, reliquias, marcoEm } });
  return u.id;
}

describe('GET /ranking', () => {
  it('exige sessão e recusa aba desconhecida ou campo a mais', async () => {
    const { app, entrar } = mundo();
    expect((await agente(app).get('/ranking')).status).toBe(401);
    const { a } = await entrar('Teo');
    expect((await a.get('/ranking').query({ aba: 'amigos' })).status).toBe(400);
    expect((await a.get('/ranking').query({ aba: 'geral', limite: 500 })).status).toBe(400);
  });

  it('todo reino entra desde o ciclo 1, com o nome curto e sem e-mail', async () => {
    const { relogio, entrar } = mundo();
    const { a, userId, ranking } = await entrar('Marcos Vieira Lima');
    expect((await ranking()).jogador).toBeNull(); // ainda sem reino
    await a.get('/game/state');

    const r = await ranking();
    const linha = { posicao: 1, nome: 'Marcos L.', era: 1, ciclo: 1, reliquias: 0, tempoJogadoMs: 0, voce: true };
    expect(r).toEqual({ aba: 'geral', era: null, linhas: [linha], jogador: linha, geradoEm: relogio.agora().getTime() });
    expect(JSON.stringify(r)).not.toMatch(/@|Vieira|Lima/);
    expect(JSON.stringify(r)).not.toContain(userId);
  });

  it('ordena por era, ciclo e relíquias; empate vai para quem chegou primeiro', async () => {
    const { entrar } = mundo();
    const t = (m: number) => new Date(Date.UTC(2026, 10, 1) + m * MIN);
    await entrada('Nina', 1, 4, 40, t(5));
    await entrada('Isadora', 3, 4, 86, t(9));
    await entrada('Teo', 3, 3, 74, t(1));
    await entrada('Bento', 1, 4, 40, t(2));
    await entrada('Lia', 2, 3, 55, t(0));
    const { a, ranking } = await entrar('Gabriel');
    await a.get('/game/state');

    const r = await ranking();
    expect(r.linhas.map((l) => `${l.posicao} ${l.nome}`)).toEqual(['1 Isadora', '2 Teo', '3 Lia', '4 Bento', '5 Nina', '6 Gabriel']);
    expect(r.jogador?.posicao).toBe(6);
  });

  it(`mostra só os ${RANKING.tamanhoLista} primeiros e a linha do jogador com a posição real`, async () => {
    const { entrar } = mundo();
    const base = Date.UTC(2026, 10, 1);
    for (let i = 0; i < RANKING.tamanhoLista + 5; i++) await entrada(`J${i}`, 1, 2, i % 7, new Date(base + i));
    // Empatado com os de ciclo 1, mas depois deles: fica atrás.
    for (let i = 0; i < 3; i++) await entrada(`Cedo${i}`, 1, 1, 0, new Date(base - 1000 + i));
    const { a, ranking } = await entrar('Gabriel');
    await a.get('/game/state');

    const r = await ranking();
    expect(r.linhas).toHaveLength(RANKING.tamanhoLista);
    expect(r.linhas.every((l) => !l.voce)).toBe(true);
    expect(r.linhas.map((l) => l.posicao)).toEqual(Array.from({ length: RANKING.tamanhoLista }, (_, i) => i + 1));
    expect(r.jogador).toMatchObject({ posicao: RANKING.tamanhoLista + 5 + 3 + 1, voce: true, nome: 'Gabriel' });
  });

  it('a aba "era" mostra só a era do jogador', async () => {
    const { entrar } = mundo();
    await entrada('Isadora', 3, 4, 86, new Date());
    await entrada('Nina', 1, 4, 40, new Date());
    const { a, ranking } = await entrar('Gabriel');
    await a.get('/game/state');

    const r = await ranking('era');
    expect(r.era).toBe(1);
    expect(r.linhas.map((l) => l.nome)).toEqual(['Nina', 'Gabriel']);
    expect(r.jogador?.posicao).toBe(2);
    expect((await ranking('geral')).jogador?.posicao).toBe(3);
  });
});

describe('marcos e tempo jogado', () => {
  it('o tempo soma só intervalos de até 5 min entre requisições de jogo', async () => {
    const { relogio, entrar } = mundo();
    const { a, userId, acao } = await entrar('Teo');
    const tempo = async () => Number((await prisma.gameState.findUniqueOrThrow({ where: { userId } })).tempoJogado);

    await a.get('/game/state');
    relogio.avancar(30 * SEG);
    await a.get('/game/state');
    relogio.avancar(30 * SEG);
    expect((await acao('contratar', {}, 0)).status).toBe(200);
    expect(await tempo()).toBe(60 * SEG);

    relogio.avancar(RANKING.janelaAtividadeMs + 1); // voltou de uma pausa: não conta
    await a.get('/game/state');
    expect(await tempo()).toBe(60 * SEG);
    relogio.avancar(RANKING.janelaAtividadeMs);
    await a.get('/game/state');
    expect(await tempo()).toBe(60 * SEG + RANKING.janelaAtividadeMs);

    // Sem marco, a entrada do ranking não muda (tempo vai no próximo marco).
    const e = await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } });
    expect(e).toMatchObject({ ciclo: 1, reliquias: 0, tempoJogado: 0n });
  });

  it('a ascensão é um marco: ciclo, relíquias, tempo e o instante vão ao ranking', async () => {
    const { relogio, entrar } = mundo();
    const { a, userId, acao, ranking } = await entrar('Isadora');
    await a.get('/game/state');
    const criadoEm = (await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } })).marcoEm;

    // Objetivos da Era I cumpridos direto no banco.
    const linha = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    const e = validarEstado(linha.estado, linha.versaoEsquema);
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    e.reliquias = { total: 6, gastas: 3, niveis: {} };
    await prisma.gameState.update({ where: { userId }, data: { estado: e as never } });

    relogio.avancar(2 * MIN);
    expect((await acao('contratar', {}, 0)).status).toBe(200);
    expect((await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } })).marcoEm).toEqual(criadoEm);

    relogio.avancar(MIN);
    const r = await acao('ascender', {}, 1);
    expect(r.status).toBe(200);
    const depois = await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } });
    expect(depois).toMatchObject({ era: 1, ciclo: 2, reliquias: 6 + reliquiasNaAscensao(1), tempoJogado: BigInt(3 * MIN) });
    expect(depois.marcoEm.getTime()).toBe(relogio.agora().getTime());
    expect((await ranking()).jogador).toMatchObject({ ciclo: 2, tempoJogadoMs: 3 * MIN });
  });

  it('ação recusada ou repetida não mexe no ranking', async () => {
    const { relogio, entrar } = mundo();
    const { a, userId, acao } = await entrar('Bento');
    await a.get('/game/state');
    const antes = await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } });
    relogio.avancar(MIN);
    expect((await acao('ascender', {}, 0)).status).toBe(422);
    expect(await prisma.rankingEntry.findUniqueOrThrow({ where: { userId } })).toEqual(antes);
  });
});
