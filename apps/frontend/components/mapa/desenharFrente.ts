// Camada de frente das árvores em ladrilhos (lib/mapa/frente): montados uma vez
// no carregamento, num canvas cada; a cada quadro só os visíveis são desenhados.

import { ladrilhosDaFrente, ladrilhosVisiveis, type LadrilhoFrente } from '../../lib/mapa/frente';

export type LadrilhoPronto = LadrilhoFrente & { img: HTMLCanvasElement };

export function ladrilhosProntos(frente: HTMLImageElement): LadrilhoPronto[] {
  const leitor = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  leitor.canvas.width = frente.naturalWidth;
  leitor.canvas.height = frente.naturalHeight;
  leitor.drawImage(frente, 0, 0);
  const dados = leitor.getImageData(0, 0, frente.naturalWidth, frente.naturalHeight).data;
  return ladrilhosDaFrente({ largura: frente.naturalWidth, altura: frente.naturalHeight, dados }).map((l) => {
    const img = document.createElement('canvas');
    img.width = l.largura;
    img.height = l.altura;
    img.getContext('2d')!.drawImage(frente, l.x, l.y, l.largura, l.altura, 0, 0, l.largura, l.altura);
    return { ...l, img };
  });
}

/** Desenha os ladrilhos visíveis no zoom inteiro (tela = mundo * zoom + deslocamento). */
export function desenharFrente(ctx: CanvasRenderingContext2D, ls: readonly LadrilhoPronto[], t: { dx: number; dy: number; zoom: number }, vp: { largura: number; altura: number }) {
  const area = { x: -t.dx / t.zoom, y: -t.dy / t.zoom, largura: vp.largura / t.zoom, altura: vp.altura / t.zoom };
  for (const l of ladrilhosVisiveis(ls, area)) ctx.drawImage(l.img, l.x * t.zoom + t.dx, l.y * t.zoom + t.dy, l.largura * t.zoom, l.altura * t.zoom);
}
