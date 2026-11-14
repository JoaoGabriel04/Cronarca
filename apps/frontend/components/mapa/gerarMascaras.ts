// Máscaras de acerto por pixel, lidas dos sprites no carregamento (canvas
// fora da tela). Uma por sprite e por quadro; não roda a cada quadro.

import { mascaraDe, type Mascara } from '../../lib/mapa/mascaras';
import type { Sprites } from '../../lib/mapa/sprites';

export function gerarMascaras(sprites: Sprites, nomes: Iterable<string>): ReadonlyMap<string, Mascara> {
  const out = new Map<string, Mascara>();
  const leitor = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  for (const nome of nomes) {
    const img = sprites.get(nome);
    if (!img || out.has(nome)) continue;
    leitor.canvas.width = img.naturalWidth;
    leitor.canvas.height = img.naturalHeight;
    leitor.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    leitor.drawImage(img, 0, 0);
    // Só o alfa 255 conta, e a pré-multiplicação do canvas não muda o alfa.
    const dados = leitor.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
    out.set(nome, mascaraDe({ largura: img.naturalWidth, altura: img.naturalHeight, dados }));
  }
  return out;
}
