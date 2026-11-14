import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste } from './helpers/app.ts';
import { limparBanco, prisma } from './helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

async function logado() {
  const a = agente(criarAppTeste());
  const res = await a.post('/auth/cadastro').send({ nome: 'Brenna', email: 'brenna@teste.local', senha: 'fogueira123' });
  return { a, userId: res.body.usuario.id as string };
}

describe('/me/preferencias', () => {
  it('exige sessão', async () => {
    const a = agente(criarAppTeste());
    expect((await a.get('/me/preferencias')).status).toBe(401);
    expect((await a.put('/me/preferencias').send({ animacoes: false })).status).toBe(401);
  });

  it('começa no padrão e guarda na conta', async () => {
    const { a, userId } = await logado();
    expect((await a.get('/me/preferencias')).body).toEqual({ preferencias: { animacoes: true } });
    const r = await a.put('/me/preferencias').send({ animacoes: false });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ preferencias: { animacoes: false } });
    expect((await a.get('/me/preferencias')).body).toEqual({ preferencias: { animacoes: false } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).preferencias).toEqual({ animacoes: false });
  });

  it('recusa campo desconhecido ou de tipo errado', async () => {
    const { a } = await logado();
    for (const corpo of [{}, { animacoes: 'sim' }, { animacoes: true, volume: 3 }]) {
      expect((await a.put('/me/preferencias').send(corpo)).status).toBe(400);
    }
    expect((await a.get('/me/preferencias')).body).toEqual({ preferencias: { animacoes: true } });
  });

  it('gravado antigo com campo a mais ou faltando volta ao padrão no que não vale', async () => {
    const { a, userId } = await logado();
    await prisma.user.update({ where: { id: userId }, data: { preferencias: { som: 1 } } });
    expect((await a.get('/me/preferencias')).body).toEqual({ preferencias: { animacoes: true } });
  });
});
