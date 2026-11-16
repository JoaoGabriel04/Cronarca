// Prontidão da tropa para uma fase (Portão 20d-2): quanto poder a tropa tem,
// o mínimo e o recomendado da fase, quanto falta e em que faixa ela está. Puro
// e inteiro; sem tela (a Mesa de Guerra é o Portão 23). O Poder soma o poder de
// cada unidade enviada, a mesma função do simulador (poderCombate).
//
// O Poder engana conforme a composição (docs/CALIBRACAO_COMBATE.md, 1c): só
// corpo a corpo precisa de ~1,31 do poder do Eco, só Arqueiros de ~0,93.
// avisoDeComposicao só informa; não muda o número.

import { FASE_MAXIMA } from '../../data/combate.ts';
import type { VisaoCliente } from '../estado.ts';
import { poderDoEco, poderMinimo, poderRecomendado } from './eco.ts';
import { poderTropa, type Guerreiro } from './unidade.ts';

/** bloqueada: abaixo do mínimo; arriscada: do mínimo (inclusive) até o recomendado; recomendada: no recomendado ou acima. */
export type EstadoProntidao = 'bloqueada' | 'arriscada' | 'recomendada';

export interface ProntidaoTropa {
  /** Poder da tropa (soma do poder de combate de cada guerreiro). */
  poder: number;
  /** Poder do Eco da fase. */
  poderDoEco: number;
  minimo: number;
  recomendado: number;
  /** Quanto falta para o mínimo (0 se já atinge). */
  falta: number;
  estado: EstadoProntidao;
}

/** Aviso de composição: só informa. */
export type AvisoComposicao = 'corpo_a_corpo' | 'so_arqueiros' | 'equilibrada';

/** A fase precisa ser um inteiro de 1 a FASE_MAXIMA (acima, o poder do Eco passa do inteiro seguro). */
export const faseValida = (fase: number) => Number.isInteger(fase) && fase >= 1 && fase <= FASE_MAXIMA;

/**
 * Prontidão da tropa para a fase. Tropa vazia tem poder 0 e fica bloqueada.
 * Lança RangeError se a fase for inválida.
 */
export function prontidaoDaTropa(tropa: readonly Guerreiro[], fase: number): ProntidaoTropa {
  if (!faseValida(fase)) throw new RangeError(`fase inválida: ${fase}`);
  const poder = poderTropa(tropa);
  const minimo = poderMinimo(fase);
  const recomendado = poderRecomendado(fase);
  const estado: EstadoProntidao = poder < minimo ? 'bloqueada' : poder < recomendado ? 'arriscada' : 'recomendada';
  return { poder, poderDoEco: poderDoEco(fase), minimo, recomendado, falta: Math.max(0, minimo - poder), estado };
}

/**
 * corpo_a_corpo: só Lanceiros e Cavaleiros (precisa de bem mais poder);
 * so_arqueiros: só Arqueiros (precisa de menos); equilibrada: o resto,
 * inclusive a tropa vazia e qualquer tropa com Mago do Tempo.
 */
export function avisoDeComposicao(tropa: readonly Pick<Guerreiro, 'classe'>[]): AvisoComposicao {
  if (tropa.length === 0) return 'equilibrada';
  if (tropa.every((g) => g.classe === 'arqueiro')) return 'so_arqueiros';
  if (tropa.every((g) => g.classe === 'lanceiro' || g.classe === 'cavaleiro')) return 'corpo_a_corpo';
  return 'equilibrada';
}

/**
 * A fase está liberada para o jogador? **Ainda não existe progresso de campanha
 * no estado** (decisão do dono em 16/11, opção a): por enquanto toda fase válida
 * está liberada. Quando a campanha existir (Portão 23 ou 25), a regra "vencida a
 * anterior" entra só aqui, e o endpoint de leitura já a chama.
 */
export function faseDesbloqueada(_estado: Pick<VisaoCliente, 'aventureiros'>, fase: number): boolean {
  return faseValida(fase);
}
