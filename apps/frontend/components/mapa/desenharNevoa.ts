// Desenha a textura da névoa (tile Nevoa Cheia do Figma) recortada pelo
// círculo, uma vez por névoa ativa, num canvas em 1x do tamanho da caixa. A
// cada quadro o mapa só copia esse canvas no zoom inteiro.

import { caixaDaNevoa, mascaraNevoa, tilesDaNevoa, type NevoaAtiva } from '../../lib/mapa/nevoa';
import type { Sprites } from '../../lib/mapa/sprites';

export function gerarNevoa(n: NevoaAtiva, sprites: Sprites): HTMLCanvasElement {
  const c = caixaDaNevoa(n);
  const tela = document.createElement('canvas');
  tela.width = c.largura;
  tela.height = c.altura;
  const ctx = tela.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  for (const t of tilesDaNevoa(n)) {
    const img = sprites.get(`nevoa-${t.variante}`);
    if (!img) throw new Error(`sprite não carregado: nevoa-${t.variante}`);
    ctx.drawImage(img, t.x - c.x, t.y - c.y);
  }
  const m = mascaraNevoa(n);
  const dados = ctx.getImageData(0, 0, c.largura, c.altura);
  for (let i = 0; i < m.length; i++) if (!m[i]) dados.data[i * 4 + 3] = 0;
  ctx.putImageData(dados, 0, 0);
  return tela;
}
