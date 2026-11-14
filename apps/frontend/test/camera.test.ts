import { MAPA } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import {
  deslocamento, escalaDoCanvas, limitarCamera, limitarZoom, moverCamera, mundoParaTela, telaParaMundo, zoomMinimoQueCobre, zoomNoPonto,
  type Camera, type Tamanho,
} from '../lib/mapa/camera';
import { areaDoMapa, VIEWPORT_DESKTOP as VP, VISOES } from '../lib/mapa/visoes';

const AREA = areaDoMapa();
/** Viewports da seção 7 do mapa grande (celular e desktop) e a do frame do Figma. */
const VIEWPORTS: Tamanho[] = [{ largura: 390, altura: 844 }, { largura: 1440, altura: 900 }, VP];

describe('área e visões (mapa grande, seção 2)', () => {
  it('o pan anda pela imagem inteira: 3072 x 2304', () => {
    expect(AREA).toEqual({ x: 0, y: 0, largura: 3072, altura: 2304 });
  });

  it('câmeras antigas somadas à origem do núcleo do meta', () => {
    const O = MAPA.origemNucleo;
    expect(VISOES.mapa).toEqual({ x: 219 + O.x, y: 178 + O.y, zoom: 2 });
    expect(VISOES.vila.x).toBeCloseTo(206.5 + O.x, 9);
    expect(VISOES.vila.y).toBeCloseTo(236.3 + O.y, 9);
    // As duas enquadram o núcleo.
    const N = MAPA.nucleo;
    for (const v of [VISOES.mapa, VISOES.vila]) expect(v.x > N.x && v.x < N.x + N.largura && v.y > N.y && v.y < N.y + N.altura).toBe(true);
  });
});

describe('conversão mundo-tela (teste 2)', () => {
  it('segue a spec: tela = (mundo - camera) * zoom + viewport / 2', () => {
    const cam = VISOES.mapa;
    expect(mundoParaTela({ x: cam.x, y: cam.y }, cam, VP)).toEqual({ x: 438, y: 356 });
    expect(mundoParaTela({ x: cam.x + 32, y: cam.y }, cam, VP)).toEqual({ x: 502, y: 356 });
  });

  for (const dpr of [1, 2]) {
    it(`ida e volta dá o mesmo ponto, em zoom 1 a 4, com devicePixelRatio ${dpr}`, () => {
      const escala = escalaDoCanvas(dpr);
      expect(escala).toBe(dpr);
      for (let zoom = 1; zoom <= 4; zoom++) {
        const cam: Camera = { x: 1600.5, y: 1110.3, zoom };
        for (const p of [{ x: 0, y: 0 }, { x: 1523.25, y: 1177.5 }, { x: 3072, y: 2304 }, { x: 224, y: 2080 }]) {
          const t = mundoParaTela(p, cam, VP);
          // Pixel do canvas = px CSS * escala (o contexto desenha com setTransform(escala)).
          const noCanvas = { x: t.x * escala, y: t.y * escala };
          const volta = telaParaMundo({ x: noCanvas.x / escala, y: noCanvas.y / escala }, cam, VP);
          expect(volta.x).toBeCloseTo(p.x, 9);
          expect(volta.y).toBeCloseTo(p.y, 9);
          // Ponto de mundo inteiro cai em pixel inteiro, de tela e de canvas.
          if (Number.isInteger(p.x) && Number.isInteger(p.y)) {
            expect(Number.isInteger(t.x) && Number.isInteger(t.y)).toBe(true);
            expect(Number.isInteger(noCanvas.x) && Number.isInteger(noCanvas.y)).toBe(true);
          }
        }
      }
    });
  }

  it('escala de tela fracionária (125%, 150%) desenha em px CSS', () => {
    expect(escalaDoCanvas(1.25)).toBe(1);
    expect(escalaDoCanvas(1.5)).toBe(1);
  });

  it('centro fracionário (Vila): o deslocamento é pixel de tela inteiro', () => {
    const d = deslocamento(VISOES.vila, VP);
    expect(Number.isInteger(d.x) && Number.isInteger(d.y)).toBe(true);
    const p = mundoParaTela({ x: 1499, y: 1178 }, VISOES.vila, VP);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    const c = mundoParaTela(VISOES.vila, VISOES.vila, VP);
    expect(Math.abs(c.x - VP.largura / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(c.y - VP.altura / 2)).toBeLessThanOrEqual(0.5);
  });
});

describe('limites (teste 3)', () => {
  it('zoom sempre inteiro entre 1 e 4', () => {
    expect(limitarZoom(0)).toBe(1);
    expect(limitarZoom(2.4)).toBe(2);
    expect(limitarZoom(2.6)).toBe(3);
    expect(limitarZoom(9)).toBe(4);
    expect(limitarZoom(1, 2)).toBe(2);
  });

  it('zoom mínimo: o menor inteiro que cobre a viewport', () => {
    for (const vp of VIEWPORTS) expect(zoomMinimoQueCobre(AREA, vp)).toBe(1);
    expect(zoomMinimoQueCobre(AREA, { largura: 3840, altura: 2160 })).toBe(2); // 4K: 1x deixaria borda
    expect(zoomMinimoQueCobre(AREA, { largura: 3072, altura: 2304 })).toBe(1);
    expect(zoomMinimoQueCobre(AREA, { largura: 3073, altura: 100 })).toBe(2);
    expect(zoomMinimoQueCobre(AREA, { largura: 20_000, altura: 100 })).toBe(4); // nem o máximo cobre: fica no máximo
    expect(limitarCamera({ x: 0, y: 0, zoom: 1 }, AREA, { largura: 3840, altura: 2160 }).zoom).toBe(2);
  });

  it('as visões Mapa e Vila cabem na imagem sem ser mexidas', () => {
    expect(limitarCamera(VISOES.mapa, AREA, VP)).toEqual(VISOES.mapa);
    expect(limitarCamera(VISOES.vila, AREA, VP)).toEqual(VISOES.vila);
  });

  it('o pan nunca expõe fora da imagem, em qualquer zoom, em 390 x 844 e 1440 x 900', () => {
    const alvos = [
      { x: -5000, y: -5000 }, { x: 9000, y: 9000 }, { x: -5000, y: 9000 }, { x: 9000, y: -5000 },
      { x: 0, y: 1152 }, { x: 3072, y: 1152 }, { x: 1536, y: 0 }, { x: 1536, y: 2304 }, { x: 1536.7, y: 1151.3 },
    ];
    let casos = 0;
    for (const vp of VIEWPORTS) {
      for (let zoom = 1; zoom <= 4; zoom++) {
        for (const alvo of alvos) {
          const cam = limitarCamera({ ...alvo, zoom }, AREA, vp);
          // Mesma conta do desenho: o canto da tela em mundo, com o deslocamento inteiro.
          const d = deslocamento(cam, vp);
          expect(d.x, `${vp.largura}x${vp.altura} ${zoom}x`).toBeLessThanOrEqual(0);
          expect(d.y).toBeLessThanOrEqual(0);
          expect(d.x + AREA.largura * zoom).toBeGreaterThanOrEqual(vp.largura);
          expect(d.y + AREA.altura * zoom).toBeGreaterThanOrEqual(vp.altura);
          casos++;
        }
      }
    }
    expect(casos).toBe(VIEWPORTS.length * 4 * alvos.length);
  });

  it('arrastar e dar zoom também nunca expõem fora da imagem', () => {
    for (const vp of VIEWPORTS) {
      let cam = limitarCamera({ x: 1536, y: 1152, zoom: 2 }, AREA, vp);
      for (let k = 0; k < 200; k++) {
        cam = k % 7 === 0 ? zoomNoPonto(cam, ((k / 7) % 4) + 1, { x: (k * 37) % vp.largura, y: (k * 53) % vp.altura }, AREA, vp) : moverCamera(cam, ((k * 97) % 900) - 450, ((k * 61) % 700) - 350, AREA, vp);
        const d = deslocamento(cam, vp);
        expect(d.x <= 0 && d.y <= 0 && d.x + AREA.largura * cam.zoom >= vp.largura && d.y + AREA.altura * cam.zoom >= vp.altura).toBe(true);
      }
    }
  });

  it('em 1x o mapa não cabe na tela: o jogador arrasta', () => {
    const cam = limitarCamera({ x: 0, y: 0, zoom: 1 }, AREA, VP);
    expect(cam).toEqual({ x: VP.largura / 2, y: VP.altura / 2, zoom: 1 });
    expect(moverCamera(cam, -300, 0, AREA, VP).x).toBe(cam.x + 300);
  });
});

describe('movimento', () => {
  it('arrastar move a câmera pelo contrário do ponteiro, em unidades de mundo', () => {
    const cam = moverCamera(VISOES.vila, 30, -15, AREA, VP);
    expect(cam.x).toBeCloseTo(VISOES.vila.x - 10, 9);
    expect(cam.y).toBeCloseTo(VISOES.vila.y + 5, 9);
  });

  it('o zoom mantém o ponto sob o cursor no lugar', () => {
    const cursor = { x: 500, y: 400 };
    const antes = telaParaMundo(cursor, VISOES.mapa, VP);
    const cam = zoomNoPonto(VISOES.mapa, 3, cursor, AREA, VP);
    expect(cam.zoom).toBe(3);
    const depois = telaParaMundo(cursor, cam, VP);
    expect(Math.abs(depois.x - antes.x)).toBeLessThanOrEqual(0.5 / 3);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(0.5 / 3);
  });

  it('zoom além dos limites não muda nada', () => {
    const max = { ...VISOES.vila, zoom: 4 };
    expect(zoomNoPonto(max, 5, { x: 10, y: 10 }, AREA, VP)).toEqual(max);
  });
});

describe('escala do canvas', () => {
  it('usa a escala da tela quando é inteira; senão desenha em px CSS', () => {
    expect(escalaDoCanvas(1)).toBe(1);
    expect(escalaDoCanvas(2)).toBe(2);
    expect(escalaDoCanvas(1.25)).toBe(1);
    expect(escalaDoCanvas(0)).toBe(1);
  });
});
