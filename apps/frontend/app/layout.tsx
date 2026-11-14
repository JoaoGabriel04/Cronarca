import type { Metadata, Viewport } from 'next';
import { Alegreya_Sans, Alegreya_SC, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SCRIPT_ESCALA } from '../components/cena/escala';
import './globals.css';

const titulo = Alegreya_SC({ weight: '700', subsets: ['latin'], variable: '--fonte-titulo' });
const texto = Alegreya_Sans({ weight: ['400', '700'], subsets: ['latin'], variable: '--fonte-texto' });
const numeros = IBM_Plex_Mono({ weight: '500', subsets: ['latin'], variable: '--fonte-numero' });

export const metadata: Metadata = {
  title: 'Cronarca',
  description: 'Crônicas de um reino por erguer. Jogo incremental medieval.',
};

/** viewport-fit=cover: sem ele o env(safe-area-inset-bottom) das abas do celular vale 0 no iPhone. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
