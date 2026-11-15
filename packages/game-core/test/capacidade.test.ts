// Nenhum gasto pode custar mais do que a capacidade alcançável do recurso:
// senão o jogador nunca junta o suficiente e trava (portão "Custo x capacidade").
import { describe, expect, it } from 'vitest';
import { NIVEL_MAXIMO_CONSTRUCAO, TIPOS_CONSTRUCAO } from '../data/construcoes.ts';
import { ESTADO_INICIAL_CICLO } from '../data/eras.ts';
import { EVENTO_PARAMETROS } from '../data/eventos.ts';
import { FORMULAS } from '../data/formulas.ts';
import { FALHA } from '../data/falha.ts';
import { PESQUISAS, type PesquisaId } from '../data/pesquisas.ts';
import type { Recurso } from '../data/recursos.ts';
import { SLOT_IDS, SLOTS } from '../data/slots.ts';
import { custoConstrucao, custoContratar, custoEquipamento, custoPesquisa, tetoMicro, type Custo } from '../src/formulas.ts';
import { micro } from '../src/inteiros.ts';

/** Capacidade máxima alcançável: Armazém (5 recursos) e Celeiro (comida) no nível máximo. */
const TETO_MAXIMO = tetoMicro(NIVEL_MAXIMO_CONSTRUCAO);

/** Recursos do custo que passam da capacidade, como texto ("madeira 12394 > 11533"). */
function excessos(custo: Custo, teto: number): string[] {
  return (Object.entries(custo) as [Recurso, number][])
    .filter(([, v]) => v > teto)
    .map(([r, v]) => `${r} ${v / 1_000_000} > ${teto / 1_000_000}`);
}

describe('custo x capacidade do armazém', () => {
  it('toda construção, em todo nível, cabe na capacidade alcançável', () => {
    const violacoes: string[] = [];
    for (const tipo of TIPOS_CONSTRUCAO) {
      for (let nivel = 1; nivel <= NIVEL_MAXIMO_CONSTRUCAO; nivel++) {
        // O Armazém se paga com a capacidade do nível que ele já tem; o resto, com o Armazém e o Celeiro no máximo.
        const teto = tipo === 'armazem' ? tetoMicro(nivel - 1) : TETO_MAXIMO;
        for (const e of excessos(custoConstrucao(tipo, nivel), teto)) violacoes.push(`${tipo} nível ${nivel}: ${e}`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('todas as contratações até lotar a guilda cabem', () => {
    const G = FORMULAS.guilda;
    const tavernas = SLOT_IDS.filter((id) => SLOTS[id].tipo === 'taverna').length;
    const vagasMaximas = G.vagasBase + tavernas * (G.vagasPorNivelDeTaverna * NIVEL_MAXIMO_CONSTRUCAO + G.vagasHospitalidadePorTaverna);
    const contratacoes = vagasMaximas - ESTADO_INICIAL_CICLO.aventureiros;
    expect(contratacoes).toBeGreaterThan(0);
    const violacoes: string[] = [];
    for (let c = 0; c < contratacoes; c++) {
      for (const e of excessos(custoContratar(c), TETO_MAXIMO)) violacoes.push(`contratação ${c + 1}: ${e}`);
    }
    expect(violacoes).toEqual([]);
  });

  it('pesquisas, equipamento e a troca do Mercador cabem', () => {
    const violacoes: string[] = [];
    // Pesquisas no pior caso: a Falha máxima (Portão 18b encarece Estradas Reais e Carta Real).
    for (const id of Object.keys(PESQUISAS) as PesquisaId[]) {
      for (const e of excessos(custoPesquisa(id, FALHA.nivelMaximo), TETO_MAXIMO)) violacoes.push(`pesquisa ${id} (Falha ${FALHA.nivelMaximo}): ${e}`);
    }
    for (const peca of ['arma', 'armadura'] as const) {
      for (let n = 0; n < FORMULAS.aventureiro.equipamentoMaximo; n++) {
        for (const e of excessos(custoEquipamento(peca, n), TETO_MAXIMO)) violacoes.push(`${peca} ${n} → ${n + 1}: ${e}`);
      }
    }
    for (const e of excessos({ madeira: micro(EVENTO_PARAMETROS.mercador.madeiraPaga) }, TETO_MAXIMO)) violacoes.push(`mercador: ${e}`);
    expect(violacoes).toEqual([]);
  });
});
