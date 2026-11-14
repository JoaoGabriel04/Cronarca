import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assinarParametros } from '../../src/avatar/cloudinary.ts';
import type { ConfigCloudinary } from '../helpers/app.ts';
import { agente, criarAppTeste, criarRelogio } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const cloudinary: ConfigCloudinary = { cloudName: 'cronarca-dev', apiKey: '1234', apiSecret: 'segredo' };

const relogio = criarRelogio();

async function logado(cfg: ConfigCloudinary | null = cloudinary) {
  const a = agente(criarAppTeste({ cloudinary: cfg, agora: relogio.agora }));
  const res = await a.post('/auth/cadastro').send({ nome: 'Aldric', email: 'a@x.com', senha: 'fogueira123' });
  return { a, id: res.body.usuario.id as string };
}

describe('assinatura do Cloudinary', () => {
  it('segue a regra do Cloudinary: ordem alfabética, k=v com &, segredo no fim, SHA-1', () => {
    const esperado = createHash('sha1').update('eager=w_400&public_id=x&timestamp=1315060510abcd').digest('hex');
    expect(assinarParametros({ timestamp: '1315060510', public_id: 'x', eager: 'w_400' }, 'abcd')).toBe(esperado);
  });

  it('assina o upload na pasta de avatares com o id do usuário', async () => {
    const { a, id } = await logado();
    const res = await a.post('/me/avatar/assinatura');
    expect(res.status).toBe(200);
    expect(res.body.params).toEqual({
      allowed_formats: 'png,jpg,jpeg,webp',
      folder: 'cronarca/avatares',
      overwrite: 'true',
      public_id: id,
      timestamp: String(Math.floor(relogio.agora().getTime() / 1000)),
    });
    expect(res.body.assinatura).toBe(assinarParametros(res.body.params, 'segredo'));
    expect(res.body).not.toHaveProperty('apiSecret');
    expect(JSON.stringify(res.body)).not.toContain('segredo');
  });

  it('exige sessão', async () => {
    const a = agente(criarAppTeste({ cloudinary }));
    expect((await a.post('/me/avatar/assinatura')).status).toBe(401);
  });

  it('sem Cloudinary configurado: 503', async () => {
    const { a } = await logado(null);
    const res = await a.post('/me/avatar/assinatura');
    expect(res.status).toBe(503);
    expect(res.body.erro).toBe('avatar_indisponivel');
  });
});

describe('gravar o avatar', () => {
  it('aceita a URL do próprio avatar na nossa conta', async () => {
    const { a, id } = await logado();
    const url = `https://res.cloudinary.com/cronarca-dev/image/upload/v1717243200/cronarca/avatares/${id}.png`;
    const res = await a.put('/me/avatar').send({ url });
    expect(res.status).toBe(200);
    expect(res.body.usuario.avatarUrl).toBe(url);
  });

  it.each([
    ['outro domínio', (id: string) => `https://evil.exemplo/cronarca/avatares/${id}.png`],
    ['outra conta do Cloudinary', (id: string) => `https://res.cloudinary.com/outra/image/upload/cronarca/avatares/${id}.png`],
    ['avatar de outro usuário', () => 'https://res.cloudinary.com/cronarca-dev/image/upload/cronarca/avatares/outro-id.png'],
    ['http sem TLS', (id: string) => `http://res.cloudinary.com/cronarca-dev/image/upload/cronarca/avatares/${id}.png`],
    ['formato não permitido', (id: string) => `https://res.cloudinary.com/cronarca-dev/image/upload/cronarca/avatares/${id}.svg`],
    ['transformação injetada', (id: string) => `https://res.cloudinary.com/cronarca-dev/image/upload/e_blur/cronarca/avatares/${id}.png`],
  ])('recusa %s', async (_nome, montarUrl) => {
    const { a, id } = await logado();
    const res = await a.put('/me/avatar').send({ url: montarUrl(id) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('avatar_invalido');
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(u.avatarUrl).toBeNull();
  });
});
