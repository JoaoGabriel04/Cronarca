import type { CookieOptions, Response } from 'express';
import { CONFIG_AUTH } from '../config.ts';

function base(producao: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: producao, path: '/' };
}

export function gravarCookieSessao(res: Response, token: string, expiraEm: Date, producao: boolean) {
  res.cookie(CONFIG_AUTH.cookieSessao, token, { ...base(producao), expires: expiraEm });
}

export function apagarCookieSessao(res: Response, producao: boolean) {
  res.clearCookie(CONFIG_AUTH.cookieSessao, base(producao));
}

export function gravarCookieOAuth(res: Response, valor: string, producao: boolean) {
  res.cookie(CONFIG_AUTH.cookieOAuth, valor, { ...base(producao), maxAge: CONFIG_AUTH.oauthValidadeMs });
}

export function apagarCookieOAuth(res: Response, producao: boolean) {
  res.clearCookie(CONFIG_AUTH.cookieOAuth, base(producao));
}
