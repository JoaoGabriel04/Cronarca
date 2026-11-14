import { Router, type Request, type Response } from 'express';
import { CONFIG_AUTH } from '../config.ts';
import type { ContextoApp } from '../contexto.ts';
import type { Provedor } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { exigirSessao } from '../middleware.ts';
import { entrarComOAuth, ErroConta } from './contas.ts';
import { apagarCookieOAuth, apagarCookieSessao, gravarCookieOAuth, gravarCookieSessao } from './cookies.ts';
import { camposComErro, esquemaCadastro, esquemaCallback, esquemaLogin, esquemaProvedor } from './esquemas.ts';
import { LimiteTentativas } from './limite.ts';
import { conferirSenha, gerarHashSenha } from './senha.ts';
import { criarSessao, encerrarSessao } from './sessao.ts';
import { gerarToken, iguaisSemVazar } from './tokens.ts';
import { usuarioPublico } from './usuario-publico.ts';

function responderMuitasTentativas(res: Response, esperarS: number) {
  res.setHeader('Retry-After', String(esperarS));
  res.status(429).json({ erro: 'muitas_tentativas', esperarS });
}

function ipDe(req: Request): string {
  return req.ip ?? 'desconhecido';
}

export function rotasAuth(ctx: ContextoApp) {
  const r = Router();
  const agoraMs = () => ctx.agora().getTime();
  const limiteLoginIp = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);
  const limiteLoginEmail = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);
  const limiteCadastroIp = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);

  async function abrirSessao(res: Response, userId: string) {
    const { token, expiraEm } = await criarSessao(ctx.prisma, userId, ctx.agora());
    gravarCookieSessao(res, token, expiraEm, ctx.producao);
  }

  r.post('/cadastro', async (req, res) => {
    const ip = `ip:${ipDe(req)}`;
    const lim = limiteCadastroIp.consultar(ip);
    if (!lim.permitido) return responderMuitasTentativas(res, lim.esperarS);
    limiteCadastroIp.registrar(ip);

    const dados = esquemaCadastro.safeParse(req.body);
    if (!dados.success) {
      res.status(400).json({ erro: 'dados_invalidos', campos: camposComErro(dados.error) });
      return;
    }
    const { nome, email, senha } = dados.data;
    const senhaHash = await gerarHashSenha(senha, ctx.bcryptCusto);
    try {
      const usuario = await ctx.prisma.user.create({ data: { nome, email, senhaHash } });
      await abrirSessao(res, usuario.id);
      res.status(201).json({ usuario: await usuarioPublico(ctx.prisma, usuario) });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        res.status(409).json({ erro: 'email_em_uso', campos: { email: 'Este e-mail já tem conta.' } });
        return;
      }
      throw erro;
    }
  });

  r.post('/login', async (req, res) => {
    const dados = esquemaLogin.safeParse(req.body);
    if (!dados.success) {
      res.status(400).json({ erro: 'dados_invalidos', campos: camposComErro(dados.error) });
      return;
    }
    const { email, senha } = dados.data;
    const chaveIp = `ip:${ipDe(req)}`;
    const chaveEmail = `email:${email}`;
    for (const [limite, chave] of [[limiteLoginIp, chaveIp], [limiteLoginEmail, chaveEmail]] as const) {
      const lim = limite.consultar(chave);
      if (!lim.permitido) return responderMuitasTentativas(res, lim.esperarS);
    }
    limiteLoginIp.registrar(chaveIp);

    const usuario = await ctx.prisma.user.findUnique({ where: { email } });
    const ok = await conferirSenha(senha, usuario?.senhaHash, ctx.bcryptCusto);
    if (!usuario || !ok) {
      limiteLoginEmail.registrar(chaveEmail);
      // Mesma resposta para e-mail inexistente e senha errada.
      res.status(401).json({ erro: 'credenciais_invalidas' });
      return;
    }
    limiteLoginEmail.zerar(chaveEmail);
    await abrirSessao(res, usuario.id);
    res.json({ usuario: await usuarioPublico(ctx.prisma, usuario) });
  });

  r.post('/logout', async (_req, res) => {
    if (res.locals.sessaoId) await encerrarSessao(ctx.prisma, res.locals.sessaoId);
    apagarCookieSessao(res, ctx.producao);
    res.status(204).end();
  });

  r.get('/me', exigirSessao, async (_req, res) => {
    res.json({ usuario: await usuarioPublico(ctx.prisma, res.locals.usuario!) });
  });

  r.get('/provedores', (_req, res) => {
    res.json({ google: Boolean(ctx.provedores.google), discord: Boolean(ctx.provedores.discord) });
  });

  // ---- OAuth (Google e Discord) ----

  const voltarAoLogin = (res: Response, erro: string) =>
    res.redirect(302, `${ctx.appUrl}/login?erro=${encodeURIComponent(erro)}`);

  r.get('/:provedor/iniciar', (req, res) => {
    const p = esquemaProvedor.safeParse(req.params.provedor);
    const provedor = p.success ? ctx.provedores[p.data] : undefined;
    if (!p.success || !provedor) return voltarAoLogin(res, 'provedor_indisponivel');

    const state = gerarToken();
    const verificador = gerarToken();
    gravarCookieOAuth(res, JSON.stringify({ p: p.data, s: state, v: verificador }), ctx.producao);
    res.redirect(302, provedor.urlAutorizacao(state, verificador).toString());
  });

  r.get('/:provedor/callback', async (req, res) => {
    const bruto: unknown = req.cookies?.[CONFIG_AUTH.cookieOAuth];
    apagarCookieOAuth(res, ctx.producao);

    const p = esquemaProvedor.safeParse(req.params.provedor);
    const provedor = p.success ? ctx.provedores[p.data] : undefined;
    if (!p.success || !provedor) return voltarAoLogin(res, 'provedor_indisponivel');
    if (typeof req.query.error === 'string') return voltarAoLogin(res, 'login_cancelado');

    const consulta = esquemaCallback.safeParse(req.query);
    const salvo = lerCookieOAuth(bruto);
    if (
      !consulta.success ||
      !salvo ||
      salvo.p !== p.data ||
      !iguaisSemVazar(salvo.s, consulta.data.state)
    ) {
      return voltarAoLogin(res, 'oauth_invalido');
    }

    let usuarioId: string;
    try {
      const perfil = await provedor.obterPerfil(consulta.data.code, salvo.v);
      const usuario = await entrarComOAuth(ctx.prisma, p.data as Provedor, perfil);
      usuarioId = usuario.id;
    } catch (erro) {
      if (erro instanceof ErroConta) return voltarAoLogin(res, erro.codigo);
      console.error('[oauth]', erro);
      return voltarAoLogin(res, 'oauth_falhou');
    }
    await abrirSessao(res, usuarioId);
    res.redirect(302, `${ctx.appUrl}/jogo`);
  });

  return r;
}

function lerCookieOAuth(bruto: unknown): { p: string; s: string; v: string } | null {
  if (typeof bruto !== 'string') return null;
  try {
    const v: unknown = JSON.parse(bruto);
    if (
      typeof v === 'object' && v !== null &&
      'p' in v && typeof v.p === 'string' &&
      's' in v && typeof v.s === 'string' &&
      'v' in v && typeof v.v === 'string'
    ) {
      return { p: v.p, s: v.s, v: v.v };
    }
  } catch {
    // cookie corrompido: tratado como ausente
  }
  return null;
}
