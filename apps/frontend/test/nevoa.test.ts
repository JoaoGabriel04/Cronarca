// Portão 9, L6: névoa só na Cripta, círculo de centro (2496, 1651) e raio 232,
// borda em xadrez, textura do tile Nevoa Cheia.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BORDA_NEVOA, estadoInicial, MAPA, RAIO_NEVOA } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { caixaDaNevoa, caixaDoAviso, mascaraNevoa, nevoasAtivas, SPRITES_NEVOA, tilesDaNevoa, varianteNevoa } from '../lib/mapa/nevoa';
import { PASTA_MAPA } from './png';

const inicio = () => estadoInicial({ semente: 1, agora: 0 });
const com = (...pesquisas: ('cartografia' | 'estradas_reais')[]) => {
  const e = inicio();
  e.pesquisas.concluidas.push(...pesquisas);
  return e;
};

describe('quais destinos têm névoa', () => {
  it('início do ciclo: só a Cripta (Mina e Pântano bloqueados só com cadeado)', () => {
    expect(nevoasAtivas(inicio())).toEqual([{ destino: 'cripta', x: 2496, y: 1651, raio: 232 }]);
  });

  it('Cartografia não mexe na névoa; Estradas Reais tira a da Cripta', () => {
    expect(nevoasAtivas(com('cartografia')).map((n) => n.destino)).toEqual(['cripta']);
    expect(nevoasAtivas(com('estradas_reais'))).toEqual([]);
    expect(nevoasAtivas(com('cartografia', 'estradas_reais'))).toEqual([]);
  });

  it('raio em constante única; a névoa fica dentro da área jogável', () => {
    expect(RAIO_NEVOA).toBe(232);
    const [n] = nevoasAtivas(inicio());
    const c = caixaDaNevoa(n!);
    const J = MAPA.jogavel;
    expect(c).toEqual({ x: 2264, y: 1419, largura: 464, altura: 464 });
    expect(c.x >= J.x && c.y >= J.y && c.x + c.largura <= J.x + J.largura && c.y + c.altura <= J.y + J.altura).toBe(true);
  });
});

describe('forma', () => {
  const [n] = nevoasAtivas(inicio());
  const m = mascaraNevoa(n!);
  const lado = 2 * RAIO_NEVOA;
  const em = (i: number, j: number) => m[j * lado + i] === 1;

  it('dentro do círculo menos a faixa: tudo coberto; fora do círculo: nada', () => {
    for (let j = 0; j < lado; j++) {
      for (let i = 0; i < lado; i++) {
        const d = Math.hypot(i + 0.5 - RAIO_NEVOA, j + 0.5 - RAIO_NEVOA);
        if (d < RAIO_NEVOA - BORDA_NEVOA.faixa) expect(em(i, j)).toBe(true);
        if (d >= RAIO_NEVOA) expect(em(i, j)).toBe(false);
      }
    }
  }, 20_000); // varre o círculo inteiro; com a suíte em paralelo passa de 4 s

  it('borda: xadrez de 2 x 2 px de mundo, alinhado à grade (metade dos pixels da faixa)', () => {
    let faixa = 0;
    let cobertos = 0;
    for (let j = 0; j < lado; j++) {
      for (let i = 0; i < lado; i++) {
        const d = Math.hypot(i + 0.5 - RAIO_NEVOA, j + 0.5 - RAIO_NEVOA);
        if (d < RAIO_NEVOA - BORDA_NEVOA.faixa || d >= RAIO_NEVOA) continue;
        faixa++;
        if (em(i, j)) cobertos++;
        const gx = Math.floor((2264 + i) / 2);
        const gy = Math.floor((1419 + j) / 2);
        expect(em(i, j)).toBe((gx + gy) % 2 === 0);
      }
    }
    expect(cobertos / faixa).toBeGreaterThan(0.45);
    expect(cobertos / faixa).toBeLessThan(0.55);
  });

  it('o aviso fica num quadrado inscrito no círculo (todo dentro da névoa cheia ou da faixa)', () => {
    const a = caixaDoAviso(n!);
    for (const [x, y] of [[a.x, a.y], [a.x + a.largura, a.y], [a.x, a.y + a.altura], [a.x + a.largura, a.y + a.altura]] as const) {
      expect(Math.hypot(x - n!.x, y - n!.y)).toBeLessThanOrEqual(RAIO_NEVOA);
    }
    expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
  });
});

describe('textura', () => {
  it('tiles de 32 alinhados à grade do mundo cobrindo a caixa, variante determinística de 1 a 5', () => {
    const [n] = nevoasAtivas(inicio());
    const c = caixaDaNevoa(n!);
    const t = tilesDaNevoa(n!);
    for (const k of t) {
      expect(k.x % 32 === 0 && k.y % 32 === 0).toBe(true);
      expect(k.variante >= 1 && k.variante <= 5).toBe(true);
      expect(k.variante).toBe(varianteNevoa(k.x / 32, k.y / 32));
    }
    expect(Math.min(...t.map((k) => k.x))).toBeLessThanOrEqual(c.x);
    expect(Math.max(...t.map((k) => k.x + 32))).toBeGreaterThanOrEqual(c.x + c.largura);
    expect(new Set(t.map((k) => k.variante)).size).toBe(5);
  });

  it('os 5 tiles existem em public/mapa, 32 x 32, translúcidos como no Figma', () => {
    for (const nome of SPRITES_NEVOA) {
      const f = join(PASTA_MAPA, `${nome}.png`);
      expect(existsSync(f), nome).toBe(true);
      const b = readFileSync(f);
      expect({ largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) }).toEqual({ largura: 32, altura: 32 });
    }
  });
});
