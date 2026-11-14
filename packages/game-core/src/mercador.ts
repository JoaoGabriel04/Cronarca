// Mercador Viajante: os termos da troca vão no evento (estado), não só na
// constante. A tela mostra o que o servidor gravou e a resposta cobra e paga
// exatamente isso, mesmo se EVENTO_PARAMETROS mudar com um Mercador pendente.
import { EVENTO_PARAMETROS, NOMES_EVENTOS } from '../data/eventos.ts';
import { NOMES_RECURSOS, RECURSOS, type Recurso } from '../data/recursos.ts';
import { formatarInteiro, registrar } from './cronica.ts';
import type { EstadoJogo } from './estado.ts';
import { micro } from './inteiros.ts';

/** Quantidades em micro-unidades, como os recursos do estado. */
export type Troca = Partial<Record<Recurso, number>>;

export interface TermosMercador {
  /** O que o jogador entrega se aceitar. */
  paga: Troca;
  /** O que o jogador recebe se aceitar (cortado no teto, como todo ganho). */
  recebe: Troca;
}

/** Termos atuais (EVENTO_PARAMETROS.mercador), em micro-unidades. */
export function termosDoMercador(): TermosMercador {
  const P = EVENTO_PARAMETROS.mercador;
  return { paga: { madeira: micro(P.madeiraPaga) }, recebe: { ouro: micro(P.ouroRecebido) } };
}

/** "100 madeira", "100 madeira e 15 ouro" (ordem fixa dos recursos). */
export function descreverTroca(t: Troca): string {
  const partes = RECURSOS.filter((r) => (t[r] ?? 0) > 0).map((r) => `${formatarInteiro(t[r]!)} ${NOMES_RECURSOS[r].toLowerCase()}`);
  return partes.join(' e ');
}

/** O Mercador chega no instante t: grava os termos e o prazo e escreve na Crônica. */
export function abrirMercador(e: EstadoJogo, t: number): void {
  const termos = termosDoMercador();
  e.mercador = { expiraEm: t + EVENTO_PARAMETROS.mercador.prazoSegundos * 1000, ...termos };
  registrar(e, 'Evento', `${NOMES_EVENTOS.mercador_viajante}: troca ${descreverTroca(termos.paga)} por ${descreverTroca(termos.recebe)}.`, t);
}
