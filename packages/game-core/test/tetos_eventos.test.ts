// Portão 18a: piso do teto pelo Legado e eventos de ganho que escalam com o teto.
import { describe, expect, it } from 'vitest';
import { NIVEL_MAXIMO_CONSTRUCAO } from '../data/construcoes.ts';
import { ESTADO_INICIAL_CICLO } from '../data/eras.ts';
import { EVENTO_PARAMETROS } from '../data/eventos.ts';
import { FORMULAS } from '../data/formulas.ts';
import { RECURSOS } from '../data/recursos.ts';
import { RELIQUIAS } from '../data/reliquias.ts';
import comEventos from './fixtures/conta_nova_eventos_antes_p18.json' with { type: 'json' };
import { tetoMicro } from '../src/formulas.ts';
import { estadoInicial } from '../src/inicial.ts';
import { ganhoDeEvento, liquidar } from '../src/liquidar.ts';
import { pisoDoTeto, tetos } from '../src/regras.ts';
import { MIN, T0, u } from './ajuda.ts';

const comLegado = (legado: number) =>
  estadoInicial({ semente: 1, agora: T0, reliquias: { total: 100, gastas: 0, niveis: legado ? { legado } : {} } });

describe('Legado e o piso do teto', () => {
  it('cada nível de Legado (0 a 8) começa o ciclo com exatamente o que promete', () => {
    const bonus = FORMULAS.reliquias.legadoPorNivel;
    for (let n = 0; n <= RELIQUIAS.legado.nivelMaximo; n++) {
      const e = comLegado(n);
      const I = ESTADO_INICIAL_CICLO.recursos;
      expect(e.recursos.madeira, `madeira, Legado ${n}`).toBe(u(I.madeira + bonus.madeira * n));
      expect(e.recursos.pedra, `pedra, Legado ${n}`).toBe(u(I.pedra + bonus.pedra * n));
      expect(e.recursos.comida, `comida, Legado ${n}`).toBe(u(I.comida + bonus.comida * n));
      // Nada começa acima do teto.
      const t = tetos(e);
      for (const r of RECURSOS) expect(e.recursos[r]).toBeLessThanOrEqual(t[r]);
    }
  });

  it('sem Legado, o teto é o de sempre (o piso fica abaixo de 300)', () => {
    const e = comLegado(0);
    for (const r of RECURSOS) expect(pisoDoTeto(e)[r]).toBeLessThan(tetoMicro(1));
    expect(tetos(e)).toEqual(Object.fromEntries(RECURSOS.map((r) => [r, tetoMicro(1)])));
  });

  it('Legado 8: madeira 580 e comida 400 no começo; o Armazém 3 (721) passa o piso', () => {
    const e = comLegado(8);
    expect(tetos(e)).toMatchObject({ madeira: u(580), comida: u(400), pedra: u(300), ferro: u(300) });
    e.slots.armazem_1.nivel = 2;
    expect(tetos(e).madeira).toBe(u(580)); // 465 do Armazém 2 ainda abaixo do piso
    e.slots.armazem_1.nivel = 3;
    expect(tetos(e).madeira).toBe(tetoMicro(3));
  });

  it('a produção para no teto efetivo (piso), sem passar dele', () => {
    const e = comLegado(8);
    e.segredo.proximoEventoEm = Number.MAX_SAFE_INTEGER;
    const l = liquidar(e, T0 + 30 * MIN);
    expect(l.recursos.madeira).toBe(u(580));
  });
});

describe('eventos de ganho', () => {
  it('com o teto de 300 vale o fixo; depois, 10% do teto (Cometa 3%)', () => {
    const e = comLegado(0);
    expect(ganhoDeEvento(e, 'madeira', 30, 0.1)).toBe(u(30));
    expect(ganhoDeEvento(e, 'comida', 40, 0.1)).toBe(u(40));
    expect(ganhoDeEvento(e, 'saber', 20, 0.03)).toBe(u(20));
    e.slots.armazem_1.nivel = NIVEL_MAXIMO_CONSTRUCAO;
    e.slots.celeiro_1.nivel = NIVEL_MAXIMO_CONSTRUCAO;
    const P = EVENTO_PARAMETROS;
    expect(ganhoDeEvento(e, 'madeira', P.tempestade.madeira, P.tempestade.fracaoDoTeto)).toBe(u(1549.2));
    expect(ganhoDeEvento(e, 'comida', P.festival_colheita.comida, P.festival_colheita.fracaoDoTeto)).toBe(u(1549.2));
    expect(ganhoDeEvento(e, 'saber', P.cometa.saber, P.cometa.fracaoDoTeto)).toBe(u(464.76));
  });

  it('perdas iguais às de antes (eventos acontecem offline)', () => {
    expect(EVENTO_PARAMETROS.bandidos).toEqual({ perdaOuro: 0.15, perdaComida: 0.15, muralhaMinima: 1 });
    expect(EVENTO_PARAMETROS.incendio).toEqual({ perdaMadeira: 0.1 });
    expect(EVENTO_PARAMETROS.mercador).toEqual({ madeiraPaga: 100, ouroRecebido: 15, prazoSegundos: 120 });
  });

  it('conta nova com eventos, sem ações, 120 min: idêntica ao código antes do 18a (todos os 6 eventos aparecem)', () => {
    for (const [semente, antes] of Object.entries(comEventos.estados)) {
      const l = liquidar(estadoInicial({ semente: Number(semente), agora: T0 }), T0 + 120 * MIN);
      expect(l.recursos, `semente ${semente}`).toEqual(antes.recursos);
      expect(l.aldeoes).toEqual(antes.aldeoes);
      expect(l.cronica).toEqual(antes.cronica);
      expect(l.segredo.rng).toBe(antes.rng);
      expect(l.segredo.proximoEventoEm).toBe(antes.proximoEventoEm);
    }
  });

  it('com o Armazém grande, a Tempestade entra com 10% do teto (integração pela liquidação)', () => {
    // Semente 7: o primeiro evento da conta nova é a Tempestade (ver a fixture).
    const e = estadoInicial({ semente: 7, agora: T0 });
    e.slots.armazem_1.nivel = 5; // teto 1.732
    e.recursos.madeira = 0;
    e.slots.serraria_1.nivel = 0; // sem produção de madeira: só o evento entra
    const l = liquidar(e, e.segredo.proximoEventoEm);
    expect(l.cronica.at(-1)!.texto).toBe('Tempestade: 173 madeira.');
    expect(l.recursos.madeira).toBe(u(173.2));
  });
});
