import type { RequestHandler } from 'express';
import { apagarCookieSessao, gravarCookieSessao } from './auth/cookies.ts';
import { validarSessao } from './auth/sessao.ts';
import { CONFIG_AUTH } from './config.ts';
import type { ContextoApp } from './contexto.ts';

/**
 * Proteção contra CSRF: toda requisição que muda estado precisa vir do
 * próprio site. Junto com SameSite=Lax no cookie, isso fecha o caminho de
 * formulários e fetch de outras origens.
 */
export function exigirMesmaOrigem(ctx: ContextoApp): RequestHandler {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (req.get('origin') !== ctx.appUrl) {
      res.status(403).json({ erro: 'origem_invalida' });
      return;
    }
    next();
  };
}

/** Lê o cookie de sessão; se válido, põe o usuário em res.locals. Nunca bloqueia. */
export function carregarSessao(ctx: ContextoApp): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[CONFIG_AUTH.cookieSessao];
    if (typeof token !== 'string' || token === '') return next();

    const sessao = await validarSessao(ctx.prisma, token, ctx.agora());
    if (!sessao) {
      apagarCookieSessao(res, ctx.producao);
      return next();
    }
    res.locals.usuario = sessao.usuario;
    res.locals.sessaoId = sessao.sessaoId;
    if (sessao.renovada) gravarCookieSessao(res, token, sessao.expiraEm, ctx.producao);
    next();
  };
}

export const exigirSessao: RequestHandler = (_req, res, next) => {
  if (!res.locals.usuario) {
    res.status(401).json({ erro: 'nao_autenticado' });
    return;
  }
  next();
};
