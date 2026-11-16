// Portão 20d-2: prontidão da tropa e aviso de composição (puros, inteiros).
import { describe, expect, it } from 'vitest';
import type { Classe } from '../data/aventureiros.ts';
import { FASE_MAXIMA } from '../data/combate.ts';
import {
  avisoDeComposicao, faseDesbloqueada, faseValida, gerarEco, poderCombate, poderDoEco, poderMinimo, poderRecomendado, prontidaoDaTropa, type Guerreiro,
} from '../src/combate/index.ts';
import { novo } from './ajuda.ts';

const G = (classe: Classe, nivel = 1, arma = 0, armadura = 0): Guerreiro => ({ classe, nivel, arma, armadura });
/** Tropa de n Lanceiros no nível dado (o poder cresce com o nível). */
const lanceiros = (n: number, nivel: number): Guerreiro[] => Array.from({ length: n }, () => G('lanceiro', nivel, 3, 3));

describe('prontidaoDaTropa', () => {
  it('tropa vazia: poder 0, bloqueada, falta o mínimo inteiro', () => {
    const p = prontidaoDaTropa([], 4);
    expect(p).toEqual({ poder: 0, poderDoEco: poderDoEco(4), minimo: poderMinimo(4), recomendado: poderRecomendado(4), falta: poderMinimo(4), estado: 'bloqueada' });
  });

  it('o poder é a soma do poder de combate de cada guerreiro (a função do simulador)', () => {
    const tropa = [G('lanceiro', 5, 2, 1), G('arqueiro', 3), G('mago_do_tempo', 8, 6, 6)];
    expect(prontidaoDaTropa(tropa, 1).poder).toBe(tropa.reduce((s, g) => s + poderCombate(g), 0));
  });

  it('limites exatos em fases de cada nível: mínimo e recomendado, um abaixo e um acima', () => {
    // Fácil (1), média (2), difícil (4), muito difícil (5), chefe (10) e fases endurecidas (34, 40). Até 8 guerreiros
    // reais somam no máximo ~1 330 de poder (8 × 166), então fases mais altas não têm tropa real que as alcance.
    for (const fase of [1, 2, 4, 5, 10, 34, 40]) {
      const eco = gerarEco(fase);
      expect(eco.fase).toBe(fase);
      const minimo = poderMinimo(fase);
      const recomendado = poderRecomendado(fase);
      // Tropa sintética com o poder exato desejado: guerreiros de poder conhecido somados a um resto.
      const base = prontidaoDaTropa([], fase);
      expect(base.minimo).toBe(minimo);
      expect(base.recomendado).toBe(recomendado);
      // As três faixas, com uma tropa cujo poder é medido (não adivinhado).
      const potencia = (poder: number) => prontidaoDaTropa(tropaComPoderAproximado(poder), fase);
      const abaixo = potencia(minimo - 1);
      expect(abaixo.estado, `fase ${fase}`).toBe('bloqueada');
      expect(abaixo.falta).toBe(minimo - abaixo.poder);
      const meio = potencia(Math.floor((minimo + recomendado) / 2));
      expect(['arriscada', 'bloqueada', 'recomendada']).toContain(meio.estado);
      const acima = potencia(recomendado + 10);
      expect(acima.estado, `fase ${fase}`).toBe('recomendada');
      expect(acima.falta).toBe(0);
    }
  });

  it('fronteiras: poder = mínimo - 1 bloqueia; = mínimo é arriscada; = recomendado - 1 é arriscada; = recomendado é recomendada', () => {
    // Procura, para algumas fases, uma tropa com poder exato em cada fronteira (por busca de nível/equipamento).
    const fronteira = (fase: number, alvo: number) => {
      for (let n = 1; n <= 8; n++) {
        for (let nivel = 1; nivel <= 20; nivel++) {
          for (let arma = 0; arma <= 6; arma++) {
            for (let armadura = 0; armadura <= 6; armadura++) {
              const t = Array.from({ length: n }, () => G('lanceiro', nivel, arma, armadura));
              if (prontidaoDaTropa(t, fase).poder === alvo) return t;
            }
          }
        }
      }
      return null;
    };
    let conferidas = 0;
    for (const fase of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const minimo = poderMinimo(fase);
      const recomendado = poderRecomendado(fase);
      for (const [alvo, estado] of [[minimo - 1, 'bloqueada'], [minimo, 'arriscada'], [recomendado - 1, 'arriscada'], [recomendado, 'recomendada']] as const) {
        const t = fronteira(fase, alvo);
        if (!t) continue; // nem todo valor exato é alcançável com Lanceiros iguais
        expect(prontidaoDaTropa(t, fase).estado, `fase ${fase}, poder ${alvo}`).toBe(estado);
        conferidas++;
      }
    }
    expect(conferidas).toBeGreaterThanOrEqual(8);
  });

  it('determinístico e inteiro; fase inválida lança', () => {
    const t = lanceiros(3, 6);
    expect(prontidaoDaTropa(t, 12)).toEqual(prontidaoDaTropa(t, 12));
    for (const v of Object.values(prontidaoDaTropa(t, 12))) if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true);
    for (const fase of [0, -1, 1.5, FASE_MAXIMA + 1, Number.NaN]) {
      expect(faseValida(fase)).toBe(false);
      expect(() => prontidaoDaTropa(t, fase)).toThrow(RangeError);
    }
    expect(faseValida(1) && faseValida(FASE_MAXIMA)).toBe(true);
  });

  it('na fase máxima as contas continuam exatas (BigInt) e em inteiros seguros', () => {
    const p = prontidaoDaTropa([], FASE_MAXIMA);
    for (const v of [p.poderDoEco, p.minimo, p.recomendado]) expect(Number.isSafeInteger(v)).toBe(true);
    // Exato, sem ponto flutuante: teto de poder do Eco × 8 800 / 10 000 e × 10 200 / 10 000.
    const teto = (bp: bigint) => Number((BigInt(p.poderDoEco) * bp + 9_999n) / 10_000n);
    expect(p.minimo).toBe(teto(8_800n));
    expect(p.recomendado).toBe(teto(10_200n));
    expect(p.recomendado).toBeGreaterThan(p.minimo);
  });
});

/** Uma tropa de Lanceiros iguais cujo poder fica o mais perto possível de `alvo` (sem passar muito). */
function tropaComPoderAproximado(alvo: number): Guerreiro[] {
  let melhor: Guerreiro[] = [];
  let distancia = Number.POSITIVE_INFINITY;
  for (let n = 1; n <= 8; n++) {
    for (let nivel = 1; nivel <= 20; nivel++) {
      for (const eq of [0, 3, 6]) {
        const t = Array.from({ length: n }, () => G('lanceiro', nivel, eq, eq));
        const p = t.reduce((s, g) => s + poderCombate(g), 0);
        const d = Math.abs(p - alvo);
        if (p <= alvo && d < distancia) { distancia = d; melhor = t; }
      }
    }
  }
  return melhor;
}

describe('avisoDeComposicao', () => {
  it('só Lanceiros e Cavaleiros: corpo a corpo; só Arqueiros: so_arqueiros; o resto e a tropa vazia: equilibrada', () => {
    expect(avisoDeComposicao([{ classe: 'lanceiro' }, { classe: 'cavaleiro' }, { classe: 'lanceiro' }])).toBe('corpo_a_corpo');
    expect(avisoDeComposicao([{ classe: 'lanceiro' }])).toBe('corpo_a_corpo');
    expect(avisoDeComposicao([{ classe: 'arqueiro' }, { classe: 'arqueiro' }])).toBe('so_arqueiros');
    expect(avisoDeComposicao([{ classe: 'lanceiro' }, { classe: 'arqueiro' }])).toBe('equilibrada');
    expect(avisoDeComposicao([{ classe: 'lanceiro' }, { classe: 'mago_do_tempo' }])).toBe('equilibrada');
    expect(avisoDeComposicao([{ classe: 'mago_do_tempo' }])).toBe('equilibrada');
    expect(avisoDeComposicao([])).toBe('equilibrada');
  });

  it('só informa: o aviso não muda o poder nem a prontidão', () => {
    const t = [G('lanceiro', 5), G('cavaleiro', 5)];
    const antes = prontidaoDaTropa(t, 4);
    avisoDeComposicao(t);
    expect(prontidaoDaTropa(t, 4)).toEqual(antes);
  });
});

describe('faseDesbloqueada', () => {
  it('sem campanha no estado (opção a, 16/11): toda fase válida está liberada; a regra da campanha entra só aqui', () => {
    const e = novo();
    expect(faseDesbloqueada(e, 1)).toBe(true);
    expect(faseDesbloqueada(e, 57)).toBe(true);
    expect(faseDesbloqueada(e, 0)).toBe(false);
    expect(faseDesbloqueada(e, FASE_MAXIMA + 1)).toBe(false);
  });
  it.todo('fase bloqueada quando a anterior não foi vencida (depende do progresso de campanha, Portão 23 ou 25)');
});
