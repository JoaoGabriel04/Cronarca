import { describe, expect, it } from 'vitest';
import { FATOR_NIVEL_PINCA, iniciarPinca, moverPinca } from '../lib/mapa/pinca';

/** Dois dedos na horizontal, centrados em (200, 300), separados por `d`. */
const dedos = (d: number, cx = 200, cy = 300) => [{ x: cx - d / 2, y: cy }, { x: cx + d / 2, y: cy }] as const;

describe('pinça com dois dedos', () => {
  it('abrir 1,4x sobe um nível; abrir 1,4² sobe dois; o zoom é sempre inteiro', () => {
    let p = iniciarPinca(...dedos(100), 2);
    let r = moverPinca(p, ...dedos(130));
    expect(r.zoom).toBe(2);
    r = moverPinca(r.pinca, ...dedos(100 * FATOR_NIVEL_PINCA + 1));
    expect(r.zoom).toBe(3);
    r = moverPinca(r.pinca, ...dedos(100 * FATOR_NIVEL_PINCA ** 2 + 1));
    expect(r.zoom).toBe(4);
    p = iniciarPinca(...dedos(200), 3);
    expect(moverPinca(p, ...dedos(200 / FATOR_NIVEL_PINCA - 1)).zoom).toBe(2);
  });

  it('folga: depois de subir, só volta quando o gesto daquele nível é desfeito inteiro', () => {
    const p = iniciarPinca(...dedos(100), 2);
    let r = moverPinca(p, ...dedos(145)); // passou de 1,4: zoom 3
    expect(r.zoom).toBe(3);
    r = moverPinca(r.pinca, ...dedos(130)); // recuou um pouco: continua 3
    expect(r.zoom).toBe(3);
    r = moverPinca(r.pinca, ...dedos(101)); // ainda acima do começo: continua 3
    expect(r.zoom).toBe(3);
    r = moverPinca(r.pinca, ...dedos(99)); // voltou ao começo: zoom 2
    expect(r.zoom).toBe(2);
  });

  it('o centro do zoom é o ponto médio entre os dedos, e mover os dois juntos arrasta', () => {
    const p = iniciarPinca(...dedos(100, 200, 300), 2);
    const r = moverPinca(p, ...dedos(100, 230, 280));
    expect(r.centro).toEqual({ x: 230, y: 280 });
    expect(r.pan).toEqual({ x: 30, y: -20 });
    expect(r.zoom).toBe(2);
    // O próximo arrasto conta a partir do último ponto médio.
    expect(moverPinca(r.pinca, ...dedos(100, 240, 280)).pan).toEqual({ x: 10, y: 0 });
  });

  it('dedos no mesmo ponto não quebram a conta', () => {
    const p = iniciarPinca({ x: 10, y: 10 }, { x: 10, y: 10 }, 2);
    expect(Number.isFinite(moverPinca(p, { x: 10, y: 10 }, { x: 12, y: 10 }).zoom)).toBe(true);
  });
});
