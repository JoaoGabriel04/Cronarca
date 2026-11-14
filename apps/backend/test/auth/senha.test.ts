import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_AUTH } from '../../src/config.ts';
import { sha256 } from '../../src/auth/tokens.ts';
import { agente, APP_URL, cookiesDe, criarAppTeste, criarRelogio } from '../helpers/app.ts';
import { limparBanco, prisma } from '../helpers/prisma.ts';

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

const conta = { nome: 'Aldric', email: 'Aldric@Exemplo.com', senha: 'fogueira123' };

describe('cadastro', () => {
  it('cria a conta, normaliza o e-mail, guarda só o hash e já abre a sessão', async () => {
    const a = agente(criarAppTeste());
    const res = await a.post('/auth/cadastro').send(conta);
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({
      nome: 'Aldric',
      email: 'aldric@exemplo.com',
      emailVerificado: false,
      temSenha: true,
      provedores: [],
    });
    expect(res.body.usuario).not.toHaveProperty('senhaHash');

    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'aldric@exemplo.com' } });
    expect(u.senhaHash).toMatch(/^\$2b\$/);
    expect(u.senhaHash).not.toContain(conta.senha);

    const token = cookiesDe(res)[CONFIG_AUTH.cookieSessao]!;
    expect(token.length).toBeGreaterThan(30);
    const sessao = await prisma.session.findFirstOrThrow({ where: { userId: u.id } });
    expect(sessao.tokenHash).toBe(sha256(token));

    const me = await a.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.usuario.email).toBe('aldric@exemplo.com');
  });

  it('cookie de sessão é httpOnly, SameSite=Lax e Path=/', async () => {
    const res = await agente(criarAppTeste()).post('/auth/cadastro').send(conta);
    const bruto = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(`${CONFIG_AUTH.cookieSessao}=`),
    )!;
    expect(bruto).toMatch(/HttpOnly/);
    expect(bruto).toMatch(/SameSite=Lax/);
    expect(bruto).toMatch(/Path=\//);
    expect(bruto).not.toMatch(/Secure/);
  });

  it('em produção o cookie também é Secure', async () => {
    const res = await agente(criarAppTeste({ producao: true })).post('/auth/cadastro').send(conta);
    const bruto = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(bruto).toMatch(/Secure/);
  });

  it('recusa e-mail já usado (ignorando maiúsculas)', async () => {
    const app = criarAppTeste();
    await agente(app).post('/auth/cadastro').send(conta);
    const res = await agente(app)
      .post('/auth/cadastro')
      .send({ ...conta, email: 'ALDRIC@exemplo.com' });
    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('email_em_uso');
  });

  it('valida os campos e responde em português', async () => {
    const res = await agente(criarAppTeste())
      .post('/auth/cadastro')
      .send({ nome: 'A', email: 'nao-e-email', senha: 'curta' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('dados_invalidos');
    expect(Object.keys(res.body.campos).sort()).toEqual(['email', 'nome', 'senha']);
    expect(res.body.campos.senha).toMatch(/8 caracteres/);
  });

  it('recusa senha acima de 72 bytes (limite do bcrypt)', async () => {
    const res = await agente(criarAppTeste())
      .post('/auth/cadastro')
      .send({ ...conta, senha: 'ç'.repeat(37) });
    expect(res.status).toBe(400);
    expect(res.body.campos.senha).toMatch(/72/);
  });

  it('recusa campos que não existem (o cliente não escolhe emailVerificado)', async () => {
    const res = await agente(criarAppTeste())
      .post('/auth/cadastro')
      .send({ ...conta, emailVerificado: true });
    expect(res.status).toBe(400);
  });
});

describe('login e logout', () => {
  it('entra com a senha certa e sai invalidando o token', async () => {
    const app = criarAppTeste();
    await agente(app).post('/auth/cadastro').send(conta);

    const a = agente(app);
    const res = await a.post('/auth/login').send({ email: 'aldric@exemplo.com', senha: conta.senha });
    expect(res.status).toBe(200);
    const token = cookiesDe(res)[CONFIG_AUTH.cookieSessao]!;
    expect((await a.get('/auth/me')).status).toBe(200);

    const saida = await a.post('/auth/logout');
    expect(saida.status).toBe(204);
    expect((await a.get('/auth/me')).status).toBe(401);

    // O token antigo não vale mais, mesmo reenviado à mão.
    const reuso = await request(app)
      .get('/auth/me')
      .set('Cookie', `${CONFIG_AUTH.cookieSessao}=${token}`);
    expect(reuso.status).toBe(401);
    expect(await prisma.session.count({ where: { tokenHash: sha256(token) } })).toBe(0);
  });

  it('mesma resposta para senha errada e e-mail inexistente', async () => {
    const app = criarAppTeste();
    await agente(app).post('/auth/cadastro').send(conta);
    const errada = await agente(app).post('/auth/login').send({ email: conta.email, senha: 'outra-senha' });
    const inexistente = await agente(app).post('/auth/login').send({ email: 'ninguem@x.com', senha: 'outra-senha' });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
    expect(cookiesDe(errada)[CONFIG_AUTH.cookieSessao]).toBeUndefined();
  });

  it('conta só de OAuth (sem senha) não entra por senha', async () => {
    await prisma.user.create({ data: { email: 'so-google@x.com', nome: 'G', emailVerificado: true } });
    const res = await agente(criarAppTeste()).post('/auth/login').send({ email: 'so-google@x.com', senha: 'qualquer1' });
    expect(res.status).toBe(401);
  });
});

describe('rotas protegidas e CSRF', () => {
  it('sem cookie: 401', async () => {
    const res = await request(criarAppTeste()).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: 'nao_autenticado' });
  });

  it('cookie inventado: 401 e o cookie é apagado', async () => {
    const res = await request(criarAppTeste())
      .get('/auth/me')
      .set('Cookie', `${CONFIG_AUTH.cookieSessao}=inventado`);
    expect(res.status).toBe(401);
    expect((res.headers['set-cookie'] as unknown as string[]).join()).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('POST sem Origin ou de outra origem: 403', async () => {
    const app = criarAppTeste();
    const sem = await request(app).post('/auth/cadastro').send(conta);
    const outra = await request(app).post('/auth/cadastro').set('Origin', 'https://malicioso.exemplo').send(conta);
    expect(sem.status).toBe(403);
    expect(outra.status).toBe(403);
    expect(outra.body).toEqual({ erro: 'origem_invalida' });
    expect(await prisma.user.count()).toBe(0);
  });

  it('JSON malformado: 400, sem vazar detalhes', async () => {
    const res = await request(criarAppTeste())
      .post('/auth/login')
      .set('Origin', APP_URL)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: 'requisicao_invalida' });
  });
});

describe('validade da sessão', () => {
  it('expira em 30 dias sem uso', async () => {
    const relogio = criarRelogio();
    const a = agente(criarAppTeste({ agora: relogio.agora }));
    await a.post('/auth/cadastro').send(conta);
    relogio.avancar(CONFIG_AUTH.sessaoDuracaoMs + 1);
    expect((await a.get('/auth/me')).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it('o uso renova a validade (no máximo uma escrita por dia)', async () => {
    const relogio = criarRelogio();
    const a = agente(criarAppTeste({ agora: relogio.agora }));
    await a.post('/auth/cadastro').send(conta);
    const inicial = (await prisma.session.findFirstOrThrow()).expiraEm.getTime();

    relogio.avancar(60 * 60 * 1000); // 1 h: não renova ainda
    const semRenovar = await a.get('/auth/me');
    expect(cookiesDe(semRenovar)[CONFIG_AUTH.cookieSessao]).toBeUndefined();
    expect((await prisma.session.findFirstOrThrow()).expiraEm.getTime()).toBe(inicial);

    relogio.avancar(25 * 24 * 60 * 60 * 1000); // dia 25: renova
    const renovando = await a.get('/auth/me');
    expect(renovando.status).toBe(200);
    expect(cookiesDe(renovando)[CONFIG_AUTH.cookieSessao]).toBeDefined();
    const renovada = (await prisma.session.findFirstOrThrow()).expiraEm.getTime();
    expect(renovada).toBe(relogio.agora().getTime() + CONFIG_AUTH.sessaoDuracaoMs);

    relogio.avancar(29 * 24 * 60 * 60 * 1000); // passaria dos 30 dias originais
    expect((await a.get('/auth/me')).status).toBe(200);
  });
});

describe('limite de tentativas', () => {
  it('bloqueia o e-mail depois de 10 senhas erradas, e a senha certa também espera', async () => {
    const relogio = criarRelogio();
    const app = criarAppTeste({ agora: relogio.agora });
    await agente(app).post('/auth/cadastro').send(conta);

    for (let i = 0; i < CONFIG_AUTH.limiteTentativas; i++) {
      const r = await agente(app).post('/auth/login').set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ email: conta.email, senha: 'errada-123' });
      expect(r.status).toBe(401);
    }
    const bloqueado = await agente(app).post('/auth/login').set('X-Forwarded-For', '10.0.1.1')
      .send({ email: conta.email, senha: conta.senha });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro).toBe('muitas_tentativas');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);

    relogio.avancar(CONFIG_AUTH.limiteJanelaMs);
    const depois = await agente(app).post('/auth/login').send({ email: conta.email, senha: conta.senha });
    expect(depois.status).toBe(200);
  });

  it('bloqueia o IP depois de 10 tentativas, mesmo com e-mails diferentes', async () => {
    const app = criarAppTeste();
    for (let i = 0; i < CONFIG_AUTH.limiteTentativas; i++) {
      await agente(app).post('/auth/login').send({ email: `x${i}@x.com`, senha: 'errada-123' });
    }
    const res = await agente(app).post('/auth/login').send({ email: 'outro@x.com', senha: 'errada-123' });
    expect(res.status).toBe(429);
  });

  it('limita cadastros por IP', async () => {
    const app = criarAppTeste();
    for (let i = 0; i < CONFIG_AUTH.limiteTentativas; i++) {
      await agente(app).post('/auth/cadastro').send({ ...conta, email: `c${i}@x.com` });
    }
    const res = await agente(app).post('/auth/cadastro').send({ ...conta, email: 'mais-um@x.com' });
    expect(res.status).toBe(429);
  });
});
