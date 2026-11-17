// Portão 20a: as classes 5 → 4 (esquema 9), sem perder nada do aventureiro.
import { describe, expect, it } from 'vitest';
import { CLASSE_INICIAL, CLASSES, CLASSES_ANTIGAS, NOMES_CLASSES } from '../data/aventureiros.ts';
import { aplicarAcao } from '../src/acoes.ts';
import { animacao, EQUIVALENCIA_SPRITES } from '../src/animacao.ts';
import { carregarEstado, esquemaEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { liquidar } from '../src/liquidar.ts';
import { preverEstado } from '../src/previsao.ts';
import { comRecursos, fazer, MIN, novo, SEG } from './ajuda.ts';

/** Save do esquema 8 (antes do 20a): mesmo estado, classes antigas. */
const comoV8 = (e: EstadoJogo, classes: string[]) => JSON.parse(JSON.stringify({
  ...e,
  versao: 8,
  aventureiros: e.aventureiros.map((a, i) => ({ ...a, classe: classes[i] ?? a.classe })),
}));

describe('classes do combate', () => {
  it('quatro classes, Lanceiro inicial, nomes em pt-BR, ids sem acento', () => {
    expect(CLASSES).toEqual(['lanceiro', 'arqueiro', 'cavaleiro', 'mago_do_tempo']);
    expect(CLASSE_INICIAL).toBe('lanceiro');
    expect(NOMES_CLASSES).toEqual({ lanceiro: 'Lanceiro', arqueiro: 'Arqueiro', cavaleiro: 'Cavaleiro', mago_do_tempo: 'Mago do Tempo' });
    for (const c of CLASSES) expect(c).toMatch(/^[a-z_]+$/);
    expect(novo().aventureiros[0]!.classe).toBe('lanceiro');
  });

  it('arte própria (Portão 22): toda classe tem o sprite com o próprio nome, sem equivalência com a arte antiga', () => {
    for (const c of CLASSES) {
      const a = animacao('aventureiro', c);
      expect(a.chave).toBe(`aventureiro/${c}`);
      expect(a.quadros).toHaveLength(6);
      expect(a.tamanho).toBe(32);
    }
    expect(EQUIVALENCIA_SPRITES.aventureiro).toBeUndefined();
    // As artes antigas saíram do catálogo.
    for (const velho of ['guerreiro', 'clerigo', 'mago', 'ladino']) expect(() => animacao('aventureiro', velho)).toThrow();
  });

  it('contratar leva a classe ESCOLHIDA (acabou o sorteio), qualquer que seja a semente', () => {
    for (const classe of CLASSES) {
      for (const semente of [1, 2, 3, 4, 5]) {
        const e = comRecursos(novo({ semente }), { ouro: 300, comida: 200 });
        const r = aplicarAcao(e, { tipo: 'contratar', classe }, e.t);
        expect(r.ok).toBe(true);
        expect(r.estado.aventureiros.at(-1)!.classe).toBe(classe);
      }
    }
  });
});

describe('migração 8 → 9', () => {
  it('um aventureiro de cada classe antiga vira a nova; nível, XP, equipamento, estado, nome e id ficam', () => {
    const e = novo();
    const base = e.aventureiros[0]!;
    const antigas = Object.keys(CLASSES_ANTIGAS);
    e.aventureiros = antigas.map((_, i) => ({ ...base, id: `a${i + 10}`, nome: `Nome${i}`, nivel: i + 2, xp: i, arma: i, armadura: 5 - i, estado: i === 4 ? ('ferido' as const) : ('na_vila' as const), feridoAte: i === 4 ? e.t + MIN : null }));
    const c = carregarEstado(comoV8(e, antigas), 8);
    expect(c.versao).toBe(VERSAO_ESQUEMA);
    expect(c.aventureiros.map((a) => a.classe)).toEqual(['lanceiro', 'arqueiro', 'arqueiro', 'cavaleiro', 'mago_do_tempo']);
    // Tudo o mais igual.
    expect(c.aventureiros.map(({ classe: _c, ...resto }) => resto)).toEqual(e.aventureiros.map(({ classe: _c, ...resto }) => resto));
    expect(c).toEqual({ ...e, aventureiros: c.aventureiros });
  });

  it('save com expedição em andamento: migra, a expedição volta com o mesmo resultado secreto', () => {
    let e = comRecursos(novo(), { comida: 200 });
    e = fazer(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [e.aventureiros[0]!.id] });
    const c = carregarEstado(comoV8(e, ['clerigo']), 8);
    expect(c.aventureiros[0]!.classe).toBe('cavaleiro');
    expect(c.expedicoes).toEqual(e.expedicoes);
    expect(c.segredo).toEqual(e.segredo);
    const fim = e.expedicoes[0]!.fim + SEG;
    const depois = liquidar(c, fim);
    const semMigrar = liquidar(e, fim);
    expect(depois.relatorios).toEqual(semMigrar.relatorios);
    expect(depois.recursos).toEqual(semMigrar.recursos);
    expect(() => esquemaEstado.parse(depois)).not.toThrow();
    // Previsão do cliente no estado migrado: mesma parte determinística até antes da volta.
    const { segredo: _s, ...visao } = c;
    expect(preverEstado(visao, e.t + 10 * SEG).estado.recursos).toEqual(liquidar(c, e.t + 10 * SEG).recursos);
  });

  it('esquema 9 recusa classe antiga sem migrar', () => {
    const e = novo();
    expect(() => esquemaEstado.parse({ ...e, aventureiros: [{ ...e.aventureiros[0]!, classe: 'guerreiro' }] })).toThrow();
  });
});
