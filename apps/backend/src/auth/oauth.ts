// OAuth2 com PKCE para Google e Discord, sem biblioteca: só fetch.
// Cada provedor sabe montar a URL de autorização e trocar o código pelo perfil.
import { z } from 'zod';
import type { Provedor } from '../generated/prisma/client.ts';
import { desafioPkce } from './tokens.ts';

export interface PerfilOAuth {
  providerAccountId: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string | null;
  avatarUrl: string | null;
}

export interface ProvedorOAuth {
  urlAutorizacao(state: string, verificador: string): URL;
  obterPerfil(codigo: string, verificador: string): Promise<PerfilOAuth>;
}

export type ProvedoresOAuth = Partial<Record<Provedor, ProvedorOAuth>>;

interface Credenciais {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const respostaToken = z.object({ access_token: z.string(), id_token: z.string().optional() });

async function trocarCodigo(
  urlToken: string,
  cred: Credenciais,
  codigo: string,
  verificador: string,
) {
  const corpo = new URLSearchParams({
    grant_type: 'authorization_code',
    code: codigo,
    redirect_uri: cred.redirectUri,
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
    code_verifier: verificador,
  });
  const res = await fetch(urlToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: corpo,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`troca de código recusada (${res.status})`);
  return respostaToken.parse(await res.json());
}

function urlComPkce(base: string, cred: Credenciais, escopos: string, state: string, verificador: string) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: cred.clientId,
    redirect_uri: cred.redirectUri,
    scope: escopos,
    state,
    code_challenge: desafioPkce(verificador),
    code_challenge_method: 'S256',
  }).toString();
  return url;
}

const perfilGoogle = z.object({
  sub: z.string(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.url().optional(),
});

export function provedorGoogle(cred: Credenciais): ProvedorOAuth {
  return {
    urlAutorizacao: (state, verificador) =>
      urlComPkce('https://accounts.google.com/o/oauth2/v2/auth', cred, 'openid email profile', state, verificador),
    async obterPerfil(codigo, verificador) {
      const { access_token } = await trocarCodigo('https://oauth2.googleapis.com/token', cred, codigo, verificador);
      // O perfil vem do endpoint de userinfo, pelo canal TLS com o Google,
      // em vez de decodificar o id_token sem validar a assinatura.
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`userinfo do Google recusou (${res.status})`);
      const p = perfilGoogle.parse(await res.json());
      return {
        providerAccountId: p.sub,
        email: p.email ?? null,
        emailVerificado: p.email_verified === true,
        nome: p.name ?? null,
        avatarUrl: p.picture ?? null,
      };
    },
  };
}

const perfilDiscord = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullish(),
  email: z.string().nullish(),
  verified: z.boolean().optional(),
  avatar: z.string().nullish(),
});

export function provedorDiscord(cred: Credenciais): ProvedorOAuth {
  return {
    urlAutorizacao: (state, verificador) =>
      urlComPkce('https://discord.com/oauth2/authorize', cred, 'identify email', state, verificador),
    async obterPerfil(codigo, verificador) {
      const { access_token } = await trocarCodigo('https://discord.com/api/oauth2/token', cred, codigo, verificador);
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`perfil do Discord recusou (${res.status})`);
      const p = perfilDiscord.parse(await res.json());
      return {
        providerAccountId: p.id,
        email: p.email ?? null,
        emailVerificado: p.verified === true,
        nome: p.global_name ?? p.username,
        avatarUrl: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : null,
      };
    },
  };
}

interface EnvOAuth {
  APP_URL: string;
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  DISCORD_CLIENT_ID?: string | undefined;
  DISCORD_CLIENT_SECRET?: string | undefined;
}

/** Liga só os provedores com id e segredo preenchidos no .env. */
export function provedoresDoEnv(env: EnvOAuth): ProvedoresOAuth {
  const retorno = (p: Provedor) => `${env.APP_URL}/api/auth/${p}/callback`;
  const provedores: ProvedoresOAuth = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    provedores.google = provedorGoogle({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: retorno('google'),
    });
  }
  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    provedores.discord = provedorDiscord({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      redirectUri: retorno('discord'),
    });
  }
  return provedores;
}
