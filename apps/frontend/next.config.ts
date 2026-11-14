import path from 'node:path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import type { NextConfig } from 'next';

// Raiz do monorepo: o Turbopack precisa enxergar packages/game-core.
const raizMonorepo = path.resolve(process.cwd(), '../..');

// Endereço do Express visto de dentro da rede do Compose.
const backend = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:4000';

// Páginas só de desenvolvimento terminam em `.dev.tsx` (a galeria de mundos):
// fora do servidor de desenvolvimento elas nem entram no build.
// 'dev.tsx' fica no fim: na frente, o Turbopack (Next 16.4) entra num laço de
// recarga da página inteira.
const extensoesDev = ['tsx', 'ts', 'jsx', 'js', 'dev.tsx'];
const extensoesProducao = ['tsx', 'ts', 'jsx', 'js'];

const base: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@cronarca/game-core'],
  turbopack: { root: raizMonorepo },
  outputFileTracingRoot: raizMonorepo,
  // Mesma origem: o navegador só fala com o Next, que repassa /api ao Express.
  async rewrites() {
    return [{ source: '/api/:caminho*', destination: `${backend}/:caminho*` }];
  },
};

export default function config(fase: string): NextConfig {
  return {
    ...base,
    pageExtensions: fase === PHASE_DEVELOPMENT_SERVER ? extensoesDev : extensoesProducao,
    // Permite um build de conferência sem mexer no .next do servidor de desenvolvimento.
    ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  };
}
