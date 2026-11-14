import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PerfilOAuth } from '../../src/auth/oauth.ts';
import { provedoresDoEnv } from '../../src/auth/oauth.ts';
import { desafioPkce } from '../../src/auth/tokens.ts';
import { CONFIG_AUTH } from '../../src/config.ts';
import { agente, APP_URL, cookiesDe, criarAppTeste, provedorFalso } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

let perfil: PerfilOAuth;
beforeEach(() => {
  perfil = {
    providerAccountId: 'g-123',
    email: 'Brenna@Gmail.com',
    emailVerificado: true,
    nome: 'Brenna',
    avatarUrl: 'https://lh3.googleusercontent.com/a/foto',
  };
});

function montar() {
  const falso = provedorFalso(() => perfil);
  const app = criarAppTeste({ provedores: { google: falso.provedor } });
  return { app, falso };
}

/** Faz o fluxo completo: iniciar, "voltar do Google" com o state certo. */
async function entrarComGoogle(a: ReturnType<typeof agente>) {
  const ini = await a.get('/auth/google/iniciar');
  expect(ini.status).toBe(302);
  const destino = new URL(ini.headers.location!);
  const state = destino.searchParams.get('state')!;
  return a.get(`/auth/google/callback?code=codigo-x&state=${encodeURIComponent(state)}`);
}

describe('OAuth: início', () => {
  it('redireciona ao provedor com state e guarda state e verificador num cookie httpOnly', async () => {
    const { app } = montar();
    const res = await request(app).get('/auth/google/iniciar');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/provedor\.teste\/autorizar\?/);
    const salvo = JSON.parse(cookiesDe(res)[CONFIG_AUTH.cookieOAuth]!);
    expect(salvo.p).toBe('google');
    expect(new URL(res.headers.location!).searchParams.get('state')).toBe(salvo.s);
    expect((res.headers['set-cookie'] as unknown as string[]).join()).toMatch(/HttpOnly/);
  });

  it('provedor sem credenciais: volta ao login com erro', async () => {
    const res = await request(criarAppTeste()).get('/auth/discord/iniciar');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=provedor_indisponivel`);
  });

  it('informa quais provedores estão ligados', async () => {
    const res = await request(montar().app).get('/auth/provedores');
    expect(res.body).toEqual({ google: true, discord: false });
  });

  it('provedoresDoEnv só liga quem tem id e segredo', () => {
    const p = provedoresDoEnv({ APP_URL, GOOGLE_CLIENT_ID: 'id', DISCORD_CLIENT_ID: 'id' });
    expect(Object.keys(p)).toEqual([]);
    const ambos = provedoresDoEnv({
      APP_URL,
      GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 's',
      DISCORD_CLIENT_ID: 'did', DISCORD_CLIENT_SECRET: 's',
    });
    const url = ambos.google!.urlAutorizacao('st', 'verificador');
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(`${APP_URL}/api/auth/google/callback`);
    expect(url.searchParams.get('code_challenge')).toBe(desafioPkce('verificador'));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(ambos.discord!.urlAutorizacao('st', 'v').searchParams.get('scope')).toBe('identify email');
  });
});

describe('OAuth: retorno', () => {
  it('cria a conta verificada, abre a sessão e vai para /jogo', async () => {
    const { app, falso } = montar();
    const a = agente(app);
    const res = await entrarComGoogle(a);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/jogo`);
    expect(falso.chamadas[0]?.codigo).toBe('codigo-x');

    const me = await a.get('/auth/me');
    expect(me.body.usuario).toMatchObject({
      email: 'brenna@gmail.com',
      nome: 'Brenna',
      emailVerificado: true,
      temSenha: false,
      provedores: ['google'],
    });
  });

  it('entrar de novo usa a mesma conta', async () => {
    const { app } = montar();
    await entrarComGoogle(agente(app));
    perfil.email = 'trocou@gmail.com';
    await entrarComGoogle(agente(app));
    expect(await prisma.user.count()).toBe(1);
  });

  it('state diferente: recusa sem chamar o provedor', async () => {
    const { app, falso } = montar();
    const a = agente(app);
    await a.get('/auth/google/iniciar');
    const res = await a.get('/auth/google/callback?code=c&state=forjado');
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=oauth_invalido`);
    expect(falso.chamadas).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('sem o cookie do início: recusa', async () => {
    const { app } = montar();
    const res = await request(app).get('/auth/google/callback?code=c&state=s');
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=oauth_invalido`);
  });

  it('o jogador cancelou no provedor', async () => {
    const { app } = montar();
    const res = await request(app).get('/auth/google/callback?error=access_denied');
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=login_cancelado`);
  });

  it('e-mail não verificado no provedor: recusa', async () => {
    perfil.emailVerificado = false;
    const { app } = montar();
    const res = await entrarComGoogle(agente(app));
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=email_nao_verificado`);
    expect(await prisma.user.count()).toBe(0);
  });

  it('falha no provedor: volta ao login sem quebrar', async () => {
    const app = criarAppTeste({
      provedores: {
        google: {
          ...provedorFalso(() => perfil).provedor,
          obterPerfil: async () => {
            throw new Error('timeout');
          },
        },
      },
    });
    const res = await entrarComGoogle(agente(app));
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=oauth_falhou`);
  });
});

describe('OAuth: vínculo por e-mail', () => {
  it('conta com senha e e-mail NÃO verificado: vincula, apaga a senha e encerra as sessões', async () => {
    const { app } = montar();
    // Alguém se cadastrou antes com o e-mail da Brenna.
    const intruso = agente(app);
    await intruso.post('/auth/cadastro').send({ nome: 'Intruso', email: 'brenna@gmail.com', senha: 'senha-do-intruso' });
    expect((await intruso.get('/auth/me')).status).toBe(200);

    await entrarComGoogle(agente(app));

    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'brenna@gmail.com' } });
    expect(u.senhaHash).toBeNull();
    expect(u.emailVerificado).toBe(true);
    expect((await intruso.get('/auth/me')).status).toBe(401);
    const login = await agente(app).post('/auth/login').send({ email: 'brenna@gmail.com', senha: 'senha-do-intruso' });
    expect(login.status).toBe(401);
  });

  it('conta com e-mail já verificado: vincula e mantém senha e sessões', async () => {
    const { app } = montar();
    await prisma.user.create({
      data: { email: 'brenna@gmail.com', nome: 'Brenna', senhaHash: 'hash-existente', emailVerificado: true },
    });
    await entrarComGoogle(agente(app));
    const u = await prisma.user.findUniqueOrThrow({
      where: { email: 'brenna@gmail.com' },
      include: { contasOAuth: true },
    });
    expect(u.senhaHash).toBe('hash-existente');
    expect(u.contasOAuth.map((c) => c.provedor)).toEqual(['google']);
  });

  it('o e-mail já tem outra conta Google vinculada: recusa', async () => {
    const { app } = montar();
    await prisma.user.create({
      data: {
        email: 'brenna@gmail.com',
        nome: 'Brenna',
        emailVerificado: true,
        contasOAuth: { create: { provedor: 'google', providerAccountId: 'g-outra' } },
      },
    });
    const res = await entrarComGoogle(agente(app));
    expect(res.headers.location).toBe(`${APP_URL}/login?erro=conta_ja_vinculada`);
  });
});
