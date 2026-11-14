// Sombra pela silhueta (Portão 9c, rodada 2): gerada uma vez por sprite e por
// quadro, no espaço 1x do sprite, a partir dos pixels opacos. Função pura
// sobre RGBA; o canvas fora da tela fica em components/mapa/gerarSombras.

import { SOMBRA_COR, type SombraSilhueta } from '@cronarca/game-core';

/**
 * Pé da sombra no espaço do sprite: a última linha com alfa 255 menos 1 px
 * (a sombra entra um pouco por baixo da base), mais o ajuste manual do tipo.
 * Sprite sem pixel opaco: -1 (sem sombra).
 */
export function peDaSombra(sprite: ImagemRgba, ajuste = 0): number {
  for (let y = sprite.altura - 1; y >= 0; y--) {
    for (let x = 0; x < sprite.largura; x++) if (sprite.dados[(y * sprite.largura + x) * 4 + 3] === 255) return y - 1 + ajuste;
  }
  return -1;
}

/** Deslocamento inteiro de quem está d px acima do pé (d >= 0). */
const passo = (d: number, mil: number) => Math.floor((d * mil) / 1000);

/**
 * Tamanho da imagem da sombra, com origem no canto superior esquerdo do
 * sprite: cobre o sprite mais o maior deslocamento para a direita e para baixo.
 */
export function tamanhoDaSombra(lado: number, pe: number, p: SombraSilhueta): { largura: number; altura: number } {
  return { largura: lado + passo(pe, p.sMil), altura: pe + passo(pe, p.kMil) + 1 };
}

export interface ImagemRgba {
  largura: number;
  altura: number;
  /** RGBA, 4 bytes por pixel, linha a linha. */
  dados: Uint8ClampedArray;
}

/**
 * Para cada pixel com alfa 255 em (x, y), com d = pe - y >= 0, pinta
 * (x + floor(d * S), pe + floor(d * K)) com SOMBRA_COR e alfa constante A
 * (sem dither nem gradiente; sobreposição não acumula). Depois fecha os
 * buracos de 1 px na vertical: vazio com vizinho pintado em cima e embaixo.
 */
export function gerarSombra(sprite: ImagemRgba, pe: number, p: SombraSilhueta): ImagemRgba {
  if (pe < 0) return { largura: 0, altura: 0, dados: new Uint8ClampedArray(0) };
  const { largura, altura } = tamanhoDaSombra(sprite.largura, pe, p);
  const pintado = new Uint8Array(largura * altura);
  for (let y = 0; y <= Math.min(pe, sprite.altura - 1); y++) {
    const d = pe - y;
    const dx = passo(d, p.sMil);
    const dy = pe + passo(d, p.kMil);
    for (let x = 0; x < sprite.largura; x++) {
      if (sprite.dados[(y * sprite.largura + x) * 4 + 3] === 255) pintado[dy * largura + x + dx] = 1;
    }
  }
  // Fecha buracos de 1 px na vertical (lendo a máscara antes do fechamento).
  const fechado = pintado.slice();
  for (let y = 1; y < altura - 1; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x;
      if (!pintado[i] && pintado[i - largura] && pintado[i + largura]) fechado[i] = 1;
    }
  }
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < fechado.length; i++) {
    if (!fechado[i]) continue;
    dados[i * 4] = SOMBRA_COR.r;
    dados[i * 4 + 1] = SOMBRA_COR.g;
    dados[i * 4 + 2] = SOMBRA_COR.b;
    dados[i * 4 + 3] = p.alfa;
  }
  return { largura, altura, dados };
}
