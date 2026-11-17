import { createHash } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { CONFIG_AUTH, CONFIG_CONVIDADO } from '../config.ts';
import type { ContextoApp } from '../contexto.ts';
import type { Provedor } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { exigirSessao } from '../middleware.ts';
import { criarConvidado, ErroConvidado } from './convidado.ts';
import { entrarComOAuth, ErroConta } from './contas.ts';
import { apagarCookieOAuth, apagarCookieSessao, gravarCookieOAuth, gravarCookieSessao } from './cookies.ts';
import {
  camposComErro, esquemaCadastro, esquemaCallback, esquemaConfirmarVinculo, esquemaConvidado, esquemaLogin, esquemaProvedor,
  esquemaVincularEmail,
} from './esquemas.ts';
import { LimiteTentativas } from './limite.ts';
import { conferirSenha, gerarHashSenha } from './senha.ts';
import { criarSessao, encerrarSessao } from './sessao.ts';
import { gerarToken, iguaisSemVazar } from './tokens.ts';
import { usuarioPublico } from './usuario-publico.ts';
import { anexarOAuth, confirmarVinculo, vincularPorEmail } from './vinculo.ts';

function responderMuitasTentativas(res: Response, esperarS: number) {
  res.setHeader('Retry-After', String(esperarS));
  res.status(429).json({ erro: 'muitas_tentativas', esperarS });
}

function ipDe(req: Request): string {
  return req.ip ?? 'desconhecido';
}

/** Endereço de rede privada ou local: se req.ip cai aqui em produção, o proxy não repassou o IP do jogador. */
export function ipPrivado(ip: string): boolean {
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i.test(ip.replace(/^::ffff:/i, ''));
}

/** Resposta de erro do vínculo: o código vai ao cliente, que decide o que mostrar (nunca mescla). */
function erroDeVinculo(res: Response, erro: ErroConta) {
  const status = erro.codigo === 'nao_e_convidado' || erro.codigo === 'conta_ja_vinculada' ? 409 : 400;
  res.status(status).json({ erro: erro.codigo });
}

export function rotasAuth(ctx: ContextoApp) {
  const r = Router();
  const agoraMs = () => ctx.agora().getTime();
  const limiteLoginIp = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);
  const limiteLoginEmail = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);
  const limiteCadastroIp = new LimiteTentativas(CONFIG_AUTH.limiteJanelaMs, CONFIG_AUTH.limiteTentativas, agoraMs);
  const limiteConvidadoIp = new LimiteTentativas(CONFIG_CONVIDADO.janelaMs, CONFIG_CONVIDADO.porIpPorJanela, agoraMs);
  let registrosDeProxy = 0;

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

  // ---- Conta de convidado (Portão B) ----

  r.post('/convidado', async (req, res) => {
    if (!esquemaConvidado.safeParse(req.body ?? {}).success) {
      res.status(400).json({ erro: 'dados_invalidos' });
      return;
    }
    // Para conferir em produção se o IP do jogador chega até aqui (sem gravar o endereço).
    if (registrosDeProxy < 5 && process.env.NODE_ENV !== 'test') {
      registrosDeProxy += 1;
      // Só um prefixo do hash do IP (nunca o endereço): dá para comparar redes diferentes sem gravar dado pessoal.
      const marca = createHash('sha256').update(ipDe(req)).digest('hex').slice(0, 6);
      console.log(`[convidado] saltos de proxy: ${req.ips.length}; req.ip privado: ${ipPrivado(ipDe(req))}; marca do ip: ${marca}`);
    }
    const ip = `ip:${ipDe(req)}`;
    if (ctx.limiteConvidadoIp) {
      const lim = limiteConvidadoIp.consultar(ip);
      if (!lim.permitido) return responderMuitasTentativas(res, lim.esperarS);
    }
    try {
      const usuario = await criarConvidado(ctx.prisma, ctx.agora());
      if (ctx.limiteConvidadoIp) limiteConvidadoIp.registrar(ip);
      await abrirSessao(res, usuario.id);
      res.status(201).json({ usuario: await usuarioPublico(ctx.prisma, usuario) });
    } catch (erro) {
      if (erro instanceof ErroConvidado) {
        res.setHeader('Retry-After', String(erro.esperarS));
        res.status(429).json({ erro: erro.codigo, esperarS: erro.esperarS });
        return;
      }
      throw erro;
    }
  });

  r.post('/vincular/email', exigirSessao, async (req, res) => {
    const dados = esquemaVincularEmail.safeParse(req.body);
    if (!dados.success) {
      res.status(400).json({ erro: 'dados_invalidos', campos: camposComErro(dados.error) });
      return;
    }
    const { nome, email, senha } = dados.data;
    try {
      const senhaHash = await gerarHashSenha(senha, ctx.bcryptCusto);
      const usuario = await vincularPorEmail(ctx.prisma, res.locals.usuario!.id, { nome, email, senhaHash }, ctx.agora());
      res.json({ usuario: await usuarioPublico(ctx.prisma, usuario) });
    } catch (erro) {
      if (erro instanceof ErroConta) return erroDeVinculo(res, erro);
      throw erro;
    }
  });

  r.post('/vincular/confirmar', exigirSessao, async (req, res) => {
    const dados = esquemaConfirmarVinculo.safeParse(req.body);
    if (!dados.success) {
      res.status(400).json({ erro: 'dados_invalidos', campos: camposComErro(dados.error) });
      return;
    }
    try {
      const usuario = await confirmarVinculo(ctx.prisma, res.locals.usuario!.id, dados.data.nome, ctx.agora());
      res.json({ usuario: await usuarioPublico(ctx.prisma, usuario) });
    } catch (erro) {
      if (erro instanceof ErroConta) return erroDeVinculo(res, erro);
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

  const voltarAoJogo = (res: Response, consulta: Record<string, string>) =>
    res.redirect(302, `${ctx.appUrl}/jogo?${new URLSearchParams(consulta).toString()}`);

  r.get('/:provedor/iniciar', (req, res) => {
    const p = esquemaProvedor.safeParse(req.params.provedor);
    const provedor = p.success ? ctx.provedores[p.data] : undefined;
    if (!p.success || !provedor) return voltarAoLogin(res, 'provedor_indisponivel');

    const state = gerarToken();
    const verificador = gerarToken();
    gravarCookieOAuth(res, JSON.stringify({ p: p.data, s: state, v: verificador }), ctx.producao);
    res.redirect(302, provedor.urlAutorizacao(state, verificador).toString());
  });

  // Vínculo do convidado com Google ou Discord: a intenção e o id vão no cookie do fluxo, nunca na URL.
  r.get('/:provedor/vincular', (req, res) => {
    const p = esquemaProvedor.safeParse(req.params.provedor);
    const provedor = p.success ? ctx.provedores[p.data] : undefined;
    const usuario = res.locals.usuario;
    if (!p.success || !provedor) return voltarAoJogo(res, { vinculo_erro: 'provedor_indisponivel' });
    if (!usuario?.convidado) return voltarAoJogo(res, { vinculo_erro: 'nao_e_convidado' });

    const state = gerarToken();
    const verificador = gerarToken();
    gravarCookieOAuth(res, JSON.stringify({ p: p.data, s: state, v: verificador, i: 'vincular', u: usuario.id }), ctx.producao);
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

    if (salvo.i === 'vincular') {
      // Só vale para a mesma pessoa que iniciou o vínculo (a sessão atual é a do convidado do cookie).
      if (!salvo.u || res.locals.usuario?.id !== salvo.u) return voltarAoJogo(res, { vinculo_erro: 'oauth_invalido' });
      try {
        const perfil = await provedor.obterPerfil(consulta.data.code, salvo.v);
        const usuario = await anexarOAuth(ctx.prisma, salvo.u, p.data as Provedor, perfil);
        const sugestao = (perfil.nome ?? '').trim() || (usuario.email ?? '').split('@')[0] || '';
        return voltarAoJogo(res, { vinculo: 'nome', nome: sugestao.slice(0, CONFIG_AUTH.nomeMax) });
      } catch (erro) {
        if (erro instanceof ErroConta) return voltarAoJogo(res, { vinculo_erro: erro.codigo });
        console.error('[oauth-vinculo]', erro);
        return voltarAoJogo(res, { vinculo_erro: 'oauth_falhou' });
      }
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

function lerCookieOAuth(bruto: unknown): { p: string; s: string; v: string; i?: string; u?: string } | null {
  if (typeof bruto !== 'string') return null;
  try {
    const v: unknown = JSON.parse(bruto);
    if (
      typeof v === 'object' && v !== null &&
      'p' in v && typeof v.p === 'string' &&
      's' in v && typeof v.s === 'string' &&
      'v' in v && typeof v.v === 'string'
    ) {
      return {
        p: v.p, s: v.s, v: v.v,
        ...('i' in v && typeof v.i === 'string' ? { i: v.i } : {}),
        ...('u' in v && typeof v.u === 'string' ? { u: v.u } : {}),
      };
    }
  } catch {
    // cookie corrompido: tratado como ausente
  }
  return null;
}
