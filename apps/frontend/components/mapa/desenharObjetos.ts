// Desenha a L3b (sombras) e a L4 já ordenada. Chamado a cada quadro: só os
// itens dentro da área visível vão para o canvas. O objeto sob o mouse ganha contorno dourado de
// 1 px de tela, e o clicado treme por um instante (Portão 9b).

import type { Sprites } from '../../lib/mapa/sprites';
import { nomeDoSprite, planoL4, type ArvoresNoPlano, type ItemL4, type RelogioAnim } from '../../lib/mapa/objetos';
import type { Sombras } from './gerarSombras';

export interface Destino {
  /** Deslocamento e zoom inteiros: tela = mundo * zoom + deslocamento. */
  dx: number;
  dy: number;
  zoom: number;
  largura: number;
  altura: number;
}

export interface Realce {
  /** Id do item sob o mouse (contorno). */
  destaque?: string | null;
  /** Item tremendo e o deslocamento horizontal atual, em px de tela. */
  tremida?: { id: string; dx: number } | null;
}

const COR_CONTORNO = '#ffd060';
const silhuetas = new WeakMap<HTMLImageElement | HTMLCanvasElement, HTMLCanvasElement>();

/** O sprite (ou o recorte de um clicável da imagem) pintado de uma cor só, para desenhar o contorno por baixo dele. */
function silhueta(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  let c = silhuetas.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
    c.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = COR_CONTORNO;
    ctx.fillRect(0, 0, c.width, c.height);
    silhuetas.set(img, c);
  }
  return c;
}

/**
 * Contorno dourado de 1 px de tela em volta do desenho: a silhueta deslocada
 * nos 4 lados, e o desenho por cima. O mesmo realce das construções, usado
 * nas construções da L4 (árvores e pedras da imagem usam o contorno pronto, na L7).
 */
export function desenharComContorno(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, largura: number, altura: number) {
  const s = silhueta(img);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.drawImage(s, x + ox, y + oy, largura, altura);
  ctx.drawImage(img, x, y, largura, altura);
}

/**
 * L3b + L4 a partir do plano: sombras primeiro, objetos depois. As sombras
 * pela silhueta vêm de `sombras` (geradas no carregamento); a elipse do grupo
 * em marcha vem dos sprites. `pesFixos` são os pés (px de tela) do grupo.
 * As árvores (versão 2) entram na ordem do pé; devolve quantas foram desenhadas.
 */
export function desenharObjetos(
  ctx: CanvasRenderingContext2D, itens: readonly ItemL4[], sprites: Sprites, sombras: Sombras, relogio: RelogioAnim, d: Destino,
  realce: Realce = {}, pesFixos: readonly { x: number; y: number }[] = [], arvores: ArvoresNoPlano | null = null,
): number {
  let nArvores = 0;
  for (const c of planoL4(itens, d, relogio, (chave) => sombras.get(chave) && { largura: sombras.get(chave)!.width, altura: sombras.get(chave)!.height }, pesFixos, arvores)) {
    if (c.tipo === 'arvore') {
      const img = sprites.get(c.sprite);
      if (!img) throw new Error(`sprite não carregado: ${c.sprite}`);
      ctx.drawImage(img, c.ret.x, c.ret.y, c.ret.largura, c.ret.altura);
      nArvores++;
      continue;
    }
    if (c.tipo === 'sombra') {
      const img = sombras.get(c.sprite) ?? sprites.get(c.sprite);
      if (!img) throw new Error(`sprite não carregado: ${c.sprite}`);
      ctx.drawImage(img, c.ret.x, c.ret.y, c.ret.largura, c.ret.altura);
      continue;
    }
    const it = c.item;
    const tremor = realce.tremida?.id === it.id ? realce.tremida.dx : 0;
    const { y, largura: lado } = c.ret;
    const x = c.ret.x + tremor;
    const nome = nomeDoSprite(it, relogio);
    const img = sprites.get(nome);
    if (!img) throw new Error(`sprite não carregado: ${nome}`);
    if (realce.destaque === it.id) desenharComContorno(ctx, img, x, y, lado, lado);
    else ctx.drawImage(img, x, y, lado, lado);
  }
  return nArvores;
}
