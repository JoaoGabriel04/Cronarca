// Rótulo de taxa do clique (recurso por segundo, no máximo o teto), tremida nas árvores e lascas das pedras.
import { FORMULAS, ganhoCliqueMicro } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { desenharObjetos } from '../components/mapa/desenharObjetos';
import { BRILHO_MS, posicoesDasLascas } from '../components/mapa/desenharLascas';
import { JANELA_TAXA_MS, MedidorDeCliques, rotuloDaTaxa } from '../lib/jogo/cliques';

const GANHO = ganhoCliqueMicro(0); // 1 por clique, sem relíquias
const CAP = FORMULAS.clique.porSegundoObjeto;
const TOTAL = FORMULAS.clique.porSegundoUsuario;

/** Cliques espaçados igualmente, `porSegundo` por segundo, por `s` segundos; devolve a taxa do último instante. */
function cliquesA(m: MedidorDeCliques, objeto: string, porSegundo: number, s: number, inicio = 0) {
  let t = inicio;
  const fim = inicio + s * 1000;
  while (t < fim) {
    m.registrar(objeto, t);
    t += 1000 / porSegundo;
  }
  return m.taxa(objeto, fim - 1, GANHO);
}

describe('taxa de coleta: recurso por segundo, nunca acima do teto', () => {
  it('ritmo abaixo do teto: a taxa é o próprio ritmo e não avisa máx.', () => {
    const t = cliquesA(new MedidorDeCliques(), 'a0001', 3, 3);
    expect(t.microPorSegundo / 1e6).toBe(3);
    expect(t.noTeto).toBe(false);
    expect(rotuloDaTaxa(t)).toBe('+3/s');
  });

  it(`10 e 20 cliques por segundo: trava em ${CAP}/s e avisa "máx."`, () => {
    for (const ritmo of [10, 20]) {
      const t = cliquesA(new MedidorDeCliques(), 'a0001', ritmo, 3);
      expect(t.microPorSegundo / 1e6).toBe(CAP);
      expect(t.noTeto).toBe(true);
      expect(rotuloDaTaxa(t)).toBe(`+${CAP}/s máx.`);
    }
  });

  it('o número nunca passa do teto nem sobe junto com o ritmo (o problema do "+N" que somava)', () => {
    const m = new MedidorDeCliques();
    let maior = 0;
    for (let t = 0; t < 10_000; t += 50) {
      m.registrar('a0001', t); // 20 cliques por segundo
      maior = Math.max(maior, m.taxa('a0001', t, GANHO).microPorSegundo / 1e6);
    }
    expect(maior).toBeLessThanOrEqual(CAP);
  });

  it('a taxa cai quando o jogador desacelera e zera depois de 1 s sem clicar', () => {
    const m = new MedidorDeCliques();
    cliquesA(m, 'a0001', 10, 2);
    expect(m.taxa('a0001', 2_000 + JANELA_TAXA_MS + 1, GANHO).microPorSegundo).toBe(0);
    const devagar = cliquesA(m, 'a0001', 2, 3, 10_000);
    expect(devagar.microPorSegundo / 1e6).toBe(2);
  });

  it('as relíquias entram: com mais ganho por clique, o teto em recurso sobe (ex.: Mãos Calejadas)', () => {
    const g = ganhoCliqueMicro(1);
    const m = new MedidorDeCliques();
    cliquesA(m, 'a0001', 10, 3);
    const t = m.taxa('a0001', 2_999, g);
    expect(t.microPorSegundo).toBe(CAP * g);
    expect(rotuloDaTaxa(t)).toBe(`+${(CAP * g / 1e6).toLocaleString('pt-BR')}/s máx.`);
    expect(CAP * g).toBeGreaterThan(CAP * GANHO);
  });

  it(`o teto do jogador (${TOTAL}/s no total) reduz cada objeto proporcionalmente`, () => {
    const m = new MedidorDeCliques();
    for (let t = 0; t < 3_000; t += 100) for (const o of ['a1', 'a2', 'a3']) m.registrar(o, t); // 10/s em cada
    const taxas = ['a1', 'a2', 'a3'].map((o) => m.taxa(o, 2_999, GANHO));
    const soma = taxas.reduce((a, t) => a + t.microPorSegundo / 1e6, 0);
    expect(soma).toBeLessThanOrEqual(TOTAL + 1e-9);
    expect(taxas.every((t) => t.noTeto)).toBe(true);
    expect(taxas[0]!.microPorSegundo / 1e6).toBeLessThan(CAP);
  });

  it('o rótulo tem casas decimais só quando precisa e nenhum emoji', () => {
    expect(rotuloDaTaxa({ microPorSegundo: 6_250_000, noTeto: false })).toBe('+6,25/s');
    expect(rotuloDaTaxa({ microPorSegundo: 1_000_000, noTeto: false })).toBe('+1/s');
    expect(rotuloDaTaxa({ microPorSegundo: 5_000_000, noTeto: true })).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('tremida horizontal nas árvores clicáveis', () => {
  const imagem = {} as CanvasImageSource;
  function desenhar(tremida: { id: string; dx: number } | null, clicavel: string | null) {
    const chamadas: number[][] = [];
    const ctx = { drawImage: (...a: unknown[]) => chamadas.push(a.slice(1) as number[]) } as unknown as CanvasRenderingContext2D;
    const arvore = { id: 'x', variante: 'pinho', quadro: 0 as const, x: 10, y: 10, ox: 0, oy: 0, clicavel };
    const mapa = { largura: 100, altura: 100, arvores: [arvore], balanco: { duracoesMs: [1] } };
    const grade = { colunas: 1, linhas: 1, celulas: [[0]] };
    const sprites = { get: () => imagem } as never;
    desenharObjetos(ctx, [], sprites, { get: () => undefined } as never, { t: 0, animado: false }, { dx: 0, dy: 0, zoom: 1, largura: 100, altura: 100 }, { tremida }, [], { mapa, grade } as never);
    return chamadas;
  }
  it('a árvore clicada desloca dx; a de enfeite e a de outro id não', () => {
    const base = desenhar(null, 'a0001')[0]![0]!;
    expect(desenhar({ id: 'a0001', dx: 2 }, 'a0001')[0]![0]).toBe(base + 2);
    expect(desenhar({ id: 'a0001', dx: -2 }, 'a0001')[0]![0]).toBe(base - 2);
    expect(desenhar({ id: 'a0002', dx: 2 }, 'a0001')[0]![0]).toBe(base);
    expect(desenhar({ id: 'a0001', dx: 2 }, null)[0]![0]).toBe(base);
  });
});

describe('lascas da pedra clicada', () => {
  it('em pixel inteiro, saem do centro, somem no fim e o lado acompanha o zoom', () => {
    for (const zoom of [1, 2, 3, 4]) {
      const ini = posicoesDasLascas(100, 100, 0, zoom);
      const meio = posicoesDasLascas(100, 100, 0.5, zoom);
      const fim = posicoesDasLascas(100, 100, 1, zoom);
      expect(ini).toHaveLength(5);
      for (const l of [...ini, ...meio, ...fim]) {
        expect(Number.isInteger(l.x) && Number.isInteger(l.y) && Number.isInteger(l.lado)).toBe(true);
        expect(l.lado).toBeGreaterThanOrEqual(2);
      }
      expect(ini.every((l) => l.x === 100 && l.y === 100 && l.alfa === 1)).toBe(true);
      expect(fim.every((l) => l.alfa === 0)).toBe(true);
      const dist = (l: { x: number; y: number }) => Math.hypot(l.x - 100, l.y - 100);
      expect(meio.every((l, i) => dist(l) > dist(ini[i]!))).toBe(true);
    }
    expect(BRILHO_MS).toBe(220); // o mesmo tempo da tremida
  });
});
