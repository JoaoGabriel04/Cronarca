// Mapa grande fixo (A13, CRONARCA_MAPA_GRANDE.md). O layout vem de
// data/mapa_meta.json (validado em src/mapa/meta.ts); aqui ficam as unidades,
// a tabela de escala do que o mapa desenha por cima da imagem (construções,
// props do núcleo) e os números da interação e das sombras.

import type { Oficio } from './aventureiros.ts';
import type { DestinoId } from './expedicoes.ts';
import type { Recurso } from './recursos.ts';

/** Lado de um tile, em unidades de mundo (1 unidade = 1 pixel de sprite). */
export const TILE = 32;

/**
 * Versões do mapa que este código sabe desenhar (estado.mundo.versaoMapa).
 * A 2 (árvores com vento) só tira as árvores da imagem e as desenha por cima:
 * clicáveis, núcleo e destinos são os mesmos, então um save na 1 abre o mesmo mapa.
 */
export const VERSOES_MAPA = [1, 2] as const;
export type VersaoMapa = (typeof VERSOES_MAPA)[number];
export const VERSAO_MAPA_ATUAL: VersaoMapa = 2;

/** Zoom inteiro do mapa (seção 2): 1x a 4x. */
export const ZOOM_MAPA = { minimo: 1, maximo: 4 } as const;

/**
 * Tabela de escala (spec do mapa, seção 2): lado do sprite de cada tipo que o
 * mapa desenha por cima da imagem, em mundo. Multiplicador 1: o lado no mundo
 * é o canvas do sprite. Nenhum item tem tamanho fora desta tabela; o que está
 * no mapa_base.png (árvores, pedras, montanhas) já vem na escala certa.
 */
export const ESCALA = {
  construcao: 48,
  poco: 32,
  fogueira: 32,
  /**
   * EXPERIMENTO (pedido do dono, depois do portão de ajustes rápidos): aldeões
   * com 24 de lado no mundo (metade da construção) usando a arte de 32
   * (LADO_SPRITE_ALDEAO), reduzida no desenho: 0,75x em 1x, 1,5x em 2x, 2,25x
   * em 3x e 3x em 4x. Foge da regra de pixel inteiro; se não agradar, entra
   * uma arte de 24 px e este valor fica igual ao lado da arte.
   */
  aldeao: 24,
  /** O grupo em marcha (L7) usa este lado em px de tela, fixo em qualquer zoom (decisão do dono). */
  aventureiro: 32,
  flores: 16,
  cerca: 16,
  /** Árvores da versão 2 do mapa (L4), do mesmo tamanho do sprite pintado na arte. */
  arvore: 48,
} as const;
export type TipoEscala = keyof typeof ESCALA;

/** Props do núcleo (os tipos de cenário que continuam como sprites). */
export const TIPOS_PROP = ['poco', 'fogueira', 'flores', 'cerca'] as const satisfies readonly TipoEscala[];
export type TipoObjeto = (typeof TIPOS_PROP)[number];

/**
 * Props fixos do núcleo (spec do mapa, seção 5): canto superior esquerdo,
 * antes de somar a origem do núcleo. A imagem não tem esses props (A13):
 * continuam como sprites na L4.
 */
export const PROPS_NUCLEO = [
  { tipo: 'poco', x: 203, y: 236 },
  { tipo: 'fogueira', x: 176, y: 250 },
  { tipo: 'cerca', x: 316, y: 257 },
  { tipo: 'flores', x: 125, y: 208 },
  { tipo: 'flores', x: 161, y: 224 },
  { tipo: 'flores', x: 298, y: 215 },
  { tipo: 'flores', x: 143, y: 267 },
  { tipo: 'flores', x: 235, y: 283 },
] as const satisfies readonly { tipo: TipoObjeto; x: number; y: number }[];

/**
 * Aldeões na Vila (Portão 8): um por ofício presente, no máximo 5 figuras,
 * parados ao lado da construção do ofício (aparecem mesmo sem ela). Canto
 * superior esquerdo do sprite de 32, antes de somar a origem do núcleo,
 * tirado do frame "Cena da Vila" do Figma (Telas v2). "Sem função" não
 * entra na v0: todo aldeão chega com ofício.
 */
export const POSICOES_ALDEOES = {
  lenhador: { x: 103, y: 198 },
  mineiro: { x: 293, y: 145 },
  sabio: { x: 199, y: 220 },
  ferreiro: { x: 196, y: 288 },
  fazendeiro: { x: 150, y: 298 },
} as const satisfies Record<Oficio, { x: number; y: number }>;

/**
 * Ociosos (Portão 17) na praça, em volta da fogueira (portão de ajustes
 * rápidos): o k-ésimo Ocioso fica no lugar k, sem sorteio. Canto superior
 * esquerdo do sprite de 32, antes de somar a origem do núcleo, como em
 * POSICOES_ALDEOES. Só cabem estes sem cobrir a fogueira nem a fachada das
 * construções vizinhas (Taverna, Forja, Celeiro e o poço): acima disso não
 * aparecem mais figuras (o número exato está no cartão dos aldeões).
 */
export const POSICOES_OCIOSOS = [
  { x: 143, y: 266 },
  { x: 113, y: 252 },
  { x: 120, y: 280 },
] as const satisfies readonly { x: number; y: number }[];

/**
 * Lado da arte dos aldeões (quadros.json: 32). As posições (POSICOES_ALDEOES,
 * POSICOES_OCIOSOS) são o canto do sprite de 32; o pé sai daqui, então os
 * aldeões ficam no mesmo lugar qualquer que seja ESCALA.aldeao.
 *
 * Aldeões aparecem em qualquer zoom e largura, sempre na escala de mundo
 * (ESCALA.aldeao × zoom), proporcionais às construções em todos os zooms (A6).
 */
export const LADO_SPRITE_ALDEAO = 32;

/**
 * Névoa (L6, Portão 9): só na Cripta, enquanto ela estiver bloqueada (Estradas
 * Reais, A3). Mina e Pântano bloqueados só têm o cadeado no pin (A4). Círculo
 * de raio único em volta do centro dado, em mundo (decisão do dono; o centro
 * não é o pin, para cobrir o cemitério da imagem).
 */
export const NEVOA_DESTINOS = {
  cripta: { x: 2496, y: 1651 },
} as const satisfies Partial<Record<DestinoId, { x: number; y: number }>>;
export const RAIO_NEVOA = 232;
/**
 * Borda da névoa: nos últimos `faixa` px de mundo do raio, só metade dos
 * pixels (xadrez de `passo` x `passo` px de mundo), para a borda ficar em
 * pixel art. A textura é o tile `Nevoa Cheia` do Figma (5 variantes de 32).
 */
export const BORDA_NEVOA = { faixa: 16, passo: 2 } as const;
export const VARIANTES_NEVOA = 5;

/**
 * Recurso de cada clicável da imagem (seção 5b). `pedra_minerio` é uma
 * variante de pedra e rende pedra na v0.
 */
export const RECURSO_DO_CLICAVEL = {
  arvore: 'madeira',
  pedra: 'pedra',
} as const satisfies Record<string, Recurso>;
export type TipoClicavel = keyof typeof RECURSO_DO_CLICAVEL;

/** Retângulo no espaço do sprite (0 a lado), em px de sprite. */
export interface HitboxSprite {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Pegada de cada construção do nível 1 (pixels com alfa 255, dois quadros).
 * Serve de hitbox para as produtoras construídas (handoff: só elas são
 * clicáveis) e para o slot vazio do mesmo tipo.
 */
export const HITBOX_CONSTRUCAO = {
  armazem: { x: 1, y: 4, largura: 47, altura: 40 },
  casa: { x: 4, y: 1, largura: 41, altura: 44 },
  celeiro: { x: 3, y: 0, largura: 43, altura: 44 },
  forja: { x: 3, y: 2, largura: 44, altura: 43 },
  mercado: { x: 2, y: 8, largura: 45, altura: 37 },
  muralha: { x: 1, y: 0, largura: 47, altura: 44 },
  pedreira: { x: 2, y: 9, largura: 45, altura: 34 },
  scriptorium: { x: 3, y: 5, largura: 43, altura: 40 },
  serraria: { x: 1, y: 7, largura: 47, altura: 38 },
  taverna: { x: 2, y: 2, largura: 45, altura: 43 },
} as const satisfies Record<string, HitboxSprite>;

/**
 * Hitbox das Ruínas do Quartel General e do QG reerguido (Portão 21): só pela caixa, sem máscara de pixel, como as
 * árvores e pedras da imagem. Canto e tamanho dentro do sprite de 48.
 */
export const HITBOX_QG = { x: 2, y: 4, largura: 44, altura: 42 } as const satisfies HitboxSprite;

/** Lado mínimo da hitbox na tela, em px: só para toque e caneta. */
export const HITBOX_MINIMA_TELA = 44;
/** Mouse: a hitbox real cresce só isto, em px de tela, de cada lado (clicáveis e produtoras; slot vazio não). */
export const TOLERANCIA_MOUSE_PX = 4;
/**
 * Acerto em duas etapas (mouse, só construções): a caixa descarta quem está
 * longe; o acerto exige pixel opaco do quadro atual a no máximo este raio, em
 * px de tela. Árvores e pedras da imagem não têm alfa: acertam pela caixa do meta.
 */
export const RAIO_ACERTO_PIXEL_TELA = 3;
/** Movimento do ponteiro (px de tela) acima do qual é arrasto, não clique. */
export const LIMITE_ARRASTO_PX = 6;

/**
 * Sombras (Portão 9c, camada L3b), geradas da silhueta de cada sprite (um
 * por quadro, em cache, no espaço 1x do sprite). Para cada pixel com alfa
 * 255 em (x, y), com d = pe - y >= 0: destino (x + floor(d * S), pe +
 * floor(d * K)), cor SOMBRA_COR com alfa A constante; depois fecha buracos
 * de 1 px na vertical. S e K em milésimos; A de 0 a 255. As árvores e
 * pedras da imagem já vêm com a sombra desenhada.
 */
export interface SombraSilhueta {
  sMil: number;
  kMil: number;
  alfa: number;
}

export const SOMBRA_COR = { r: 0x1c, g: 0x3a, b: 0x24 } as const;

const BAIXO: SombraSilhueta = { sMil: 400, kMil: 300, alfa: 90 };

/** null = sem sombra (plantas rasteiras e cerca). */
export const SOMBRA_OBJETO: Record<TipoObjeto, SombraSilhueta | null> = {
  poco: BAIXO,
  fogueira: BAIXO,
  flores: null,
  cerca: null,
};
/**
 * Pé da sombra: calculado do desenho de cada quadro (última linha com alfa
 * 255, menos 1 px). Ajuste manual por tipo, em px de mundo (padrão 0).
 */
export const AJUSTE_PE_SOMBRA: Partial<Record<TipoObjeto | 'construcao' | 'aldeao', number>> = {};

export const SOMBRA_CONSTRUCAO: SombraSilhueta = { sMil: 400, kMil: 250, alfa: 100 };
/** Aldeão parado na Vila (Portão 8): sombra pela silhueta, como as construções. */
export const SOMBRA_ALDEAO: SombraSilhueta = { sMil: 400, kMil: 250, alfa: 100 };

/**
 * Aventureiro do grupo em marcha: fixo na tela (32 px), com a elipse `sombra-16`
 * (miolo de 16, PNG de 20 x 10) em 1x; dx e dy em px de tela, até o centro do miolo.
 */
export const SOMBRA_ELIPSE_16 = { sprite: 'sombra-16', largura: 20, altura: 10 } as const;
export const SOMBRA_AVENTUREIRO = { dx: 2, dy: 1 } as const;

/** O pé fica no centro horizontal, a 90% da altura (spec do mapa, seção 3). */
export const PE_ALTURA_PERMIL = 900;
