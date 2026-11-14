// Gera, no carregamento dos sprites, a sombra pela silhueta de cada sprite da
// L4 (um por quadro), num canvas fora da tela. Não roda a cada quadro.

import { chaveDaSombra, type SombraAGerar } from '../../lib/mapa/objetos';
import { gerarSombra, peDaSombra } from '../../lib/mapa/sombras';
import type { Sprites } from '../../lib/mapa/sprites';

export type Sombras = ReadonlyMap<string, HTMLCanvasElement>;

export function gerarSombras(sprites: Sprites, aGerar: ReadonlyMap<string, SombraAGerar>): Sombras {
  const out = new Map<string, HTMLCanvasElement>();
  const leitor = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const ler = (nome: string) => {
    const img = sprites.get(nome);
    if (!img) throw new Error(`sprite não carregado: ${nome}`);
    const largura = img.naturalWidth;
    const altura = img.naturalHeight;
    leitor.canvas.width = largura;
    leitor.canvas.height = altura;
    leitor.clearRect(0, 0, largura, altura);
    leitor.drawImage(img, 0, 0);
    // Só o alfa 255 importa: a pré-multiplicação do canvas não muda o alfa.
    return { largura, altura, dados: leitor.getImageData(0, 0, largura, altura).data };
  };
  const pes = new Map<string, number>();
  for (const [nome, { p, ajuste, peDe }] of aGerar) {
    // O pé sai do desenho do quadro 1 (última linha opaca - 1 + ajuste), o mesmo em todos os quadros.
    let pe = pes.get(peDe);
    if (pe === undefined) pes.set(peDe, (pe = peDaSombra(ler(peDe), ajuste)));
    const sombra = gerarSombra(ler(nome), pe, p);
    if (!sombra.largura) continue;
    const c = document.createElement('canvas');
    c.width = sombra.largura;
    c.height = sombra.altura;
    const ctx = c.getContext('2d')!;
    const imagem = ctx.createImageData(sombra.largura, sombra.altura);
    imagem.data.set(sombra.dados);
    ctx.putImageData(imagem, 0, 0);
    out.set(chaveDaSombra(nome), c);
  }
  return out;
}
