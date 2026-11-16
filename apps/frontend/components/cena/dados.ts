// Dados da cena do Início e do Login (Tela inicial v2). As posições vêm do
// Figma (Telas v2: "Início - Desktop/Mobile" e "Login - Desktop/Mobile"),
// em pixels do frame de 1440x900 (desktop) e de 390 de largura (celular).
// Só os sprites da LISTA FECHADA abaixo entram na cena; nenhum outro.
//
// Escala (desktop): `k` é quantos pixels do frame valem um pixel de arte (3 ou
// 4). O palco é escalado por --z = u/6 (u inteiro); para o sprite ficar
// sempre em pixel inteiro na tela, o script de escala (escala.ts) calcula
// quantos pixels de tela vale cada pixel de arte, round(k * u / 6), e o CSS usa
// isso (globals.css). Em 1440x900 (u = 6) os tamanhos são exatamente os do Figma.

import { animacao } from '@cronarca/game-core';

/**
 * LISTA FECHADA: os únicos sprites que a cena pode renderizar (grupo "cena" do
 * quadros_cena.json). Todos têm quadros; as durações vêm só desse arquivo.
 */
export const SPRITES_DA_CENA = ['pinho0', 'pinho1', 'castelo', 'cavaleiro', 'fogueira', 'flores', 'placa', 'cerca'] as const;
export type NomeSpriteCena = (typeof SPRITES_DA_CENA)[number];

/** Pixels do frame por pixel de arte (desktop). */
export type EscalaCena = 3 | 4;
export const ESCALAS_DA_CENA: readonly EscalaCena[] = [3, 4];

/** Lado do canvas do sprite, em pixels de arte (do quadros_cena.json). */
export const ladoDaArte = (nome: NomeSpriteCena): number => animacao('cena', nome).tamanho;

/** Sprite no palco do desktop: canto superior esquerdo nominal do canvas, em px do frame de 1440x900. */
export interface SpriteNaCena {
  nome: NomeSpriteCena;
  k: EscalaCena;
  x: number;
  y: number;
}

/** Âncora horizontal no celular: a partir da borda esquerda, do centro ou da borda direita da coluna. */
export type AncoraCelular = 'esq' | 'centro' | 'dir';

/**
 * Sprite no celular (frame de 390 de largura do Figma). `dx` é a distância da âncora
 * até o mesmo ponto do sprite (borda esquerda, centro ou borda direita); `y` é o topo
 * nominal do canvas em relação ao topo do bloco da paisagem. `k` (3 ou 4) é a escala
 * a partir de 384 px de largura; abaixo disso a escala cai um passo (castelo 3x, o resto 2x).
 */
export interface SpriteCelular {
  nome: NomeSpriteCena;
  k: 3 | 4;
  ancora: AncoraCelular;
  dx: number;
  y: number;
}

/**
 * Paisagem do celular: um bloco (altura fixa) entre o título e o menu ou cartão,
 * com o fundo a 6x (1440 px de largura, centralizado) deslocado de `fundoY` em
 * relação ao topo do bloco e os sprites acima, ancorados nas bordas e no centro.
 */
export interface CenaCelular {
  altura: number;
  margemTopo: number;
  fundoY: number;
  sprites: readonly SpriteCelular[];
}

export interface DadosCena {
  id: 'inicio' | 'login';
  /**
   * O mesmo fundo largo (PNG de 420x210, 1 px de arte = 6 px do frame) no Início e no Login. A janela central de
   * 240x150 (x 90..329, y 30..179) é o palco de 1440x900; o resto é sangria (90 de cada lado, 30 em cima e embaixo).
   */
  fundo: string;
  sprites: readonly SpriteNaCena[];
  celular: CenaCelular;
}

const FUNDO = '/cenas/inicio_largo.png';

/** Posição da janela central (o palco) dentro do fundo largo, em pixels de arte; no frame são 6x: left -540, top -180. */
export const JANELA_NO_FUNDO = { x: 90, y: 30, largura: 420, altura: 210 } as const;


/** Camadas, de baixo para cima: pinhos médios (3x, atrás do castelo), castelo, pinhos de perto (4x), personagens e objetos (4x). */
const PINHOS_MEDIOS_ESQUERDA: readonly SpriteNaCena[] = [
  { nome: 'pinho1', k: 3, x: 250, y: 470 },
  { nome: 'pinho0', k: 3, x: 400, y: 455 },
];
const CASTELO: SpriteNaCena = { nome: 'castelo', k: 4, x: 528, y: 222 };
const PERSONAGENS: readonly SpriteNaCena[] = [
  { nome: 'cavaleiro', k: 4, x: 60, y: 662 },
  { nome: 'fogueira', k: 4, x: 230, y: 752 },
];

export const CENA_INICIO: DadosCena = {
  id: 'inicio',
  fundo: FUNDO,
  sprites: [
    ...PINHOS_MEDIOS_ESQUERDA,
    { nome: 'pinho0', k: 3, x: 980, y: 470 },
    CASTELO,
    { nome: 'pinho0', k: 4, x: -20, y: 420 },
    { nome: 'pinho1', k: 4, x: 1230, y: 430 },
    ...PERSONAGENS,
    { nome: 'flores', k: 4, x: 1010, y: 776 },
    { nome: 'flores', k: 4, x: 1300, y: 816 },
    ...[0, 1, 2, 3].map((i): SpriteNaCena => ({ nome: 'cerca', k: 4, x: 1130 + 64 * i, y: 776 })),
    { nome: 'placa', k: 4, x: 1280, y: 632 },
  ],
  // Frame de 390: castelo em (3,150); o bloco vai do topo do castelo (150) ao topo do menu (650).
  celular: {
    altura: 500,
    margemTopo: 7,
    fundoY: -222,
    sprites: [
      { nome: 'pinho0', k: 3, ancora: 'esq', dx: -50, y: 270 },
      { nome: 'pinho1', k: 3, ancora: 'dir', dx: -50, y: 280 },
      { nome: 'castelo', k: 4, ancora: 'centro', dx: 0, y: 0 },
      { nome: 'cavaleiro', k: 3, ancora: 'esq', dx: 10, y: 406 },
      { nome: 'fogueira', k: 3, ancora: 'esq', dx: 118, y: 414 },
      { nome: 'flores', k: 3, ancora: 'dir', dx: 52, y: 454 },
      { nome: 'flores', k: 3, ancora: 'dir', dx: 12, y: 470 },
    ],
  },
};

/** Login: pinhos médios da esquerda, castelo, pinho de perto da esquerda, cavaleiro e fogueira (sem o lado direito, que o cartão ocupa, nem flores, cerca e placa). */
export const CENA_LOGIN: DadosCena = {
  id: 'login',
  fundo: FUNDO,
  sprites: [...PINHOS_MEDIOS_ESQUERDA, CASTELO, { nome: 'pinho0', k: 4, x: -20, y: 420 }, ...PERSONAGENS],
  // Frame de 390: castelo em (3,62) no cabeçalho de 424; o formulário começa em 416.
  celular: {
    altura: 394,
    margemTopo: -26,
    fundoY: -222,
    sprites: [{ nome: 'castelo', k: 4, ancora: 'centro', dx: 0, y: 0 }],
  },
};
