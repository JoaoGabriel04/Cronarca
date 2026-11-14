import { describe, expect, it } from 'vitest';
import { aplicarBonus, arredondar, divTeto, micro, mili, potencia, racional } from '../src/inteiros.ts';
import { criarSorteador } from '../src/rng.ts';

describe('aritmética exata', () => {
  it('converte decimais dos dados em frações exatas', () => {
    expect(racional(1.55)).toEqual({ n: 155n, d: 100n });
    expect(racional(0.4)).toEqual({ n: 4n, d: 10n });
    expect(racional(30)).toEqual({ n: 30n, d: 1n });
    expect(() => racional(1e-7)).toThrow(/decimal/);
  });

  it('arredonda o meio para cima', () => {
    expect(arredondar(5n, 2n)).toBe(3);
    expect(arredondar(3n, 2n)).toBe(2);
    expect(arredondar(7n, 3n)).toBe(2);
    expect(arredondar(-5n, 2n)).toBe(-2);
    expect(arredondar(-7n, 2n)).toBe(-3);
  });

  it('potência sem ponto flutuante: 1,55^9 exato', () => {
    const p = potencia(racional(1.55), 9);
    expect(Number(p.n) / Number(p.d)).toBeCloseTo(51.639887032560546875, 12);
    expect(arredondar(120n * p.n, p.d)).toBe(6197);
  });

  it('escalas', () => {
    expect(micro(0.4)).toBe(400_000);
    expect(mili(0.35)).toBe(350);
    expect(aplicarBonus(1000, 500)).toBe(1050);
    expect(aplicarBonus(333, 500)).toBe(350); // 349,65 -> 350
    expect(divTeto(10, 3)).toBe(4);
    expect(divTeto(9, 3)).toBe(3);
  });
});

describe('sorteador', () => {
  it('é determinístico pela semente', () => {
    const a = criarSorteador(123);
    const b = criarSorteador(123);
    const sa = Array.from({ length: 50 }, () => a.inteiro(0, 1000));
    const sb = Array.from({ length: 50 }, () => b.inteiro(0, 1000));
    expect(sa).toEqual(sb);
    expect(a.estado).toBe(b.estado);
  });

  it('continua de onde parou quando recriado a partir do estado salvo', () => {
    const a = criarSorteador(7);
    a.inteiro(0, 10);
    const salvo = a.estado;
    const depois = a.inteiro(0, 1_000_000);
    expect(criarSorteador(salvo).inteiro(0, 1_000_000)).toBe(depois);
  });

  it('respeita os limites e é razoavelmente uniforme', () => {
    const s = criarSorteador(99);
    const contagem = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) {
      const v = s.inteiro(0, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
      contagem[v]! += 1;
    }
    for (const c of contagem) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  }, 30_000); // pesado
});
