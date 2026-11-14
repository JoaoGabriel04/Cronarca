// Previsão no cliente (Portão 10; handoff, Arquitetura 5). O cliente recebe a
// visão sem o segredo (gerador de sorteios, hora do próximo evento e resultados
// das expedições), então só prevê a parte determinística: produção, obras,
// pesquisas, aldeões e as ações sem sorteio. O resto espera o servidor, que
// sempre vence na reconciliação.

import { aplicarAcao, type Acao, type ErroAcao, type OpcoesAcao } from './acoes.ts';
import type { EstadoJogo, VisaoCliente } from './estado.ts';
import { liquidar } from './liquidar.ts';

/** Ações que sorteiam no servidor: o cliente não as prevê, espera a resposta. */
export const ACOES_DO_SERVIDOR = ['contratar', 'partir_expedicao', 'ascender'] as const satisfies readonly Acao['tipo'][];
export type AcaoDoServidor = Extract<Acao, { tipo: (typeof ACOES_DO_SERVIDOR)[number] }>;

export const precisaDoServidor = (acao: Acao): acao is AcaoDoServidor =>
  (ACOES_DO_SERVIDOR as readonly string[]).includes(acao.tipo);

/** Segredo de mentira: nenhum evento chega (a hora real é secreta) e nenhum resultado é conhecido. */
const SEM_SEGREDO: EstadoJogo['segredo'] = { rng: 0, proximoEventoEm: Number.MAX_SAFE_INTEGER, resultados: {} };

const comSegredoFalso = (v: VisaoCliente): EstadoJogo => ({ ...structuredClone(v), segredo: { ...SEM_SEGREDO, resultados: {} } });
const semSegredo = (e: EstadoJogo): VisaoCliente => {
  const { segredo: _s, ...visivel } = e;
  return visivel;
};

/** Primeiro fim de expedição depois do instante já liquidado (precisa do resultado secreto). */
function proximoFimDeExpedicao(v: VisaoCliente): number | null {
  const fins = v.expedicoes.map((x) => x.fim).filter((f) => f > v.t);
  return fins.length ? Math.min(...fins) : null;
}

export interface Previsao {
  estado: VisaoCliente;
  /**
   * Instante em que a previsão parou por precisar do servidor (fim de uma
   * expedição); null se chegou ao alvo. O cliente deve pedir o estado de novo.
   */
  paradaEm: number | null;
}

/**
 * Liquida a parte determinística até `alvo`. Para antes do fim da primeira
 * expedição (o resultado é secreto) e não aplica eventos (a hora é secreta).
 * Sem evento nem expedição no intervalo, dá exatamente o mesmo que `liquidar`
 * no servidor: tudo em inteiros.
 */
export function preverEstado(v: VisaoCliente, alvo: number): Previsao {
  const fim = proximoFimDeExpedicao(v);
  const ate = fim !== null && fim <= alvo ? fim - 1 : alvo;
  if (ate <= v.t) return { estado: structuredClone(v), paradaEm: fim !== null && fim <= alvo ? fim : null };
  const e = liquidar(comSegredoFalso(v), ate);
  return { estado: semSegredo(e), paradaEm: fim !== null && fim <= alvo ? fim : null };
}

export type ResultadoPrevisto =
  | { ok: true; estado: VisaoCliente; cliquesAceitos?: number }
  | { ok: false; erro: ErroAcao | 'espera_servidor'; estado: VisaoCliente };

/**
 * Aplica no cliente uma ação sem sorteio, para a tela responder na hora. As
 * que sorteiam (ACOES_DO_SERVIDOR) devolvem 'espera_servidor' sem mudar nada.
 */
export function preverAcao(v: VisaoCliente, acao: Acao, agora: number, opcoes: OpcoesAcao = {}): ResultadoPrevisto {
  if (precisaDoServidor(acao)) return { ok: false, erro: 'espera_servidor', estado: v };
  // Se a previsão parou antes de `agora` (expedição voltando, resultado
  // secreto), a ação é aplicada nesse instante; o servidor corrige ao responder.
  const base = preverEstado(v, agora).estado;
  const r = aplicarAcao(comSegredoFalso(base), acao, base.t, opcoes);
  if (!r.ok) return { ok: false, erro: r.erro, estado: base };
  return r.cliquesAceitos === undefined ? { ok: true, estado: semSegredo(r.estado) } : { ok: true, estado: semSegredo(r.estado), cliquesAceitos: r.cliquesAceitos };
}
