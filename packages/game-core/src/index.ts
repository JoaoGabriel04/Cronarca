// Regras, dados e simulação do Cronarca. TypeScript puro, sem I/O.
// Usado pelo servidor (autoridade) e pelo cliente (predição).

export const VERSAO_GAME_CORE = '0.1.0';

export * from '../data/recursos.ts';
export * from '../data/construcoes.ts';
export * from '../data/slots.ts';
export * from '../data/pesquisas.ts';
export * from '../data/expedicoes.ts';
export * from '../data/aventureiros.ts';
export * from '../data/aldeoes.ts';
export * from '../data/falha.ts';
export * from '../data/eventos.ts';
export * from '../data/reliquias.ts';
export * from '../data/eras.ts';
export * from '../data/catalogo.ts';
export * from '../data/mapa.ts';
export * from '../data/ranking.ts';
export { FORMULAS } from '../data/formulas.ts';

export * from './inteiros.ts';
export * from './estado.ts';
export * from './formulas.ts';
export * from './regras.ts';
export { estadoInicial, type OpcoesInicio } from './inicial.ts';
export { liquidar } from './liquidar.ts';
export * from './acoes.ts';
export * from './previsao.ts';
export * from './mapa/meta.ts';
export { criarSorteador, type Sorteador } from './rng.ts';
export { formatarInteiro as formatarInteiroCronica, formatarQuantidade, type IconeCronica } from './cronica.ts';
export * from './preferencias.ts';
export * from './conta.ts';
export * from './catalogo.ts';
export * from './animacao.ts';
export * from './ranking.ts';
export * from './mercador.ts';
