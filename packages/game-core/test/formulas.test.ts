import { describe, expect, it } from 'vitest';
import {
  bonusSaqueBp, chanceExitoBp, custoConstrucao, custoContratar, custoEquipamento, custoReliquia,
  duracaoExpedicaoMs, ganhoCliqueMicro, poderAventureiro, reliquiasNaAscensao, tempoObraMs, tetoMicro,
} from '../src/formulas.ts';
import { u } from './ajuda.ts';

describe('fórmulas v0', () => {
  it('custo de construir e melhorar: round(base × 1,55^(n−1))', () => {
    expect(custoConstrucao('casa', 1)).toEqual({ madeira: u(120), pedra: u(60) });
    expect(custoConstrucao('casa', 2)).toEqual({ madeira: u(186), pedra: u(93) });
    expect(custoConstrucao('casa', 10)).toEqual({ madeira: u(6197), pedra: u(3098) });
    // c2: o Mercado nível 1 não pede ouro; o nível 2 segue a fórmula com o custoBase (ouro 40 × 1,55).
    expect(custoConstrucao('mercado', 1)).toEqual({ madeira: u(240) });
    expect(custoConstrucao('mercado', 2)).toEqual({ madeira: u(372), ouro: u(62) });
  });

  it('tempo de obra: 30 s × 1,4^(n−1)', () => {
    expect(tempoObraMs(1, 0)).toBe(30_000);
    expect(tempoObraMs(2, 0)).toBe(42_000);
    expect(tempoObraMs(3, 0)).toBe(58_800);
  });

  it('teto: round(300 × 1,55^(nível−1)), mínimo nível 1', () => {
    expect(tetoMicro(0)).toBe(u(300));
    expect(tetoMicro(1)).toBe(u(300));
    expect(tetoMicro(2)).toBe(u(465));
    expect(tetoMicro(10)).toBe(u(15492));
  });

  it('A2: a Casa nível 10 cabe no teto do Armazém nível 10', () => {
    expect(custoConstrucao('casa', 10).madeira!).toBeLessThanOrEqual(tetoMicro(10));
  });

  it('contratar: 40 × 1,58^(contratações) de ouro e 20 de comida', () => {
    expect(custoContratar(0)).toEqual({ ouro: u(40), comida: u(20) });
    expect(custoContratar(1)).toEqual({ ouro: u(63), comida: u(20) }); // 63,2
    expect(custoContratar(2).ouro).toBe(u(100)); // 99,856
  });

  it('equipamento: round(base × (n + 1))', () => {
    expect(custoEquipamento('arma', 0)).toEqual({ ferro: u(12), ouro: u(15) });
    expect(custoEquipamento('arma', 2)).toEqual({ ferro: u(36), ouro: u(45) });
    expect(custoEquipamento('armadura', 5)).toEqual({ ferro: u(60), ouro: u(72) });
  });

  it('poder e chance de êxito', () => {
    expect(poderAventureiro({ nivel: 1, arma: 0, armadura: 0 })).toBe(9);
    expect(poderAventureiro({ nivel: 4, arma: 3, armadura: 2 })).toBe(34);
    expect(chanceExitoBp(9, 9)).toBe(4100); // 0,5 + 0,02 × (9 − 13,5)
    expect(chanceExitoBp(9, 70)).toBe(500); // mínimo 5%
    expect(chanceExitoBp(500, 9)).toBe(9800); // máximo 98%
    expect(chanceExitoBp(31, 20)).toBe(5200); // 0,5 + 0,02 × 1
  });

  it('expedição: Caminhos Eternos e bônus de grupo', () => {
    expect(duracaoExpedicaoMs('floresta_lobos', 0)).toBe(30_000);
    expect(duracaoExpedicaoMs('floresta_lobos', 5)).toBe(21_000);
    expect(duracaoExpedicaoMs('cripta', 1)).toBe(282_000);
    expect(bonusSaqueBp(1)).toBe(0);
    expect(bonusSaqueBp(3)).toBe(2000);
  });

  it('relíquias e clique', () => {
    expect(reliquiasNaAscensao(1)).toBe(3);
    expect(reliquiasNaAscensao(4)).toBe(9);
    expect(custoReliquia('linhagem_heroica', 0)).toBe(8);
    expect(custoReliquia('maos_calejadas', 2)).toBe(9);
    const e = (maos: number) => ({ era: 1, pesquisas: { concluidas: [], atual: null }, reliquias: { total: 0, gastas: 0, niveis: { maos_calejadas: maos } } });
    expect(ganhoCliqueMicro(e(0), 'madeira')).toBe(u(1));
    expect(ganhoCliqueMicro(e(2), 'madeira')).toBe(u(1.5));
  });
});
