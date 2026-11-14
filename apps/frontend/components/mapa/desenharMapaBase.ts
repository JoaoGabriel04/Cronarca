// Carrega e desenha a L0 (mapa_base.png). Uma textura de 3072 x 2304; se algum
// aparelho falhar com ela, o plano é dividir em 4 pedaços de 1536 x 1152.

import type { MapaJogo } from '@cronarca/game-core';
import { QUADRO_REPOUSO, spriteDaArvore } from '../../lib/mapa/arvores';
import { recorteVisivel, urlMapaBase, urlMapaFrente } from '../../lib/mapa/mapaBase';
import type { Camera, Tamanho } from '../../lib/mapa/camera';
import { carregarSprites } from '../../lib/mapa/sprites';

export function carregarMapaBase(url: string = urlMapaBase()): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => {
      // decode() deixa a textura pronta antes do primeiro quadro (sem engasgo no arraste).
      img.decode().then(() => resolver(img), () => resolver(img));
    };
    img.onerror = () => rejeitar(new Error(`mapa não encontrado: ${url}`));
    img.src = url;
  });
}

/** Um drawImage do recorte visível, sem suavização. */
export function desenharMapaBase(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cam: Camera, vp: Tamanho) {
  const r = recorteVisivel(cam, vp, { largura: img.naturalWidth, altura: img.naturalHeight });
  if (!r) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
}

/**
 * A arte parada (versão 2): mapa sem árvores + árvores no quadro de repouso,
 * na ordem do pé, + a camada de frente, num canvas do tamanho do mundo. Igual
 * à arte original pixel a pixel. Para o minimapa, que reduz a imagem inteira.
 */
export async function comporArteParada(m: MapaJogo): Promise<HTMLCanvasElement> {
  const [base, frente, sprites] = await Promise.all([
    carregarMapaBase(),
    carregarMapaBase(urlMapaFrente()),
    carregarSprites([...new Set(m.arvores.map((a) => spriteDaArvore(a, QUADRO_REPOUSO)))]),
  ]);
  const c = document.createElement('canvas');
  c.width = m.largura;
  c.height = m.altura;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  for (const a of m.arvores) ctx.drawImage(sprites.get(spriteDaArvore(a, QUADRO_REPOUSO))!, a.ox, a.oy);
  ctx.drawImage(frente, 0, 0);
  return c;
}
