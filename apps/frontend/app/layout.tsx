import type { Metadata, Viewport } from 'next';
import { Alegreya_Sans, Alegreya_SC, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SCRIPT_ESCALA } from '../components/cena/escala';
import { CORES_MARCA, MARCA } from '../lib/marca';
import './globals.css';

const titulo = Alegreya_SC({ weight: '700', subsets: ['latin'], variable: '--fonte-titulo' });
const texto = Alegreya_Sans({ weight: ['400', '700'], subsets: ['latin'], variable: '--fonte-texto' });
const numeros = IBM_Plex_Mono({ weight: '500', subsets: ['latin'], variable: '--fonte-numero' });

/**
 * Endereço público para os links absolutos de compartilhamento. Na Vercel vem
 * da variável de sistema do domínio de produção; em desenvolvimento, localhost.
 */
const urlDoSite = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

// Ícones da aba (16 e 32, com o tamanho declarado) e do iPhone (180), todos em
// public/marca; o manifest vem de app/manifest.ts; /favicon.ico (16 + 32) em public.
export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite),
  title: { default: MARCA.nome, template: `%s · ${MARCA.nome}` },
  description: MARCA.descricao,
  applicationName: MARCA.nome,
  icons: {
    icon: MARCA.iconesAba.map((i) => ({ url: i.src, sizes: `${i.lado}x${i.lado}`, type: 'image/png' })),
    shortcut: '/favicon.ico',
    apple: [{ url: MARCA.apple.src, sizes: `${MARCA.apple.lado}x${MARCA.apple.lado}`, type: 'image/png' }],
  },
  // Compartilhamento: cartão pequeno com o selo (imagem Open Graph própria é pendência).
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: MARCA.nome,
    title: MARCA.nome,
    description: MARCA.descricao,
    images: [{ url: MARCA.selo(512), width: 512, height: 512, alt: 'Selo do Cronarca' }],
  },
  twitter: { card: 'summary', title: MARCA.nome, description: MARCA.descricao, images: [MARCA.selo(512)] },
};

/** viewport-fit=cover: sem ele o env(safe-area-inset-bottom) das abas do celular vale 0 no iPhone. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: CORES_MARCA.fundo,
  // Chrome no Android: o teclado encolhe a área da página (o dvh acompanha); no iPhone, lib/cena/teclado.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: o script abaixo grava a escala no <html> antes da hidratação.
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable} ${numeros.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ESCALA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
