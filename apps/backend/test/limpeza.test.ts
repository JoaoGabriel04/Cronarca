import { estadoInicial, VERSAO_ESQUEMA } from '@cronarca/game-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agendarLimpeza, executarLimpeza, limparConvidados } from '../src/auth/limpeza.ts';
import { CONFIG_CONVIDADO } from '../src/config.ts';
import { limparBanco, prisma } from './helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-12-20T12:00:00Z');
const hAtras = (dias: number) => new Date(AGORA.getTime() - dias * DIA);

async function criar(opcoes: { dias: number; atividade?: number | null | 'sem-estado'; senha?: boolean; oauth?: boolean; convidado?: boolean; email?: string }) {
  const u = await prisma.user.create({
    data: {
      nome: 'Convidado 1234', convidado: opcoes.convidado ?? true, criadoEm: hAtras(opcoes.dias),
      ...(opcoes.senha ? { senhaHash: 'hash' } : {}), ...(opcoes.email ? { email: opcoes.email } : {}),
    },
  });
  if (opcoes.atividade !== 'sem-estado') {
    await prisma.gameState.create({
      data: {
        userId: u.id, atualizadoEm: AGORA, estado: estadoInicial({ semente: 1, agora: AGORA.getTime() }) as never, versaoEsquema: VERSAO_ESQUEMA,
        ultimaAtividadeEm: opcoes.atividade === undefined || opcoes.atividade === null ? null : hAtras(opcoes.atividade),
      },
    });
  }
  if (opcoes.oauth) await prisma.oAuthAccount.create({ data: { userId: u.id, provedor: 'google', providerAccountId: `g-${u.id}` } });
  return u.id;
}
const existe = async (id: string) => (await prisma.user.count({ where: { id } })) === 1;

describe('limpeza de convidados', () => {
  it('remove o inativo há 31 dias e mantém o de 29 (a atividade vem do GameState)', async () => {
    const velho = await criar({ dias: 60, atividade: 31 });
    const recente = await criar({ dias: 60, atividade: 29 });
    const { removidos } = await limparConvidados(prisma, AGORA);
    expect(removidos).toBe(1);
    expect(await existe(velho)).toBe(false);
    expect(await existe(recente)).toBe(true);
  });

  it('sem atividade registrada (nula ou sem estado), vale o criadoEm', async () => {
    const nula31 = await criar({ dias: 31, atividade: null });
    const nula29 = await criar({ dias: 29, atividade: null });
    const sem31 = await criar({ dias: 31, atividade: 'sem-estado' });
    const sem29 = await criar({ dias: 29, atividade: 'sem-estado' });
    expect((await limparConvidados(prisma, AGORA)).removidos).toBe(2);
    expect([await existe(nula31), await existe(sem31)]).toEqual([false, false]);
    expect([await existe(nula29), await existe(sem29)]).toEqual([true, true]);
  });

  it('nunca remove convidado vinculado: conta comum, com senha, com OAuth ou com vínculo pendente', async () => {
    const comum = await criar({ dias: 90, atividade: 90, convidado: false, email: 'a@t.local' });
    const comSenha = await criar({ dias: 90, atividade: 90, senha: true });
    const pendente = await criar({ dias: 90, atividade: 90, oauth: true });
    expect((await limparConvidados(prisma, AGORA)).removidos).toBe(0);
    for (const id of [comum, comSenha, pendente]) expect(await existe(id)).toBe(true);
  });

  it('a cascata apaga sessões, estado do jogo, log de ações e ranking', async () => {
    const id = await criar({ dias: 90, atividade: 90 });
    await prisma.session.create({ data: { userId: id, tokenHash: 'h1', expiraEm: new Date(AGORA.getTime() + DIA) } });
    await prisma.actionLog.create({ data: { userId: id, idempotencyKey: 'k', tipo: 'clique', resultado: {}, rev: 1 } });
    await prisma.rankingEntry.create({ data: { userId: id, era: 1, ciclo: 1, reliquias: 0, marcoEm: AGORA } });
    await limparConvidados(prisma, AGORA);
    const [s, g, l, r] = await Promise.all([
      prisma.session.count(), prisma.gameState.count(), prisma.actionLog.count(), prisma.rankingEntry.count(),
    ]);
    expect([s, g, l, r]).toEqual([0, 0, 0, 0]);
  });

  it(`respeita o teto de ${CONFIG_CONVIDADO.limpezaTeto} por execução e registra a contagem`, async () => {
    const n = CONFIG_CONVIDADO.limpezaTeto + 1;
    await prisma.user.createMany({ data: Array.from({ length: n }, (_, i) => ({ nome: `Convidado ${i}`, convidado: true, criadoEm: hAtras(40) })) });
    const linhas: string[] = [];
    await executarLimpeza(prisma, AGORA, (m) => linhas.push(m));
    expect(await prisma.user.count()).toBe(1);
    expect(linhas[0]).toBe(`[limpeza] convidados removidos: ${CONFIG_CONVIDADO.limpezaTeto} (teto ${CONFIG_CONVIDADO.limpezaTeto})`);
    expect(linhas[1]).toMatch(/teto atingido/);
    const seguinte: string[] = [];
    await executarLimpeza(prisma, AGORA, (m) => seguinte.push(m));
    expect(seguinte).toEqual([`[limpeza] convidados removidos: 1 (teto ${CONFIG_CONVIDADO.limpezaTeto})`]);
    expect(await prisma.user.count()).toBe(0);
  });

  it('roda uma vez na subida do servidor e depois agenda', async () => {
    await criar({ dias: 60, atividade: 40 });
    const linhas: string[] = [];
    const parar = agendarLimpeza(prisma, () => AGORA, (m) => linhas.push(m));
    await new Promise((ok) => setTimeout(ok, 500));
    parar();
    expect(linhas).toEqual([`[limpeza] convidados removidos: 1 (teto ${CONFIG_CONVIDADO.limpezaTeto})`]);
    expect(await prisma.user.count()).toBe(0);
  });
});
