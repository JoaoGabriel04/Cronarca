import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { verificadorDoBanco } from '../../src/db.ts';
import { criarUsuario, limparBanco, prisma } from '../helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

/** Espera que a operação falhe por violar uma restrição de unicidade (P2002). */
async function esperarDuplicado(operacao: Promise<unknown>) {
  await expect(operacao).rejects.toMatchObject({ code: 'P2002' });
}

describe('User', () => {
  it('cria com os padrões: sem senha, e-mail não verificado, datas preenchidas', async () => {
    const u = await criarUsuario();
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.senhaHash).toBeNull();
    expect(u.emailVerificado).toBe(false);
    expect(u.criadoEm).toBeInstanceOf(Date);
  });

  it('recusa e-mail repetido', async () => {
    await criarUsuario({ email: 'a@teste.local' });
    await esperarDuplicado(criarUsuario({ email: 'a@teste.local' }));
  });
});

describe('OAuthAccount', () => {
  it('recusa a mesma conta do provedor em dois usuários', async () => {
    const a = await criarUsuario();
    const b = await criarUsuario();
    await prisma.oAuthAccount.create({
      data: { userId: a.id, provedor: 'google', providerAccountId: 'g-1' },
    });
    await esperarDuplicado(
      prisma.oAuthAccount.create({
        data: { userId: b.id, provedor: 'google', providerAccountId: 'g-1' },
      }),
    );
  });

  it('aceita Google e Discord no mesmo usuário, mas não dois Google', async () => {
    const u = await criarUsuario();
    await prisma.oAuthAccount.create({
      data: { userId: u.id, provedor: 'google', providerAccountId: 'g-1' },
    });
    await prisma.oAuthAccount.create({
      data: { userId: u.id, provedor: 'discord', providerAccountId: 'd-1' },
    });
    await esperarDuplicado(
      prisma.oAuthAccount.create({
        data: { userId: u.id, provedor: 'google', providerAccountId: 'g-2' },
      }),
    );
  });
});

describe('Session', () => {
  it('recusa tokenHash repetido', async () => {
    const u = await criarUsuario();
    const expiraEm = new Date(Date.now() + 60_000);
    await prisma.session.create({ data: { userId: u.id, tokenHash: 'h1', expiraEm } });
    await esperarDuplicado(
      prisma.session.create({ data: { userId: u.id, tokenHash: 'h1', expiraEm } }),
    );
  });
});

describe('GameState', () => {
  it('guarda o estado em jsonb e começa na rev 0; um por usuário', async () => {
    const u = await criarUsuario();
    const estado = { versao: 1, recursos: { madeira: 100 } };
    const g = await prisma.gameState.create({
      data: { userId: u.id, atualizadoEm: new Date(), estado, versaoEsquema: 1 },
    });
    expect(g.rev).toBe(0);
    expect(g.estado).toEqual(estado);
    await esperarDuplicado(
      prisma.gameState.create({
        data: { userId: u.id, atualizadoEm: new Date(), estado, versaoEsquema: 1 },
      }),
    );
  });

  it('atualização condicionada à rev só passa uma vez (controle de concorrência)', async () => {
    const u = await criarUsuario();
    await prisma.gameState.create({
      data: { userId: u.id, atualizadoEm: new Date(), estado: {}, versaoEsquema: 1 },
    });
    const avancar = () =>
      prisma.gameState.updateMany({
        where: { userId: u.id, rev: 0 },
        data: { rev: { increment: 1 } },
      });
    const [a, b] = await Promise.all([avancar(), avancar()]);
    expect(a.count + b.count).toBe(1);
    const final = await prisma.gameState.findUniqueOrThrow({ where: { userId: u.id } });
    expect(final.rev).toBe(1);
  });
});

describe('ActionLog', () => {
  it('recusa idempotencyKey repetida no mesmo usuário, aceita em outro', async () => {
    const a = await criarUsuario();
    const b = await criarUsuario();
    const acao = { idempotencyKey: 'k1', tipo: 'construir', resultado: { ok: true }, rev: 1 };
    await prisma.actionLog.create({ data: { userId: a.id, ...acao } });
    await prisma.actionLog.create({ data: { userId: b.id, ...acao } });
    await esperarDuplicado(prisma.actionLog.create({ data: { userId: a.id, ...acao } }));
  });
});

describe('RankingEntry', () => {
  it('ordena por era, ciclo e relíquias (desc) e desempata por quem chegou primeiro', async () => {
    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const linhas = [
      { nome: 'era1', era: 1, ciclo: 9, reliquias: 99, marco: 0 },
      { nome: 'era2-tarde', era: 2, ciclo: 1, reliquias: 5, marco: 20 },
      { nome: 'era2-cedo', era: 2, ciclo: 1, reliquias: 5, marco: 10 },
      { nome: 'era2-ciclo2', era: 2, ciclo: 2, reliquias: 0, marco: 30 },
      { nome: 'era2-mais-reliquias', era: 2, ciclo: 1, reliquias: 8, marco: 40 },
    ];
    for (const l of linhas) {
      const u = await criarUsuario({ nome: l.nome });
      await prisma.rankingEntry.create({
        data: {
          userId: u.id,
          era: l.era,
          ciclo: l.ciclo,
          reliquias: l.reliquias,
          marcoEm: new Date(base + l.marco * 1000),
        },
      });
    }
    const ordem = await prisma.rankingEntry.findMany({
      orderBy: [{ era: 'desc' }, { ciclo: 'desc' }, { reliquias: 'desc' }, { marcoEm: 'asc' }],
      include: { user: { select: { nome: true } } },
    });
    expect(ordem.map((r) => r.user.nome)).toEqual([
      'era2-ciclo2',
      'era2-mais-reliquias',
      'era2-cedo',
      'era2-tarde',
      'era1',
    ]);
    expect(ordem[0]?.tempoJogado).toBe(0n);
  });
});

describe('cascata', () => {
  it('apagar o usuário apaga contas, sessões, estado, ações e ranking', async () => {
    const u = await criarUsuario();
    await prisma.oAuthAccount.create({
      data: { userId: u.id, provedor: 'discord', providerAccountId: 'd-9' },
    });
    await prisma.session.create({
      data: { userId: u.id, tokenHash: 'h9', expiraEm: new Date(Date.now() + 60_000) },
    });
    await prisma.gameState.create({
      data: { userId: u.id, atualizadoEm: new Date(), estado: {}, versaoEsquema: 1 },
    });
    await prisma.actionLog.create({
      data: { userId: u.id, idempotencyKey: 'k', tipo: 'clique', resultado: {}, rev: 1 },
    });
    await prisma.rankingEntry.create({
      data: { userId: u.id, era: 1, ciclo: 1, reliquias: 0, marcoEm: new Date() },
    });

    await prisma.user.delete({ where: { id: u.id } });

    const contagens = await Promise.all([
      prisma.oAuthAccount.count(),
      prisma.session.count(),
      prisma.gameState.count(),
      prisma.actionLog.count(),
      prisma.rankingEntry.count(),
    ]);
    expect(contagens).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('verificadorDoBanco', () => {
  it('responde true com o banco no ar', async () => {
    await expect(verificadorDoBanco(prisma)()).resolves.toBe(true);
  });
});
