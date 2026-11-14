// L0 do mapa grande (A13): o mapa_base.png desenhado com um único drawImage
// do recorte visível. Funções puras: o recorte sai em pixels inteiros (da
// imagem e da tela), para o zoom inteiro nunca cortar nem esticar um pixel.

import { VERSAO_MAPA_ATUAL, type VersaoMapa } from '@cronarca/game-core';
import { deslocamento, type Camera, type Tamanho } from './camera';

/** Endereço da imagem (public/mapa). O `v` troca o cache quando o mapa muda de versão. */
export const urlMapaBase = (v: VersaoMapa = VERSAO_MAPA_ATUAL) => `/mapa/mapa_base.png?v=${v}`;
/** Camada de frente das árvores (scripts/gerar-frente.cjs), do mesmo tamanho do mapa. */
export const urlMapaFrente = (v: VersaoMapa = VERSAO_MAPA_ATUAL) => `/mapa/mapa_frente.png?v=${v}`;

/** Recorte da imagem (s*) e onde ele cai na tela (d*), tudo inteiro; null se nada é visível. */
export interface Recorte {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

function eixo(desl: number, zoom: number, visivel: number, tamanho: number) {
  const s0 = Math.max(0, Math.floor(-desl / zoom));
  const s1 = Math.min(tamanho, Math.ceil((visivel - desl) / zoom));
  return { s: s0, n: s1 - s0, d: s0 * zoom + desl };
}

export function recorteVisivel(cam: Camera, vp: Tamanho, imagem: Tamanho): Recorte | null {
  const d = deslocamento(cam, vp);
  const x = eixo(d.x, cam.zoom, vp.largura, imagem.largura);
  const y = eixo(d.y, cam.zoom, vp.altura, imagem.altura);
  if (x.n <= 0 || y.n <= 0) return null;
  return { sx: x.s, sy: y.s, sw: x.n, sh: y.n, dx: x.d, dy: y.d, dw: x.n * cam.zoom, dh: y.n * cam.zoom };
}

/** Pixel da imagem que cai num pixel de tela, com vizinho mais próximo (o que o canvas faz sem suavização). */
export function pixelDaImagem(r: Recorte, zoom: number, xTela: number, yTela: number): { x: number; y: number } | null {
  if (xTela < r.dx || yTela < r.dy || xTela >= r.dx + r.dw || yTela >= r.dy + r.dh) return null;
  return { x: r.sx + Math.floor((xTela - r.dx) / zoom), y: r.sy + Math.floor((yTela - r.dy) / zoom) };
}
