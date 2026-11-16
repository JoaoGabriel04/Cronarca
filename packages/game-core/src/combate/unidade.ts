// Unidade de combate (Portão 20b): os atributos de um guerreiro na batalha,
// derivados da classe, do nível (1 a 20) e do equipamento (0 a 6), e o Poder
// de combate. Tudo inteiro. O Poder convive com poderAventureiro (expedições),
// que não muda.

import type { Classe } from '../../data/aventureiros.ts';
import { ARMADURA, ATRIBUTOS_CLASSE, PODER, type Linha } from '../../data/combate.ts';

/** Quem vai à batalha (o que o estado guarda de um aventureiro). */
export interface Guerreiro {
  classe: Classe;
  nivel: number;
  arma: number;
  armadura: number;
}

/** Atributos de combate prontos (o simulador só lê isto). */
export interface UnidadeCombate {
  classe: Classe;
  vida: number;
  ataque: number;
  defesa: number;
  alcance: number;
  intervalo: number;
  aproximacao: number;
  alvos: number;
  linha: Linha;
}

/** Atributos de um guerreiro; a linha é a padrão da classe, a menos que a formação diga outra. */
export function unidadeDoGuerreiro(g: Guerreiro, linha?: Linha): UnidadeCombate {
  const a = ATRIBUTOS_CLASSE[g.classe];
  const niveis = g.nivel - 1;
  return {
    classe: g.classe,
    vida: a.vida + a.porNivel.vida * niveis + ARMADURA.vida * g.armadura,
    ataque: a.ataque + a.porNivel.ataque * niveis + a.ataquePorArma * g.arma,
    defesa: a.defesa + a.porNivel.defesa * niveis + ARMADURA.defesa * g.armadura,
    alcance: a.alcance,
    intervalo: a.intervalo,
    aproximacao: a.aproximacao,
    alvos: a.alvos,
    linha: linha ?? a.linha,
  };
}

/** Raiz quadrada inteira (para baixo), exata. */
export function raizInteira(n: bigint): bigint {
  if (n < 0n) throw new Error('raiz de negativo');
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * Poder de uma unidade: raiz inteira de vida efetiva × dano por segundo (com
 * os alvos do golpe), na escala de PODER. Pela lei quadrática de Lanchester, a
 * força de um exército é o quadrado da soma destes poderes; então somar poderes
 * compara exércitos de tamanhos diferentes.
 */
export function poderUnidade(u: Pick<UnidadeCombate, 'vida' | 'ataque' | 'defesa' | 'intervalo' | 'alvos'>): number {
  const num = BigInt(u.vida) * BigInt(100 + 5 * u.defesa) * BigInt(u.ataque) * BigInt(u.alvos) * BigInt(PODER.escala);
  const den = BigInt(u.intervalo) * BigInt(PODER.divisor);
  return Number(raizInteira(num / den));
}

/** Poder de combate de um guerreiro (o número do mínimo, do recomendado e da calibragem). */
export const poderCombate = (g: Guerreiro): number => poderUnidade(unidadeDoGuerreiro(g));

/** Poder da tropa enviada: a soma do poder de cada guerreiro. */
export const poderTropa = (lista: readonly Guerreiro[]): number => lista.reduce((s, g) => s + poderCombate(g), 0);

/**
 * Unidade da classe com o poder pedido (Ecos e tropa sintética da calibragem):
 * os atributos de nível 1 com vida e ataque escalados pelo mesmo fator, o que
 * escala o poder nesse fator. Defesa, intervalo e alcance ficam os da classe.
 */
export function unidadeComPoder(classe: Classe, poder: number, linha?: Linha): UnidadeCombate {
  const base = unidadeDoGuerreiro({ classe, nivel: 1, arma: 0, armadura: 0 }, linha);
  const p = poderUnidade(base);
  const fatorBp = Math.max(1, Math.floor((2 * poder * 10_000 + p) / (2 * p))); // arredonda, só com inteiros
  return {
    ...base,
    vida: Math.max(1, Math.floor((base.vida * fatorBp) / 10_000)),
    ataque: Math.max(1, Math.floor((base.ataque * fatorBp) / 10_000)),
  };
}


