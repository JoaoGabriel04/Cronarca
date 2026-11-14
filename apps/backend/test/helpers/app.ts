import request from 'supertest';
import { criarApp } from '../../src/app.ts';
import type { PerfilOAuth, ProvedorOAuth, ProvedoresOAuth } from '../../src/auth/oauth.ts';
import type { ConfigCloudinary } from '../../src/avatar/cloudinary.ts';
import type { ContextoApp } from '../../src/contexto.ts';
import { prisma } from './prisma.ts';

export const APP_URL = 'http://localhost:3000';

/**
 * Relógio controlado pelo teste. Começa na hora real: o jar de cookies do
 * supertest descarta cookies cujo Expires já passou pelo relógio de verdade.
 */
export function criarRelogio(inicio = new Date()) {
  let agora = inicio.getTime();
  return {
    agora: () => new Date(agora),
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

export function criarAppTeste(sobrescrever: Partial<ContextoApp> = {}) {
  return criarApp({
    prisma,
    verificarBanco: async () => true,
    appUrl: APP_URL,
    producao: false,
    provedores: {},
    cloudinary: null,
    bcryptCusto: 4,
    agora: () => new Date(),
    sortearSemente: () => 42,
    ...sobrescrever,
  });
}

/** Agente com cookies e o cabeçalho Origin do próprio site em toda requisição. */
export function agente(app: ReturnType<typeof criarAppTeste>) {
  const a = request.agent(app);
  a.set('Origin', APP_URL);
  return a;
}

/** Provedor OAuth falso: a "autorização" devolve o perfil que o teste definir. */
export function provedorFalso(perfil: () => PerfilOAuth) {
  const chamadas: { codigo: string; verificador: string }[] = [];
  const provedor: ProvedorOAuth = {
    urlAutorizacao: (state, verificador) => {
      const url = new URL('https://provedor.teste/autorizar');
      url.searchParams.set('state', state);
      url.searchParams.set('verificador', verificador);
      return url;
    },
    obterPerfil: async (codigo, verificador) => {
      chamadas.push({ codigo, verificador });
      return perfil();
    },
  };
  return { provedor, chamadas };
}

export type { ConfigCloudinary, ProvedoresOAuth };

/** Extrai nome=valor dos Set-Cookie de uma resposta. */
export function cookiesDe(res: request.Response): Record<string, string> {
  const brutos = res.headers['set-cookie'] as unknown as string[] | undefined;
  const mapa: Record<string, string> = {};
  for (const c of brutos ?? []) {
    const [par] = c.split(';');
    const i = par!.indexOf('=');
    mapa[par!.slice(0, i)] = decodeURIComponent(par!.slice(i + 1));
  }
  return mapa;
}
