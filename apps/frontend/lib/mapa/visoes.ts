// Câmeras sobre o mesmo mundo (spec do mapa seção 1; CRONARCA_MAPA_GRANDE.md
// seção 2): Mapa (2x) e Vila (3x) sobre a imagem fixa de 3072 x 2304.

import { HITBOX_CONSTRUCAO, MAPA, ZOOM_MAPA, type MapaJogo, type SlotId } from '@cronarca/game-core';
import type { Area, Camera, Tamanho } from './camera';

/** Área "Cena da Vila" do frame desktop, em px de tela. */
export const VIEWPORT_DESKTOP: Tamanho = { largura: 876, altura: 712 };

export const ZOOM_MIN = ZOOM_MAPA.minimo;
export const ZOOM_MAX = ZOOM_MAPA.maximo;

const O = MAPA.origemNucleo;

/** Centros antigos da spec do mapa somados à origem do núcleo do meta. */
export const VISOES = {
  /** Reino: mostra 438 x 356 de mundo em volta do núcleo. */
  mapa: { x: 219 + O.x, y: 178 + O.y, zoom: 2 },
  /** Vila: mostra 292 x 237 de mundo, o núcleo enquadrado. */
  vila: { x: 206.5 + O.x, y: 236.3 + O.y, zoom: 3 },
} as const satisfies Record<string, Camera>;

export type NomeVisao = keyof typeof VISOES;

/**
 * Celular (spec do mapa 4c; decisão do Portão 14): Vila e Reino em 2x, cada
 * um com a sua câmera (a Vila centrada no núcleo, o Reino onde o desktop o
 * centra). No desktop, Vila em 3x e Reino em 2x.
 */
export const VISOES_CELULAR = {
  mapa: { x: VISOES.mapa.x, y: VISOES.mapa.y, zoom: 2 },
  vila: { x: VISOES.vila.x, y: VISOES.vila.y, zoom: 2 },
} as const satisfies Record<NomeVisao, Camera>;

export const visoesDe = (celular: boolean) => (celular ? VISOES_CELULAR : VISOES);

/**
 * Pan do mapa: a imagem inteira (seção 2). A viewport nunca sai dela; pode
 * mostrar o paredão de montanhas, nunca fora da imagem. Vale para todas as eras.
 */
export function areaDoMapa(m: MapaJogo = MAPA): Area {
  return { x: 0, y: 0, largura: m.largura, altura: m.altura };
}

/** Catálogo: ao construir, a câmera vai até o slot e ele pisca por este tempo, trocando a cada passo. */
export const FOCO_SLOT = { animacaoS: 0.6, piscarMs: 1_200, passoPiscarMs: 200 } as const;

/**
 * Câmera centrada na pegada do slot, no zoom da Vila (zoom inteiro, spec
 * seção 1). Quem usa ainda passa por limitarCamera, como toda câmera.
 */
export function cameraDoSlot(m: MapaJogo, slot: SlotId, celular = false): Camera {
  const s = m.slots.find((x) => x.id === slot);
  if (!s) throw new Error(`slot fora do mapa: ${slot}`);
  const hb = HITBOX_CONSTRUCAO[s.tipo];
  return { x: s.x + hb.x + hb.largura / 2, y: s.y + hb.y + hb.altura / 2, zoom: visoesDe(celular).vila.zoom };
}
