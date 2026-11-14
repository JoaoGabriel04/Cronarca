import { expect } from 'vitest';
import type { Recurso } from '../data/recursos.ts';
import { aplicarAcao, type Acao, type OpcoesAcao } from '../src/acoes.ts';
import type { EstadoJogo } from '../src/estado.ts';
import { estadoInicial } from '../src/inicial.ts';
import { MICRO } from '../src/inteiros.ts';

/** Instante inicial fixo dos testes. */
export const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
export const SEG = 1000;
export const MIN = 60 * SEG;

/** Estado inicial com o próximo evento empurrado para longe (testes sem eventos). */
export function novo(op: { semente?: number; semEventos?: boolean } = {}): EstadoJogo {
  const e = estadoInicial({ semente: op.semente ?? 42, agora: T0 });
  if (op.semEventos !== false) e.segredo.proximoEventoEm = T0 + 1000 * 24 * 60 * MIN;
  return e;
}

export const u = (unidades: number) => Math.round(unidades * MICRO);

export function comRecursos(e: EstadoJogo, recursos: Partial<Record<Recurso, number>>): EstadoJogo {
  for (const [r, v] of Object.entries(recursos) as [Recurso, number][]) e.recursos[r] = u(v);
  return e;
}

/** Aplica e exige sucesso. */
export function fazer(e: EstadoJogo, acao: Acao, agora = e.t, opcoes?: OpcoesAcao): EstadoJogo {
  const r = aplicarAcao(e, acao, agora, opcoes);
  if (!r.ok) throw new Error(`ação ${acao.tipo} recusada: ${r.erro}`);
  return r.estado;
}

/** Aplica e exige o erro dado; confere que só a liquidação mudou o estado. */
export function recusar(e: EstadoJogo, acao: Acao, erro: string, agora = e.t) {
  const r = aplicarAcao(e, acao, agora);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.erro).toBe(erro);
  return r.estado;
}
