// Máscara de acerto por pixel (revisão das hitboxes, Portão 9b): os pixels com
// alfa 255 de cada sprite e quadro. Semitransparentes (fumaça, pó, sombra)
// nunca contam. Funções puras.

import type { ImagemRgba } from './sombras';

export interface Mascara {
  largura: number;
  altura: number;
  /** 1 = pixel com alfa 255, linha a linha. */
  opaco: Uint8Array;
}

export function mascaraDe(img: ImagemRgba): Mascara {
  const opaco = new Uint8Array(img.largura * img.altura);
  for (let i = 0; i < opaco.length; i++) opaco[i] = img.dados[i * 4 + 3] === 255 ? 1 : 0;
  return { largura: img.largura, altura: img.altura, opaco };
}

/**
 * O ponto (em px do sprite, pode ser fracionário) está num pixel opaco ou a
 * no máximo `raioTela` px de tela da borda de um (distância euclidiana na tela).
 */
export function pertoDoOpaco(m: Mascara, xs: number, ys: number, zoom: number, raioTela: number): boolean {
  const r = raioTela / zoom;
  const c0 = Math.max(0, Math.floor(xs - r) - 1);
  const c1 = Math.min(m.largura - 1, Math.floor(xs + r) + 1);
  const l0 = Math.max(0, Math.floor(ys - r) - 1);
  const l1 = Math.min(m.altura - 1, Math.floor(ys + r) + 1);
  const r2 = raioTela * raioTela;
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      if (!m.opaco[l * m.largura + c]) continue;
      // Distância do ponto ao retângulo do pixel, em px de tela.
      const dx = Math.max(c - xs, 0, xs - (c + 1)) * zoom;
      const dy = Math.max(l - ys, 0, ys - (l + 1)) * zoom;
      if (dx * dx + dy * dy <= r2) return true;
    }
  }
  return false;
}

/**
 * Contorno da máscara dilatada no zoom dado, em px de tela relativos ao canto
 * do sprite na tela (tecla J). Inclui a margem do raio em volta do sprite.
 */
export function contornoDilatado(m: Mascara, zoom: number, raioTela: number): { x: number; y: number }[] {
  const margem = Math.ceil(raioTela);
  const largura = m.largura * zoom + 2 * margem;
  const altura = m.altura * zoom + 2 * margem;
  const dentro = new Uint8Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      // Centro do pixel de tela, convertido para px do sprite.
      if (pertoDoOpaco(m, (x - margem + 0.5) / zoom, (y - margem + 0.5) / zoom, zoom, raioTela)) dentro[y * largura + x] = 1;
    }
  }
  const out: { x: number; y: number }[] = [];
  const em = (x: number, y: number) => x >= 0 && y >= 0 && x < largura && y < altura && dentro[y * largura + x] === 1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (em(x, y) && (!em(x - 1, y) || !em(x + 1, y) || !em(x, y - 1) || !em(x, y + 1))) out.push({ x: x - margem, y: y - margem });
    }
  }
  return out;
}
