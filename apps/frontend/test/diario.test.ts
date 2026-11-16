import { CAPITULOS, CAPITULOS_IDS, estadoInicial, proximoPasso, visaoDoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { deveAbrirPrologo, linhasDiario, novosNoDiario } from '../lib/casca/diario';
import { eraAtual } from '../lib/casca/telas';

const novo = () => visaoDoCliente(estadoInicial({ semente: 1, agora: Date.UTC(2026, 5, 1) }));

describe('Diário na casca (Portão 16)', () => {
  it('conta nova: o prólogo liberado e novo; os outros só "?" e a dica, sem entregar o texto', () => {
    const linhas = linhasDiario(novo(), new Set());
    expect(linhas.map((l) => l.id)).toEqual([...CAPITULOS_IDS]);
    expect(linhas[0]).toEqual({ id: 'prologo', liberado: true, titulo: 'O Relógio parado', texto: CAPITULOS.prologo.texto, dica: null, novo: true });
    for (const l of linhas.slice(1)) {
      expect(l).toMatchObject({ liberado: false, titulo: '?', texto: null, novo: false });
      expect(l.dica).toBe(CAPITULOS[l.id].dica);
    }
  });

  it('o ponto de "novo" some quando o capítulo foi aberto neste navegador', () => {
    const e = novo();
    e.diario.push('scriptorium');
    expect(novosNoDiario(e, new Set())).toBe(2);
    expect(novosNoDiario(e, new Set(['prologo']))).toBe(1);
    expect(linhasDiario(e, new Set(['prologo', 'scriptorium'])).filter((l) => l.novo)).toEqual([]);
  });

  it('prólogo abre só se o estado e o navegador não o viram', () => {
    const e = novo();
    expect(deveAbrirPrologo(e, false)).toBe(true);
    expect(deveAbrirPrologo(e, true)).toBe(false);
    expect(deveAbrirPrologo({ ...e, prologoVisto: true }, false)).toBe(false);
  });

  it('o chip mostra um primeiro passo real na conta nova; Eras e o objetivo leem a mesma regra de cumprido', () => {
    const e = novo();
    expect(proximoPasso(e).principal).toBe('Construa a Pedreira: madeira 100 de 180');
    const era = eraAtual(e);
    expect(proximoPasso(e).trilhas.map((t) => t.cumprida)).toEqual(era.objetivos.map((o) => o.feito));
  });
});
