// Camada de frente das árvores (scripts/gerar-frente.cjs): pedras, arbustos e
// flores que na arte ficavam na frente de uma árvore. A imagem tem o tamanho
// do mapa, mas é quase toda transparente: desenhá-la inteira a cada quadro
// dobraria a pintura da tela (no celular, em DPR 3, o fps cai de 32 para 21 com
// a CPU lenta). Por isso ela vira ladrilhos, só os que têm algum pixel, e o
// mapa desenha só os ladrilhos visíveis. Funções puras sobre RGBA.

import type { ImagemRgba } from './sombras';
import type { RetMundo } from './arvores';

/** Lado do ladrilho, em mundo. */
export const LADO_LADRILHO_FRENTE = 64;

export interface LadrilhoFrente {
  /** Canto do ladrilho recortado (justo nos pixels visíveis), em mundo. */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Os ladrilhos com algum pixel visível, cada um recortado justo no que tem. */
export function ladrilhosDaFrente(img: ImagemRgba, lado = LADO_LADRILHO_FRENTE): LadrilhoFrente[] {
  const out: LadrilhoFrente[] = [];
  for (let ty = 0; ty < img.altura; ty += lado) {
    for (let tx = 0; tx < img.largura; tx += lado) {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      const yf = Math.min(img.altura, ty + lado);
      const xf = Math.min(img.largura, tx + lado);
      for (let y = ty; y < yf; y++) {
        for (let x = tx; x < xf; x++) {
          if (!img.dados[(y * img.largura + x) * 4 + 3]) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 >= 0) out.push({ x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 });
    }
  }
  return out;
}

/** Ladrilhos que cruzam a área (em mundo). */
export const ladrilhosVisiveis = <T extends LadrilhoFrente>(ls: readonly T[], area: RetMundo): T[] =>
  ls.filter((l) => l.x < area.x + area.largura && l.x + l.largura > area.x && l.y < area.y + area.altura && l.y + l.altura > area.y);
