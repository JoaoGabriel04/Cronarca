// Portão 7c, teste 4 (CRONARCA_MAPA_GRANDE.md, seção 7): a imagem desenha sem
// deformar. Aqui, a parte pura: o recorte do drawImage é inteiro e cada pixel
// de tela pega exatamente um pixel da imagem (vizinho mais próximo, blocos de
// zoom x zoom). A cor no canvas de verdade é conferida no Chromium por
// `make conferir-mapa` (scripts/conferir-mapa.cjs).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { deslocamento, limitarCamera, type Tamanho } from '../lib/mapa/camera';
import { pixelDaImagem, recorteVisivel, urlMapaBase } from '../lib/mapa/mapaBase';
import { areaDoMapa } from '../lib/mapa/visoes';
import { decodificarPng, PASTA_MAPA } from './png';

const IMAGEM = { largura: MAPA.largura, altura: MAPA.altura };
const AREA = areaDoMapa();
const VIEWPORTS: Tamanho[] = [{ largura: 390, altura: 844 }, { largura: 1440, altura: 900 }, { largura: 876, altura: 712 }];
const ARQUIVO = join(PASTA_MAPA, 'mapa_base.png');

describe('recorte do mapa_base.png', () => {
  it('a URL leva a versão do mapa (cache)', () => {
    expect(urlMapaBase()).toBe('/mapa/mapa_base.png?v=2');
  });

  for (const vp of VIEWPORTS) {
    it(`${vp.largura} x ${vp.altura}: recorte inteiro que cobre a tela toda, em 1x a 4x, nos cantos e no meio`, () => {
      for (let zoom = 1; zoom <= 4; zoom++) {
        for (const alvo of [{ x: 0, y: 0 }, { x: 9999, y: 9999 }, { x: 1536.4, y: 1151.7 }, { x: 0, y: 9999 }]) {
          const cam = limitarCamera({ ...alvo, zoom }, AREA, vp);
          const r = recorteVisivel(cam, vp, IMAGEM)!;
          for (const n of Object.values(r)) expect(Number.isInteger(n)).toBe(true);
          // Escala exata: nenhum pixel esticado nem cortado ao meio.
          expect(r.dw).toBe(r.sw * zoom);
          expect(r.dh).toBe(r.sh * zoom);
          // Cobre a viewport (o pan nunca mostra fora da imagem) e não passa da imagem.
          expect(r.dx).toBeLessThanOrEqual(0);
          expect(r.dy).toBeLessThanOrEqual(0);
          expect(r.dx + r.dw).toBeGreaterThanOrEqual(vp.largura);
          expect(r.dy + r.dh).toBeGreaterThanOrEqual(vp.altura);
          expect(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= IMAGEM.largura && r.sy + r.sh <= IMAGEM.altura).toBe(true);
          // No máximo 1 pixel da imagem de sobra de cada lado.
          expect(r.sw).toBeLessThanOrEqual(Math.ceil(vp.largura / zoom) + 1);
          // O recorte bate com a conversão da câmera.
          const d = deslocamento(cam, vp);
          expect(r.dx).toBe(r.sx * zoom + d.x);
        }
      }
    });
  }

  it('cada pixel de tela pega um pixel da imagem; blocos de zoom x zoom, nos cantos da tela e da imagem', () => {
    const vp = { largura: 876, altura: 712 };
    for (let zoom = 1; zoom <= 4; zoom++) {
      // Canto superior esquerdo da imagem.
      let cam = limitarCamera({ x: 0, y: 0, zoom }, AREA, vp);
      let r = recorteVisivel(cam, vp, IMAGEM)!;
      expect(pixelDaImagem(r, zoom, 0, 0)).toEqual({ x: 0, y: 0 });
      expect(pixelDaImagem(r, zoom, zoom - 1, zoom - 1)).toEqual({ x: 0, y: 0 });
      expect(pixelDaImagem(r, zoom, zoom, 0)).toEqual({ x: 1, y: 0 });
      // Canto inferior direito da imagem.
      cam = limitarCamera({ x: 99_999, y: 99_999, zoom }, AREA, vp);
      r = recorteVisivel(cam, vp, IMAGEM)!;
      expect(pixelDaImagem(r, zoom, vp.largura - 1, vp.altura - 1)).toEqual({ x: IMAGEM.largura - 1, y: IMAGEM.altura - 1 });
      expect(pixelDaImagem(r, zoom, vp.largura - zoom, vp.altura - zoom)).toEqual({ x: IMAGEM.largura - 1, y: IMAGEM.altura - 1 });
      expect(pixelDaImagem(r, zoom, vp.largura - zoom - 1, vp.altura - 1)).toEqual({ x: IMAGEM.largura - 2, y: IMAGEM.altura - 1 });
    }
  });

  it.skipIf(!existsSync(ARQUIVO))('o arquivo tem 3072 x 2304 (o tamanho do meta) e é todo opaco', () => {
    const img = decodificarPng(readFileSync(ARQUIVO), 'mapa_base');
    expect({ largura: img.largura, altura: img.altura }).toEqual(IMAGEM);
    // Toda opaca: pixel semitransparente deixa ver o fundo do canvas e fica mais escuro (achado no Portão 7c).
    let translucidos = 0;
    for (let i = 3; i < img.dados.length; i += 4) if (img.dados[i] !== 255) translucidos++;
    expect(translucidos).toBe(0);
  }, 30_000); // decodifica 3072 x 2304: com a suíte inteira em paralelo passa dos 5 s padrão
});
