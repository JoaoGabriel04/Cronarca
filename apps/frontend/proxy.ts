import { NextResponse, type NextRequest } from 'next/server';

// Mesmo nome de cookie do backend (apps/backend/src/config.ts).
const COOKIE_SESSAO = 'cronarca_sessao';

/**
 * Barreira rápida das rotas do jogo: sem cookie de sessão, vai para o login.
 * Não valida o token (isso é do backend); se o cookie for inválido, o
 * backend responde 401 e apaga o cookie, e a página manda para o login.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE_SESSAO)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?voltar=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/jogo/:caminho*'],
};
