// O `agora` do corpo é o relógio do servidor no instante em que a resposta SAI, não o do início da requisição:
// o cliente mede a hora de chegada contra ele, e o relógio estimado não pode recuar a cada resposta.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agente, criarAppTeste } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';
import { PALAVRA_APAGAR } from '@cronarca/game-core';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

/** Cada leitura do relógio avança 40 ms: o que vem depois no código tem hora maior. */
function relogioQueAnda() {
  let ms = Date.now();
  return () => new Date((ms += 40));
}

async function logar(app: ReturnType<typeof criarAppTeste>) {
  const a = agente(app);
  await a.post('/auth/cadastro').send({ nome: 'Teo', email: 'teo@teste.local', senha: 'fogueira123' });
  return a;
}

describe('carimbo de hora das respostas do jogo', () => {
  it('GET /game/state, POST /game/actions e POST /game/reset carimbam depois do trabalho do servidor', async () => {
    const a = await logar(criarAppTeste({ agora: relogioQueAnda() }));

    const estado = await a.get('/game/state');
    expect(estado.status).toBe(200);
    // O estado foi liquidado no início da requisição; o carimbo é de quando a resposta saiu.
    expect(estado.body.agora).toBeGreaterThan(estado.body.estado.t);

    const acao = await a.post('/game/actions').send({ tipo: 'clicar', dados: { objeto: 'serraria', quantidade: 1 }, idempotencyKey: randomUUID(), revEsperada: estado.body.rev });
    expect([200, 422]).toContain(acao.status);
    expect(acao.body.agora).toBeGreaterThan(acao.body.estado.t);

    const reset = await a.post('/game/reset').send({ confirmacao: PALAVRA_APAGAR });
    expect(reset.status).toBe(200);
    expect(reset.body.agora).toBeGreaterThan(reset.body.estado.t);
  });

  it('o carimbo nunca fica antes do estado liquidado (relógio parado)', async () => {
    const fixo = new Date();
    const a = await logar(criarAppTeste({ agora: () => fixo }));
    const r = await a.get('/game/state');
    expect(r.body.agora).toBeGreaterThanOrEqual(r.body.estado.t);
  });
});
