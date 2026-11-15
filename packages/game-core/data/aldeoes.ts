// Alocação de ofícios (Portão 17). O jogador distribui os aldeões entre os
// ofícios; os que chegam seguem uma política (ou chegam ociosos com a
// distribuição automática desligada). Só números e nomes: a lógica fica em
// src/regras.ts e src/acoes.ts.

import { OFICIOS, type Oficio } from './aventureiros.ts';

/** Ofício de um aldeão: os cinco produtores ou Ocioso (não produz, mas come). */
export const OFICIO_OCIOSO = 'ocioso' as const;
export const OFICIOS_ALDEAO = [...OFICIOS, OFICIO_OCIOSO] as const;
export type OficioAldeao = (typeof OFICIOS_ALDEAO)[number];

export const NOME_OCIOSO = 'Ocioso';

/** Quem muda de ofício leva este tempo para começar a produzir (ir para Ocioso é na hora). */
export const DESLOCAMENTO_ALDEAO_MS = 10_000;

/**
 * Políticas da distribuição automática. "manter" não se escolhe: vem do
 * ajuste manual e segue a proporção que o jogador montou (`proporcao`).
 */
export const POLITICAS_PRONTAS = ['equilibrada', 'comida', 'construcao', 'pesquisa', 'ferro'] as const;
export const POLITICAS_ALDEOES = [...POLITICAS_PRONTAS, 'manter'] as const;
export type PoliticaPronta = (typeof POLITICAS_PRONTAS)[number];
export type PoliticaAldeoes = (typeof POLITICAS_ALDEOES)[number];

export const NOMES_POLITICAS: Record<PoliticaAldeoes, string> = {
  equilibrada: 'Equilibrada',
  comida: 'Comida primeiro',
  construcao: 'Construção',
  pesquisa: 'Pesquisa',
  ferro: 'Ferro',
  manter: 'Manter proporção atual',
};

/**
 * Peso de cada ofício por política: quem chega vai para o ofício mais abaixo
 * da sua parte (quantidade / peso), desempate pela ordem de OFICIOS. Pesos
 * iguais reproduzem o rodízio antigo numa conta nova.
 */
export const PESOS_POLITICA: Record<PoliticaPronta, Record<Oficio, number>> = {
  equilibrada: { fazendeiro: 1, lenhador: 1, mineiro: 1, sabio: 1, ferreiro: 1 },
  comida: { fazendeiro: 3, lenhador: 1, mineiro: 1, sabio: 1, ferreiro: 1 },
  construcao: { fazendeiro: 1, lenhador: 2, mineiro: 2, sabio: 0, ferreiro: 0 },
  pesquisa: { fazendeiro: 1, lenhador: 1, mineiro: 0, sabio: 3, ferreiro: 0 },
  ferro: { fazendeiro: 1, lenhador: 0, mineiro: 1, sabio: 0, ferreiro: 3 },
};

/**
 * Regra da comida (Portão 18a): quem chega vira Fazendeiro, com a automática
 * ligada ou não, se a comida estiver abaixo disto (unidades) ou se o saldo de
 * comida ficaria negativo com ele.
 */
export const COMIDA_MINIMA_ALDEAO = 20;

/** Configuração inicial (conta nova, saves antigos e cada ciclo novo). */
export const CONFIG_ALDEOES_INICIAL = { automatica: true, politica: 'equilibrada' } as const;
