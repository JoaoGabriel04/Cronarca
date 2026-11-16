// Ecos (Portão 20b, mínimo; CRONARCA_COMBATE_E_MAPA.md 1.4 e 1.5): o poder de
// cada fase pela curva de dificuldade e uma composição defensiva pelo
// orçamento. Puro e determinístico: a mesma fase dá o mesmo Eco para todos.
// Tema, regra do Eco, tamanho visual, butim e cenário são do Portão 23.
//
// Arredondamento: E(n) e o poder do Eco saem de contas exatas em BigInt
// (100 × 21^(n−1) / 20^(n−1), vezes o multiplicador em centésimos) e só o
// resultado final é arredondado, com o meio para cima.

import { CLASSES, type Classe } from '../../data/aventureiros.ts';
import { COMPOSICAO_ECO, CURVA_ECO, PODER_FASE_BP, TAMANHO_ECO, type NivelEco } from '../../data/combate.ts';
import { unidadeComPoder, type UnidadeCombate } from './unidade.ts';

const arredondar = (num: bigint, den: bigint) => Number((2n * num + den) / (2n * den));
const potencia = (n: number) => ({ num: BigInt(CURVA_ECO.fator.num) ** BigInt(n - 1), den: BigInt(CURVA_ECO.fator.den) ** BigInt(n - 1) });

/** Poder esperado do jogador na fase n: E(n) = 100 × 1,05^(n−1), arredondado. */
export function poderEsperado(fase: number): number {
  const p = potencia(fase);
  return arredondar(BigInt(CURVA_ECO.base) * p.num, p.den);
}

/** Nível e multiplicador (centésimos, já com o endurecimento) da fase. */
export function dificuldadeDaFase(fase: number): { nivel: NivelEco; mult: number } {
  const C = CURVA_ECO;
  const chefe = fase % C.chefe.aCada === 0;
  const posicao = C.ciclo[(fase - 1) % C.ciclo.length]!;
  const nivel: NivelEco = chefe ? 'chefe' : posicao.nivel;
  const base = chefe ? C.chefe.mult : posicao.mult;
  const endurece = nivel === 'dificil' || nivel === 'muito_dificil' || nivel === 'chefe';
  const k = endurece ? Math.min(C.endurecimento.passosMaximos, Math.floor((fase - 1) / C.endurecimento.aCada)) : 0;
  return { nivel, mult: base + C.endurecimento.passo * k };
}

/** Poder do Eco: E(n) exato × multiplicador, arredondado só no fim. */
export function poderDoEco(fase: number): number {
  const p = potencia(fase);
  const { mult } = dificuldadeDaFase(fase);
  return arredondar(BigInt(CURVA_ECO.base) * p.num * BigInt(mult), p.den * 100n);
}

/** poder × pontos-base / 10 000, arredondado para cima, em BigInt (o produto passa de 2^53 nas fases altas). */
const paraCima = (poder: number, bp: number) => Number((BigInt(poder) * BigInt(bp) + 9_999n) / 10_000n);

/** Poder mínimo da tropa para tentar a fase (abaixo, o botão "Enviar tropa" fica bloqueado), arredondado para cima. */
export function poderMinimo(fase: number): number {
  return paraCima(poderDoEco(fase), PODER_FASE_BP.minimo);
}

/** Poder recomendado: com ele, a composição razoável vence. Arredondado para cima. */
export function poderRecomendado(fase: number): number {
  return paraCima(poderDoEco(fase), PODER_FASE_BP.recomendado);
}

/** Quantas unidades o Eco tem: 3, +1 a cada 20 fases, até 8. */
export const tamanhoDoEco = (fase: number) => Math.min(TAMANHO_ECO.maximo, TAMANHO_ECO.inicial + Math.floor((fase - 1) / TAMANHO_ECO.aCada));

/**
 * Classes de n unidades pela composição (maiores restos): com 3, Lanceiro,
 * Cavaleiro e Arqueiro; com 4, as quatro. Ordem fixa de CLASSES.
 */
export function classesDaComposicao(n: number, composicao: Record<Classe, number> = COMPOSICAO_ECO): Classe[] {
  const total = CLASSES.reduce((s, c) => s + composicao[c], 0);
  const cotas = CLASSES.map((c) => ({ c, inteira: Math.floor((n * composicao[c]) / total), resto: (n * composicao[c]) % total }));
  let faltam = n - cotas.reduce((s, x) => s + x.inteira, 0);
  for (const x of [...cotas].sort((a, b) => b.resto - a.resto || CLASSES.indexOf(a.c) - CLASSES.indexOf(b.c))) {
    if (faltam-- <= 0) break;
    x.inteira++;
  }
  return cotas.flatMap((x) => Array.from({ length: x.inteira }, () => x.c));
}

/** Unidades com o orçamento repartido igualmente, cada uma na linha padrão da classe. */
export function tropaComPoder(poder: number, classes: readonly Classe[]): UnidadeCombate[] {
  const n = classes.length;
  return classes.map((c, i) => unidadeComPoder(c, Math.floor(poder / n) + (i < poder % n ? 1 : 0)));
}

export interface Eco {
  fase: number;
  nivel: NivelEco;
  /** Poder esperado do jogador nesta fase (E(n)). */
  esperado: number;
  /** Poder recomendado: o do Eco. */
  poder: number;
  unidades: UnidadeCombate[];
}

/** O Eco da fase: mesma fase, mesmo Eco. */
export function gerarEco(fase: number): Eco {
  if (!Number.isInteger(fase) || fase < 1) throw new Error(`fase inválida: ${fase}`);
  const { nivel } = dificuldadeDaFase(fase);
  const poder = poderDoEco(fase);
  return { fase, nivel, esperado: poderEsperado(fase), poder, unidades: tropaComPoder(poder, classesDaComposicao(tamanhoDoEco(fase))) };
}
