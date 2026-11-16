// Portão 20b: simulador de batalha, Poder de combate e Eco mínimo.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Classe } from '../data/aventureiros.ts';
import type { Linha, Tatica } from '../data/combate.ts';
import {
  classesDaComposicao, gerarEco, MARCA, poderCombate, poderDoEco, poderEsperado, poderMinimo, poderRecomendado, poderTropa, poderUnidade, simularBatalha,
  tropaComPoder, unidadeComPoder, unidadeDoGuerreiro, type ResultadoBatalha, type UnidadeCombate,
} from '../src/combate/index.ts';

const U = (classe: Classe, poder: number, linha?: Linha) => unidadeComPoder(classe, poder, linha);
const tres = (classe: Classe) => [U(classe, 34), U(classe, 33), U(classe, 33)];
const misto = () => [U('lanceiro', 34), U('cavaleiro', 33), U('arqueiro', 33)];

function lote(a: () => UnidadeCombate[], b: () => UnidadeCombate[], n = 60, ta: Tatica = 'equilibrada', tb: Tatica = 'equilibrada') {
  const r: ResultadoBatalha[] = [];
  for (let s = 1; s <= n; s++) r.push(simularBatalha({ semente: s, ladoA: a(), ladoB: b(), taticaA: ta, taticaB: tb }));
  return { taxaA: r.filter((x) => x.vencedor === 'A').length / n, resultados: r };
}

/** Eventos do log (5 inteiros cada), depois do cabeçalho. */
function eventos(r: ResultadoBatalha) {
  const nA = r.log[1]!;
  const nB = r.log[2]!;
  const out: { tick: number; autor: number; alvo: number; dano: number; marcas: number }[] = [];
  for (let k = 3 + 3 * (nA + nB); k < r.log.length; k += 5) out.push({ tick: r.log[k]!, autor: r.log[k + 1]!, alvo: r.log[k + 2]!, dano: r.log[k + 3]!, marcas: r.log[k + 4]! });
  return out;
}

describe('determinismo e inteiros', () => {
  it('mesma semente e entrada dão o mesmo log; outra semente, outro log', () => {
    const e = { semente: 77, ladoA: misto(), ladoB: tropaComPoder(110, classesDaComposicao(4)), taticaA: 'agressiva', taticaB: 'defensiva' } as const;
    expect(simularBatalha(e)).toEqual(simularBatalha(e));
    expect(simularBatalha({ ...e, semente: 78 }).log).not.toEqual(simularBatalha(e).log);
  });

  it('log e resultado só com inteiros; o cabeçalho descreve as unidades', () => {
    for (const { resultados } of [lote(misto, () => tropaComPoder(120, classesDaComposicao(5)), 20)]) {
      for (const r of resultados) {
        for (const v of [r.vidaRestanteA, r.vidaRestanteB, r.ticks, ...r.log]) expect(Number.isInteger(v)).toBe(true);
        expect(r.log.slice(0, 3)).toEqual([1, 3, 5]);
        expect((r.log.length - 3 - 3 * 8) % 5).toBe(0);
      }
    }
  });

  it('nada de Date.now, Math.random nem número com vírgula decimal no código do combate', () => {
    const pasta = join(__dirname, '..', 'src', 'combate');
    const arquivos = [...readdirSync(pasta).map((f) => join(pasta, f)), join(__dirname, '..', 'data', 'combate.ts')];
    for (const f of arquivos) {
      const codigo = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(codigo, f).not.toMatch(/Date\.now|Math\.random|performance\.now/);
      expect(codigo, f).not.toMatch(/(?<![\w.])\d+\.\d+/);
    }
  });
});

describe('regras', () => {
  it('triângulo de classes com grupos de poder igual: Lanceiro > Cavaleiro > Arqueiro > Lanceiro', () => {
    for (const [forte, fraco] of [['lanceiro', 'cavaleiro'], ['cavaleiro', 'arqueiro'], ['arqueiro', 'lanceiro']] as const) {
      const pf = tres(forte).reduce((s, u) => s + poderUnidade(u), 0);
      const pr = tres(fraco).reduce((s, u) => s + poderUnidade(u), 0);
      expect(Math.abs(pf - pr) / pr).toBeLessThan(0.05); // poder igual (arredondamento dos atributos)
      expect(lote(() => tres(forte), () => tres(fraco)).taxaA, `${forte} x ${fraco}`).toBeGreaterThan(0.9);
    }
  });

  it('vantagem de x1,5 e desvantagem de x0,75 aparecem no dano (marcas no log)', () => {
    // Mesma defesa e mesmo ataque dos dois lados: só a classe muda o dano.
    const igual = (classe: Classe): UnidadeCombate => ({ ...unidadeDoGuerreiro({ classe: 'lanceiro', nivel: 5, arma: 0, armadura: 0 }), classe });
    const media = (r: ResultadoBatalha[], marca: number) => {
      const d = r.flatMap((x) => eventos(x)).filter((ev) => ev.marcas & marca && ev.dano > 0).map((ev) => ev.dano);
      return d.reduce((s, v) => s + v, 0) / d.length;
    };
    const { resultados } = lote(() => [igual('lanceiro')], () => [igual('cavaleiro')], 40);
    const neutro = lote(() => [igual('lanceiro')], () => [igual('lanceiro')], 40).resultados.flatMap((x) => eventos(x)).map((ev) => ev.dano);
    const base = neutro.reduce((s, v) => s + v, 0) / neutro.length;
    expect(media(resultados, MARCA.vantagem) / base).toBeCloseTo(1.5, 1);
    expect(media(resultados, MARCA.desvantagem) / base).toBeCloseTo(0.75, 1);
  });

  it('a formação muda o resultado: Arqueiros na frente e Lanceiro atrás perdem para a formação padrão', () => {
    const padrao = () => [U('lanceiro', 40), U('arqueiro', 30), U('arqueiro', 30)];
    const invertida = () => [U('lanceiro', 40, 2), U('arqueiro', 30, 0), U('arqueiro', 30, 0)];
    const rival = () => [U('cavaleiro', 50), U('lanceiro', 50)];
    expect(lote(padrao, rival).taxaA).toBeGreaterThan(lote(invertida, rival).taxaA + 0.2);
  });

  it('cada tática faz o que diz: agressiva causa e recebe 20% a mais; defensiva, 20% a menos e a batalha dura mais', () => {
    const danoDe = (ta: Tatica, deA: boolean) => {
      const d = lote(misto, misto, 40, ta, 'equilibrada').resultados.flatMap((r) => eventos(r)).filter((ev) => (ev.autor < 100) === deA && ev.dano > 0).map((ev) => ev.dano);
      return d.reduce((s, v) => s + v, 0) / d.length;
    };
    const base = danoDe('equilibrada', true);
    expect(danoDe('agressiva', true) / base).toBeCloseTo(1.2, 1);
    expect(danoDe('defensiva', true) / base).toBeCloseTo(0.8, 1);
    expect(danoDe('agressiva', false) / danoDe('equilibrada', false)).toBeCloseTo(1.2, 1);
    const ticks = (ta: Tatica) => lote(misto, misto, 40, ta, ta).resultados.reduce((s, r) => s + r.ticks, 0);
    expect(ticks('defensiva')).toBeGreaterThan(ticks('equilibrada'));
    expect(ticks('agressiva')).toBeLessThan(ticks('equilibrada'));
  });

  it('no limite de tempo vence quem tem mais vida total; vida igual, o lado B', () => {
    const r = simularBatalha({ semente: 3, ladoA: [U('lanceiro', 200)], ladoB: [U('lanceiro', 100)], taticaA: 'equilibrada', taticaB: 'equilibrada', limiteTicks: 40 });
    expect(r.vidaRestanteA).toBeGreaterThan(0);
    expect(r.vidaRestanteB).toBeGreaterThan(0);
    expect(r.ticks).toBe(40);
    expect(r.vencedor).toBe(r.vidaRestanteA > r.vidaRestanteB ? 'A' : 'B');
    expect(r.vencedor).toBe('A');
    // Ninguém chega a atacar (aproximação além do limite): vida igual, vence o Eco (lado B).
    const parado = simularBatalha({ semente: 1, ladoA: [U('lanceiro', 50)], ladoB: [U('lanceiro', 50)], taticaA: 'equilibrada', taticaB: 'equilibrada', limiteTicks: 5 });
    expect(parado.vidaRestanteA).toBe(parado.vidaRestanteB);
    expect(parado.vencedor).toBe('B');
  });

  it('Mago do Tempo: atrasa quem atinge e acelera aliados; com poder igual, a tropa com Mago vence mais', () => {
    const comMago = () => [U('lanceiro', 34), U('lanceiro', 33), U('mago_do_tempo', 33)];
    const sem = () => tres('lanceiro');
    const { taxaA, resultados } = lote(comMago, sem);
    expect(taxaA).toBeGreaterThan(0.5);
    const evs = resultados.flatMap((r) => eventos(r));
    expect(evs.some((ev) => ev.marcas & MARCA.atraso)).toBe(true);
    expect(evs.some((ev) => ev.marcas & MARCA.pressa && ev.autor < 100)).toBe(true);
    // O Mago atinge até 2 de uma vez.
    expect(evs.filter((ev) => ev.marcas & MARCA.atraso).length).toBeGreaterThan(0);
  });

  it('o Arqueiro mira quem tem menos vida entre as linhas que alcança: Mago exposto perde, a mesma tropa com o Mago protegido ganha', () => {
    // Rival com 3 linhas ocupadas: o Arqueiro dele (linha efetiva 2, alcance 4) chega até a linha 1 da tropa.
    const rival = () => [U('cavaleiro', 34, 0), U('lanceiro', 33, 1), U('arqueiro', 33, 2)];
    const protegido = () => [U('cavaleiro', 42, 0), U('lanceiro', 42, 1), U('mago_do_tempo', 42, 2)];
    const exposto = () => [U('cavaleiro', 42, 0), U('mago_do_tempo', 42, 1), U('lanceiro', 42, 2)];
    expect(lote(protegido, rival).taxaA).toBeGreaterThan(0.8);
    expect(lote(exposto, rival).taxaA).toBeLessThan(0.2);
    // No exposto, o primeiro alvo do Arqueiro rival é o Mago (menos vida entre as linhas alcançáveis).
    const r = simularBatalha({ semente: 1, ladoA: exposto(), ladoB: rival(), taticaA: 'equilibrada', taticaB: 'equilibrada' });
    expect(eventos(r).find((ev) => ev.autor === 102)?.alvo).toBe(1);
  });

  it('espelho equilibrado: tropas iguais vencem por volta de metade das vezes', () => {
    const t = lote(misto, misto, 200).taxaA;
    expect(t).toBeGreaterThan(0.4);
    expect(t).toBeLessThan(0.6);
  });
});

describe('Poder de combate', () => {
  it('cresce com nível, arma e armadura; Lanceiro de nível 1 sem equipamento = 33', () => {
    const g = { classe: 'lanceiro' as const, nivel: 1, arma: 0, armadura: 0 };
    expect(poderCombate(g)).toBe(33);
    for (const c of ['lanceiro', 'cavaleiro', 'arqueiro', 'mago_do_tempo'] as const) {
      const base = poderCombate({ ...g, classe: c });
      expect(poderCombate({ ...g, classe: c, nivel: 2 })).toBeGreaterThan(base);
      expect(poderCombate({ ...g, classe: c, arma: 1 })).toBeGreaterThan(base);
      expect(poderCombate({ ...g, classe: c, armadura: 1 })).toBeGreaterThan(base);
      expect(poderCombate({ classe: c, nivel: 20, arma: 6, armadura: 6 })).toBeGreaterThan(poderCombate({ classe: c, nivel: 19, arma: 6, armadura: 6 }));
    }
    expect(poderTropa([g, g, g])).toBe(99);
  });

  it('unidade com o poder pedido: o poder sai perto do pedido (arredondamento dos atributos)', () => {
    for (const c of ['lanceiro', 'cavaleiro', 'arqueiro', 'mago_do_tempo'] as const) {
      for (const p of [30, 100, 1_000, 10_000]) expect(Math.abs(poderUnidade(U(c, p)) - p) / p, `${c} ${p}`).toBeLessThan(0.05);
    }
  });
});

describe('gerarEco', () => {
  it('E(n) bate com a tabela da seção 1.5; o poder do Eco segue os multiplicadores calibrados no 20c, em inteiros', () => {
    // [fase, nível, E(n) da seção 1.5, poder do Eco calibrado, mínimo (0,88), recomendado (1,02)]
    // (com os multiplicadores do rascunho, o Eco era 75, 105, 88, 139, 176, 264, 700, 324, 625, 788, 1173, 23 169, 9 863)
    const tabela: [number, string, number, number, number, number][] = [
      [1, 'facil', 100, 75, 66, 77], [2, 'media', 105, 100, 88, 102], [3, 'facil', 110, 88, 78, 90], [4, 'dificil', 116, 122, 108, 125],
      [5, 'muito_dificil', 122, 134, 118, 137], [10, 'chefe', 155, 202, 178, 207], [30, 'chefe', 412, 535, 471, 546], [31, 'facil', 432, 324, 286, 331],
      [34, 'dificil', 500, 550, 484, 561], [35, 'muito_dificil', 525, 604, 532, 617], [40, 'chefe', 670, 905, 797, 924],
      [100, 'chefe', 12_524, 18_160, 15_981, 18_524], [101, 'facil', 13_150, 9_863, 8_680, 10_061],
    ];
    for (const [fase, nivel, esperado, poder, minimo, recomendado] of tabela) {
      expect(gerarEco(fase), `fase ${fase}`).toMatchObject({ fase, nivel, esperado, poder });
      expect(poderEsperado(fase)).toBe(esperado);
      expect(poderDoEco(fase)).toBe(poder);
      expect(poderMinimo(fase)).toBe(minimo);
      expect(poderRecomendado(fase)).toBe(recomendado);
    }
  });

  it('determinístico; composição pelo orçamento (3 unidades no começo, até 8), poder da tropa perto do do Eco', () => {
    expect(gerarEco(57)).toEqual(gerarEco(57));
    expect(classesDaComposicao(3)).toEqual(['lanceiro', 'arqueiro', 'cavaleiro']);
    expect(classesDaComposicao(4)).toEqual(['lanceiro', 'arqueiro', 'cavaleiro', 'mago_do_tempo']);
    for (const fase of [1, 21, 41, 61, 81, 101, 200]) {
      const e = gerarEco(fase);
      expect(e.unidades.length).toBe(Math.min(8, 3 + Math.floor((fase - 1) / 20)));
      const soma = e.unidades.reduce((s, u) => s + poderUnidade(u), 0);
      expect(Math.abs(soma - e.poder) / e.poder, `fase ${fase}`).toBeLessThan(0.05);
    }
    expect(() => gerarEco(0)).toThrow();
  });
});
