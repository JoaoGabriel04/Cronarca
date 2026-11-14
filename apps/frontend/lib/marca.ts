// Marca do Cronarca (portão Logo e ícone): o selo do relógio e o nome em pixel
// art dourado. O nome é imagem, nunca texto; toda ampliação é por múltiplo
// inteiro, com image-rendering: pixelated. Arquivos em public/marca e app/.

export const MARCA = {
  nome: 'Cronarca',
  descricao: 'Crônicas de um reino por erguer. Jogo incremental medieval.',
  /** Logo completa (selo + nome) a 6x: 546 x 192. No palco do Início e do Login, 6 px por pixel da arte = --u px de tela. */
  logo: { src: '/marca/logo-completa.png', largura: 546, altura: 192 },
  /** Nome sozinho a 8x (448 x 80); a arte tem 56 x 10. */
  nome8x: { src: '/marca/nome-cronarca.png', largura: 448, altura: 80 },
  /** Selo nos lados de múltiplo de 32 (o de 16 é desenhado à parte). */
  selo: (lado: 16 | 32 | 64 | 128 | 256 | 512) => `/marca/icone-${lado}.png`,
  /**
   * Ícones da aba, com o tamanho declarado: o navegador escolhe o 16 desenhado
   * à mão em tela comum e o 32 em alta densidade, sem reduzir um no outro.
   * O /favicon.ico (16 + 32) fica em public para quem pedir direto.
   */
  iconesAba: [
    { src: '/marca/icone-16.png', lado: 16 },
    { src: '/marca/icone-32.png', lado: 32 },
  ],
  /** Tela inicial do iPhone: 180 x 180, opaco (fundo da arte). */
  apple: { src: '/marca/apple-touch-180.png', lado: 180 },
  /** Ícones do manifest (instalar no celular). */
  iconesManifest: [
    { src: '/marca/android-192.png', lado: 192 },
    { src: '/marca/icone-512.png', lado: 512 },
  ],
} as const;

/** Fundo do jogo (--tela): cor do tema do navegador e do manifest. */
export const CORES_MARCA = { fundo: '#14201c' } as const;
