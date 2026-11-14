// Fórmulas v0 aplicadas com aritmética exata. Os parâmetros vêm de data/formulas.ts.
import { CONSTRUCOES, type TipoConstrucao } from '../data/construcoes.ts';
import { DESTINOS, type DestinoId } from '../data/expedicoes.ts';
import { FORMULAS } from '../data/formulas.ts';
import type { Recurso } from '../data/recursos.ts';
import { RELIQUIAS, type ReliquiaId } from '../data/reliquias.ts';
import { arredondar, BP, bp, limitar, MICRO, micro, multiplicar, potencia, racional } from './inteiros.ts';

export type Custo = Partial<Record<Recurso, number>>;

const F = FORMULAS;

/** round(base × fator^k), exato. */
function crescimento(base: number, fator: number, k: number): number {
  const p = potencia(racional(fator), k);
  const b = racional(base);
  return arredondar(b.n * p.n, b.d * p.d);
}

/** Custo, em micro-unidades, de levar a construção ao nível `nivelAlvo` (1 = construir). */
export function custoConstrucao(tipo: TipoConstrucao, nivelAlvo: number): Custo {
  const custo: Custo = {};
  const dados = CONSTRUCOES[tipo];
  const fator = dados.fatorCusto ?? F.construcao.fatorCusto;
  for (const [r, base] of Object.entries(dados.custoBase) as [Recurso, number][]) {
    custo[r] = crescimento(base, fator, nivelAlvo - 1) * MICRO;
  }
  return custo;
}

/** Tempo de obra, em ms, para chegar ao nível `nivelAlvo`. */
export function tempoObraMs(nivelAlvo: number): number {
  return crescimento(F.construcao.segundosBase * 1000, F.construcao.fatorTempo, nivelAlvo - 1);
}

/** Teto de armazenamento, em micro-unidades, para o nível do Armazém ou do Celeiro. */
export function tetoMicro(nivel: number): number {
  const n = Math.max(F.teto.nivelMinimo, nivel);
  return crescimento(F.teto.base, F.teto.fator, n - 1) * MICRO;
}

export function custoContratar(contratacoes: number): Custo {
  return {
    ouro: crescimento(F.contratar.ouroBase, F.contratar.fatorOuro, contratacoes) * MICRO,
    comida: micro(F.contratar.comida),
  };
}

export function custoEquipamento(peca: 'arma' | 'armadura', nivelAtual: number): Custo {
  const bases = peca === 'arma' ? F.aventureiro.custoArma : F.aventureiro.custoArmadura;
  const custo: Custo = {};
  for (const [r, base] of Object.entries(bases) as [Recurso, number][]) {
    custo[r] = multiplicar(base, racional(nivelAtual + 1)) * MICRO;
  }
  return custo;
}

export function poderAventureiro(a: { nivel: number; arma: number; armadura: number }): number {
  const p = F.aventureiro.poder;
  return p.base + p.porNivel * a.nivel + p.porArma * a.arma + p.porArmadura * a.armadura;
}

/** Chance de êxito em pontos-base (10_000 = 100%). */
export function chanceExitoBp(poderGrupo: number, perigo: number): number {
  const e = F.expedicao;
  // 0,5 + 0,02 × (poder − 1,5 × perigo), em pontos-base, com frações exatas.
  const porPoder = racional(e.chancePorPoder);
  const fator = racional(e.fatorPerigo);
  const diferenca = BigInt(poderGrupo) * fator.d - fator.n * BigInt(perigo); // (poder − 1,5 perigo) × fator.d
  const variacao = arredondar(porPoder.n * diferenca * BigInt(BP), porPoder.d * fator.d);
  return limitar(bp(e.chanceBase) + variacao, bp(e.chanceMinima), bp(e.chanceMaxima));
}

export function duracaoExpedicaoMs(destino: DestinoId, nivelCaminhosEternos: number): number {
  const reducaoBp = bp(F.reliquias.caminhosEternosPorNivel) * nivelCaminhosEternos;
  return arredondar(BigInt(DESTINOS[destino].segundos * 1000) * BigInt(BP - reducaoBp), BigInt(BP));
}

/** Multiplicador do saque em pontos-base: 1 + 0,1 × (aventureiros − 1). */
export function bonusSaqueBp(aventureiros: number): number {
  return bp(F.expedicao.bonusPorAventureiroExtra) * (aventureiros - 1);
}

export function xpParaSubir(nivel: number): number {
  return F.aventureiro.xpPorNivel * nivel;
}

export function reliquiasNaAscensao(ciclo: number): number {
  return F.ascensao.reliquiasBase + F.ascensao.reliquiasPorCiclo * (ciclo - 1);
}

export function custoReliquia(id: ReliquiaId, nivelAtual: number): number {
  return RELIQUIAS[id].custoBase * (nivelAtual + 1);
}

/** Ganho de um clique, em micro-unidades. */
export function ganhoCliqueMicro(nivelMaosCalejadas: number): number {
  const bonus = bp(F.reliquias.maosCalejadasPorNivel) * nivelMaosCalejadas;
  return arredondar(BigInt(micro(F.clique.ganhoBase)) * BigInt(BP + bonus), BigInt(BP));
}
