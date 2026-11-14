import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { carregarEnv } from '../src/env.ts';
import { criarAppTeste } from './helpers/app.ts';

describe('GET /health', () => {
  const app = criarAppTeste();

  it('responde 200 com status ok e banco ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('responde 503 quando o banco não responde', async () => {
    const semBanco = criarAppTeste({ verificarBanco: async () => false });
    const res = await request(semBanco).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'erro', db: 'fora' });
  });

  it('aplica os cabeçalhos do helmet e esconde o x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('responde 404 em JSON para rota desconhecida', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: 'nao_encontrado' });
  });
});

describe('carregarEnv', () => {
  it('aceita um ambiente válido e aplica os padrões', () => {
    const env = carregarEnv({ DATABASE_URL: 'postgresql://u:s@db:5432/x' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_URL).toBe('http://localhost:3000');
  });

  it('trata credencial vazia como ausente', () => {
    const env = carregarEnv({ DATABASE_URL: 'postgresql://u:s@db:5432/x', GOOGLE_CLIENT_ID: '' });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('recusa quando falta DATABASE_URL', () => {
    expect(() => carregarEnv({})).toThrow(/DATABASE_URL/);
  });
});
