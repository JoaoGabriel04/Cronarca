// L6, névoa (Portão 9): quais destinos estão sob névoa no estado atual e a
// forma dela (círculo de raio único com borda em xadrez). Funções puras; o
// desenho (textura do tile Nevoa Cheia) fica em components/mapa/desenharNevoa.

import {
  BORDA_NEVOA, destinoAberto, NEVOA_DESTINOS, RAIO_NEVOA, VARIANTES_NEVOA, TILE,
  type DestinoId, type EstadoJogo,
} from '@cronarca/game-core';
import type { Ret } from './layoutMarcadores';

export interface NevoaAtiva {
  destino: DestinoId;
  /** Centro e raio, em mundo. */
  x: number;
  y: number;
  raio: number;
}

/** Névoas do estado: as dos destinos com névoa que ainda estão bloqueados (só a Cripta, até Estradas Reais). */
export function nevoasAtivas(e: Pick<EstadoJogo, 'pesquisas' | 'qg' | 'expedicoes'>): NevoaAtiva[] {
  return (Object.entries(NEVOA_DESTINOS) as [DestinoId, { x: number; y: number }][])
    .filter(([id]) => !destinoAberto(e, id))
    .map(([destino, c]) => ({ destino, x: c.x, y: c.y, raio: RAIO_NEVOA }));
}

/** Quadrado que envolve o círculo, em mundo (onde a textura é desenhada). */
export function caixaDaNevoa(n: NevoaAtiva): Ret {
  return { x: n.x - n.raio, y: n.y - n.raio, largura: 2 * n.raio, altura: 2 * n.raio };
}

/** Quadrado inscrito no círculo, em mundo: o aviso da névoa fica dentro dele. */
export function caixaDoAviso(n: NevoaAtiva): Ret {
  const lado = Math.floor(n.raio * Math.SQRT2);
  return { x: n.x - Math.floor(lado / 2), y: n.y - Math.floor(lado / 2), largura: lado, altura: lado };
}

/**
 * Máscara da névoa, 1 por pixel de mundo da caixa: dentro do círculo, 1; na
 * faixa da borda, xadrez de `passo` px alinhado à grade do mundo (não muda com
 * a posição da câmera); fora, 0.
 */
export function mascaraNevoa(n: NevoaAtiva, borda: { faixa: number; passo: number } = BORDA_NEVOA): Uint8Array {
  const c = caixaDaNevoa(n);
  const m = new Uint8Array(c.largura * c.altura);
  for (let j = 0; j < c.altura; j++) {
    for (let i = 0; i < c.largura; i++) {
      const d = Math.hypot(i + 0.5 - n.raio, j + 0.5 - n.raio);
      if (d >= n.raio) continue;
      if (d < n.raio - borda.faixa) {
        m[j * c.largura + i] = 1;
        continue;
      }
      const gx = Math.floor((c.x + i) / borda.passo);
      const gy = Math.floor((c.y + j) / borda.passo);
      if ((gx + gy) % 2 === 0) m[j * c.largura + i] = 1;
    }
  }
  return m;
}

/** Variante do tile de névoa na coluna e linha da grade do mundo (determinística, 1 a 5). */
export function varianteNevoa(coluna: number, linha: number): number {
  return 1 + ((((coluna * 7 + linha * 13 + 3) % VARIANTES_NEVOA) + VARIANTES_NEVOA) % VARIANTES_NEVOA);
}

/** Tiles de névoa que cobrem a caixa (alinhados à grade de 32 do mundo), com a variante. */
export function tilesDaNevoa(n: NevoaAtiva): { x: number; y: number; variante: number }[] {
  const c = caixaDaNevoa(n);
  const out: { x: number; y: number; variante: number }[] = [];
  for (let l = Math.floor(c.y / TILE); l * TILE < c.y + c.altura; l++) {
    for (let k = Math.floor(c.x / TILE); k * TILE < c.x + c.largura; k++) out.push({ x: k * TILE, y: l * TILE, variante: varianteNevoa(k, l) });
  }
  return out;
}

/** Sprites de névoa (nevoa-1 a nevoa-5). */
export const SPRITES_NEVOA = Array.from({ length: VARIANTES_NEVOA }, (_, i) => `nevoa-${i + 1}`);
