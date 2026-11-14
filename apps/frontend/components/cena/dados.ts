// Gerado a partir do Figma (Telas v2: Inicio - Desktop e Login - Desktop).
// Coordenadas em pixels do frame de 1440x900, alinhadas à grade de 6 px
// (1 pixel de sprite = 6 px do frame). Não edite à mão sem conferir no Figma.

export interface SpriteNaCena { nome: string; canvas: number; x: number; y: number; quadro: 1 | 2 }
/** [y inicial, y final, cor] da coluna da borda, para estender o cenário em telas largas. */
export type Faixa = readonly [number, number, string];
export interface DadosCena { fundo: string; esquerda: readonly Faixa[]; direita: readonly Faixa[]; sprites: readonly SpriteNaCena[] }

export const CENA_INICIO: DadosCena = {
  fundo: '/cenas/inicio.svg',
  esquerda: [[0, 120, "#0a0e2a"], [120, 240, "#10163c"], [240, 348, "#1a2658"], [348, 438, "#2a3a78"], [438, 492, "#4a5a98"], [492, 534, "#1a2a4a"], [534, 552, "#122a28"], [552, 558, "#2a5a3a"], [558, 600, "#1c3a2a"], [600, 756, "#183226"], [756, 900, "#12281e"]],
  direita: [[0, 120, "#0a0e2a"], [120, 240, "#10163c"], [240, 348, "#1a2658"], [348, 438, "#2a3a78"], [438, 492, "#4a5a98"], [492, 504, "#8a6a98"], [504, 552, "#1a2a4a"], [552, 558, "#2a5a3a"], [558, 600, "#1c3a2a"], [600, 756, "#183226"], [756, 900, "#12281e"]],
  sprites: [
    { nome: 'castelo', canvas: 48, x: 576, y: 276, quadro: 1 },
    { nome: 'pinheiro', canvas: 32, x: -30, y: 402, quadro: 1 },
    { nome: 'pinheiro', canvas: 32, x: 168, y: 450, quadro: 2 },
    { nome: 'pinheiro', canvas: 32, x: 1278, y: 402, quadro: 1 },
    { nome: 'pinheiro', canvas: 32, x: 1092, y: 450, quadro: 2 },
    { nome: 'arbusto', canvas: 32, x: 378, y: 540, quadro: 1 },
    { nome: 'arbusto', canvas: 32, x: 882, y: 540, quadro: 2 },
    { nome: 'cavaleiro', canvas: 32, x: 150, y: 660, quadro: 1 },
    { nome: 'fogueira', canvas: 32, x: 330, y: 690, quadro: 1 },
    { nome: 'flores', canvas: 32, x: 1008, y: 702, quadro: 1 },
    { nome: 'placa', canvas: 32, x: 1242, y: 648, quadro: 1 },
    { nome: 'cerca', canvas: 32, x: 1128, y: 738, quadro: 1 },
  ],
};

export const CENA_LOGIN: DadosCena = {
  fundo: '/cenas/login.svg',
  esquerda: [[0, 120, "#0a0e2a"], [120, 240, "#10163c"], [240, 348, "#1a2658"], [348, 438, "#2a3a78"], [438, 492, "#4a5a98"], [492, 540, "#1a2a4a"], [540, 552, "#122a28"], [552, 558, "#2a5a3a"], [558, 600, "#1c3a2a"], [600, 756, "#183226"], [756, 900, "#12281e"]],
  direita: [[0, 120, "#0a0e2a"], [120, 240, "#10163c"], [240, 348, "#1a2658"], [348, 438, "#2a3a78"], [438, 492, "#4a5a98"], [492, 522, "#8a6a98"], [522, 534, "#c8826a"], [534, 546, "#1a2a4a"], [546, 552, "#122a28"], [552, 558, "#2a5a3a"], [558, 600, "#1c3a2a"], [600, 756, "#183226"], [756, 900, "#12281e"]],
  sprites: [
    { nome: 'castelo', canvas: 48, x: 150, y: 276, quadro: 1 },
    { nome: 'pinheiro', canvas: 32, x: -42, y: 420, quadro: 1 },
    { nome: 'pinheiro', canvas: 32, x: 468, y: 468, quadro: 2 },
    { nome: 'cavaleiro', canvas: 32, x: 60, y: 690, quadro: 1 },
    { nome: 'fogueira', canvas: 32, x: 252, y: 708, quadro: 1 },
    { nome: 'arbusto', canvas: 32, x: 432, y: 720, quadro: 1 },
  ],
};
