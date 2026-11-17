import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PerfilOAuth } from '../src/auth/oauth.ts';
import { CONFIG_AUTH } from '../src/config.ts';
import { agente, APP_URL, cookiesDe, criarAppTeste, criarRelogio, provedorFalso } from './helpers/app.ts';
import { criarUsuario, limparBanco, prisma } from './helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const DADOS = { nome: 'Brenna', email: 'Brenna@Teste.local', senha: 'fogueira123' };

async function convidadoComJogo(app = criarAppTeste()) {
  const a = agente(app);
  const res = await a.post('/auth/convidado').send({});
  const userId = res.body.usuario.id as string;
  await a.get('/game/state');
  return { a, userId, sessao: cookiesDe(res)[CONFIG_AUTH.cookieSessao]!, app };
}

describe('vínculo por e-mail e senha', () => {
  it('migra o MESMO usuário: mesmo id, mesmo estado de jogo, sessão ainda valida', async () => {
    const relogio = criarRelogio();
    const { a, userId } = await convidadoComJogo(criarAppTeste({ agora: relogio.agora }));
    const antes = await prisma.gameState.findUniqueOrThrow({ where: { userId } });

    const res = await a.post('/auth/vincular/email').send(DADOS);
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ id: userId, nome: 'Brenna', email: 'brenna@teste.local', convidado: false, temSenha: true, vinculoPendente: false });

    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u).toMatchObject({ email: 'brenna@teste.local', convidado: false, emailVerificado: false });
    expect(u.senhaHash).toBeTruthy();
    const depois = await prisma.gameState.findUniqueOrThrow({ where: { userId } });
    expect(depois.estado).toEqual(antes.estado);
    expect(depois.rev).toBe(antes.rev);
    expect(await prisma.user.count()).toBe(1);
    expect((await a.get('/auth/me')).body.usuario.id).toBe(userId);

    // E agora entra por e-mail e senha, na mesma conta.
    const outro = agente(criarAppTeste());
    const login = await outro.post('/auth/login').send({ email: 'brenna@teste.local', senha: DADOS.senha });
    expect(login.status).toBe(200);
    expect(login.body.usuario.id).toBe(userId);
  });

  it('e-mail de outro usuário: 409 conta_ja_vinculada, nada muda e nada é mesclado', async () => {
    await criarUsuario({ email: 'brenna@teste.local', nome: 'Outra' });
    const { a, userId } = await convidadoComJogo();
    const res = await a.post('/auth/vincular/email').send(DADOS);
    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('conta_ja_vinculada');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u).toMatchObject({ email: null, senhaHash: null, convidado: true });
    expect(u.nome).toMatch(/^Convidado /);
    expect(await prisma.rankingEntry.count()).toBe(0);
    expect(await prisma.user.count()).toBe(2);
  });

  it('quem não é convidado recebe 409 nao_e_convidado; sem sessão, 401; dados inválidos, 400', async () => {
    const comum = agente(criarAppTeste());
    await comum.post('/auth/cadastro').send({ nome: 'Teo', email: 'teo@teste.local', senha: 'fogueira123' });
    const r1 = await comum.post('/auth/vincular/email').send(DADOS);
    expect(r1.status).toBe(409);
    expect(r1.body.erro).toBe('nao_e_convidado');
    expect((await agente(criarAppTeste()).post('/auth/vincular/email').send(DADOS)).status).toBe(401);
    const { a } = await convidadoComJogo();
    const r3 = await a.post('/auth/vincular/email').send({ nome: 'B', email: 'xx', senha: '1' });
    expect(r3.status).toBe(400);
    expect(Object.keys(r3.body.campos)).toEqual(expect.arrayContaining(['nome', 'email', 'senha']));
  });
});

describe('vínculo por Google (duas etapas)', () => {
  let perfil: PerfilOAuth;
  beforeEach(() => {
    perfil = { providerAccountId: 'g-777', email: 'Brenna@Gmail.com', emailVerificado: true, nome: 'Brenna Google', avatarUrl: null };
  });
  const montar = () => {
    const falso = provedorFalso(() => perfil);
    return criarAppTeste({ provedores: { google: falso.provedor } });
  };

  async function voltarDoGoogle(a: ReturnType<typeof agente>) {
    const ini = await a.get('/auth/google/vincular');
    expect(ini.status).toBe(302);
    const state = new URL(ini.headers.location!).searchParams.get('state')!;
    return a.get(`/auth/google/callback?code=x&state=${encodeURIComponent(state)}`);
  }

  it('o cookie do fluxo leva a intenção e o id (nunca a URL) e a conta fica pendente até confirmar o nome', async () => {
    const app = montar();
    const { a, userId } = await convidadoComJogo(app);
    const ini = await a.get('/auth/google/vincular');
    const salvo = JSON.parse(cookiesDe(ini)[CONFIG_AUTH.cookieOAuth]!);
    expect(salvo).toMatchObject({ p: 'google', i: 'vincular', u: userId });
    expect(ini.headers.location).not.toContain(userId);

    const state = new URL(ini.headers.location!).searchParams.get('state')!;
    const cb = await a.get(`/auth/google/callback?code=x&state=${encodeURIComponent(state)}`);
    expect(cb.status).toBe(302);
    const destino = new URL(cb.headers.location!);
    expect(destino.origin + destino.pathname).toBe(`${APP_URL}/jogo`);
    expect(destino.searchParams.get('vinculo')).toBe('nome');
    expect(destino.searchParams.get('nome')).toBe('Brenna Google');

    const me = (await a.get('/auth/me')).body.usuario;
    expect(me).toMatchObject({ id: userId, convidado: true, vinculoPendente: true, email: 'brenna@gmail.com', provedores: ['google'] });
    expect(await prisma.rankingEntry.count()).toBe(0); // ainda não aparece como "Convidado 1234"

    const ok = await a.post('/auth/vincular/confirmar').send({ nome: 'Brenna' });
    expect(ok.status).toBe(200);
    expect(ok.body.usuario).toMatchObject({ id: userId, nome: 'Brenna', convidado: false, vinculoPendente: false });
    expect(await prisma.rankingEntry.count({ where: { userId } })).toBe(1);
    expect((await a.get('/ranking')).body.jogador).toMatchObject({ nome: 'Brenna' });
  });

  it('e-mail do Google já é de outro usuário: erro conta_ja_vinculada, sem mesclar nem anexar', async () => {
    await criarUsuario({ email: 'brenna@gmail.com', nome: 'Outra' });
    const { a, userId } = await convidadoComJogo(montar());
    const cb = await voltarDoGoogle(a);
    expect(new URL(cb.headers.location!).searchParams.get('vinculo_erro')).toBe('conta_ja_vinculada');
    expect(await prisma.oAuthAccount.count()).toBe(0);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ email: null, convidado: true });
  });

  it('conta do Google já ligada a outro usuário: conta_ja_vinculada', async () => {
    const dono = await criarUsuario({ email: 'dono@teste.local' });
    await prisma.oAuthAccount.create({ data: { userId: dono.id, provedor: 'google', providerAccountId: 'g-777' } });
    const { a } = await convidadoComJogo(montar());
    const cb = await voltarDoGoogle(a);
    expect(new URL(cb.headers.location!).searchParams.get('vinculo_erro')).toBe('conta_ja_vinculada');
    expect(await prisma.oAuthAccount.count()).toBe(1);
  });

  it('e-mail não verificado pelo provedor: recusado', async () => {
    perfil.emailVerificado = false;
    const { a } = await convidadoComJogo(montar());
    const cb = await voltarDoGoogle(a);
    expect(new URL(cb.headers.location!).searchParams.get('vinculo_erro')).toBe('email_nao_verificado');
  });

  it('o id guardado no cookie precisa ser o da sessão atual', async () => {
    const app = montar();
    const um = await convidadoComJogo(app);
    const dois = await convidadoComJogo(app);
    const ini = await um.a.get('/auth/google/vincular');
    const state = new URL(ini.headers.location!).searchParams.get('state')!;
    // O cookie do fluxo do convidado 1 chega com a sessão do convidado 2.
    const cb = await request(app)
      .get(`/auth/google/callback?code=x&state=${encodeURIComponent(state)}`)
      .set('Cookie', [`${CONFIG_AUTH.cookieSessao}=${dois.sessao}`, `${CONFIG_AUTH.cookieOAuth}=${encodeURIComponent(cookiesDe(ini)[CONFIG_AUTH.cookieOAuth]!)}`]);
    expect(new URL(cb.headers.location!).searchParams.get('vinculo_erro')).toBe('oauth_invalido');
    expect(await prisma.oAuthAccount.count()).toBe(0);
    void um;
  });

  it('quem não é convidado não inicia vínculo; confirmar sem vínculo pendente é recusado', async () => {
    const app = montar();
    const comum = agente(app);
    await comum.post('/auth/cadastro').send({ nome: 'Teo', email: 'teo@teste.local', senha: 'fogueira123' });
    const ini = await comum.get('/auth/google/vincular');
    expect(new URL(ini.headers.location!).searchParams.get('vinculo_erro')).toBe('nao_e_convidado');
    expect((await comum.post('/auth/vincular/confirmar').send({ nome: 'Teo' })).body.erro).toBe('nao_e_convidado');

    const { a } = await convidadoComJogo(app);
    const sem = await a.post('/auth/vincular/confirmar').send({ nome: 'Brenna' });
    expect(sem.status).toBe(400);
    expect(sem.body.erro).toBe('vinculo_inexistente');
  });
});
