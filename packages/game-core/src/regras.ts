// Grandezas derivadas do estado: tetos, vagas, taxas, desbloqueios.
// Tudo puro e inteiro; usado pela simulação, pelas ações e pela interface.
import { RODIZIO_OFICIOS, type Oficio } from '../data/aventureiros.ts';
import { CONSTRUCOES, type TipoConstrucao } from '../data/construcoes.ts';
import { DESTINOS, type DestinoId } from '../data/expedicoes.ts';
import { FORMULAS } from '../data/formulas.ts';
import { OBJETIVOS_ERA_1 } from '../data/eras.ts';
import { RECURSOS, type Recurso } from '../data/recursos.ts';
import type { ReliquiaId } from '../data/reliquias.ts';
import { SLOT_IDS, SLOTS } from '../data/slots.ts';
import type { EstadoJogo, VisaoCliente } from './estado.ts';
import { tetoMicro } from './formulas.ts';
import { aplicarBonus, bp, mili } from './inteiros.ts';

const F = FORMULAS;

export function nivelReliquia(e: VisaoCliente, id: ReliquiaId): number {
  return e.reliquias.niveis[id] ?? 0;
}

/** Soma dos níveis atuais (obras em andamento ainda não contam) das construções de um tipo. */
export function somaNiveis(e: Pick<EstadoJogo, 'slots'>, tipo: TipoConstrucao): number {
  let soma = 0;
  for (const id of SLOT_IDS) if (SLOTS[id].tipo === tipo) soma += e.slots[id].nivel;
  return soma;
}

function quantasConstruidas(e: VisaoCliente, tipo: TipoConstrucao): number {
  let n = 0;
  for (const id of SLOT_IDS) if (SLOTS[id].tipo === tipo && e.slots[id].nivel >= 1) n += 1;
  return n;
}

/** Só depende dos slots: serve também à visão do cliente (sem o segredo). */
export function tetos(e: Pick<EstadoJogo, 'slots'>): Record<Recurso, number> {
  const armazem = tetoMicro(somaNiveis(e, 'armazem'));
  const celeiro = tetoMicro(somaNiveis(e, 'celeiro'));
  const t = {} as Record<Recurso, number>;
  for (const r of RECURSOS) t[r] = r === 'comida' ? celeiro : armazem;
  return t;
}

export function aldeoesMaximos(e: VisaoCliente): number {
  return F.aldeoes.porNivelDeCasa * somaNiveis(e, 'casa');
}

export function vagasGuilda(e: VisaoCliente): number {
  const g = F.guilda;
  const hospitalidade = e.pesquisas.concluidas.includes('hospitalidade')
    ? g.vagasHospitalidadePorTaverna * quantasConstruidas(e, 'taverna')
    : 0;
  return g.vagasBase + g.vagasPorNivelDeTaverna * somaNiveis(e, 'taverna') + hospitalidade;
}

export function oficioDoProximoAldeao(e: VisaoCliente): Oficio {
  return RODIZIO_OFICIOS[e.aldeoes.length % RODIZIO_OFICIOS.length]!;
}

function contarOficio(e: VisaoCliente, oficio: Oficio): number {
  let n = 0;
  for (const a of e.aldeoes) if (a.oficio === oficio) n += 1;
  return n;
}

const OFICIO_DO_RECURSO: Partial<Record<Recurso, Oficio>> = {
  madeira: 'lenhador',
  pedra: 'mineiro',
  saber: 'sabio',
  ferro: 'ferreiro',
};

export interface Taxas {
  /** Produção bruta com bônus, em milésimos por segundo. */
  producao: Record<Recurso, number>;
  /** Consumo (só comida), em milésimos por segundo. */
  consumoComida: number;
  /** Saldo por segundo (produção − consumo). Só a comida pode ser negativa. */
  saldo: Record<Recurso, number>;
}

/**
 * Taxas por segundo. Bônus da mesma categoria somam; categorias diferentes
 * multiplicam: geral (Bênção), específico do recurso (Colheita Farta,
 * Sabedoria Ancestral) e ofício (+5% por aldeão; para quando a comida zera).
 */
export function calcularTaxas(e: VisaoCliente): Taxas {
  const base = {} as Record<Recurso, number>;
  for (const r of RECURSOS) base[r] = 0;
  for (const id of SLOT_IDS) {
    const prod = CONSTRUCOES[SLOTS[id].tipo].producao;
    if (prod) base[prod.recurso] += mili(prod.porSegundo) * e.slots[id].nivel;
  }
  base.comida += mili(F.aldeoes.comidaDoFazendeiro) * contarOficio(e, 'fazendeiro');

  const geral = bp(F.reliquias.bencaoColheitaPorNivel) * nivelReliquia(e, 'bencao_colheita');
  const especifico: Partial<Record<Recurso, number>> = {
    comida: e.pesquisas.concluidas.includes('colheita_farta') ? bp(F.pesquisas.colheitaFarta) : 0,
    saber: bp(F.reliquias.sabedoriaAncestralPorNivel) * nivelReliquia(e, 'sabedoria_ancestral'),
  };
  const comComida = e.recursos.comida > 0;

  const producao = {} as Record<Recurso, number>;
  for (const r of RECURSOS) {
    let v = aplicarBonus(base[r], geral);
    v = aplicarBonus(v, especifico[r] ?? 0);
    const oficio = OFICIO_DO_RECURSO[r];
    if (oficio && comComida) v = aplicarBonus(v, bp(F.aldeoes.bonusPorOficio) * contarOficio(e, oficio));
    producao[r] = v;
  }

  const consumoComida =
    mili(F.consumo.comidaPorAldeao) * e.aldeoes.length + mili(F.consumo.comidaPorAventureiro) * e.aventureiros.length;

  const saldo = { ...producao };
  saldo.comida -= consumoComida;
  return { producao, consumoComida, saldo };
}

export function destinoAberto(e: Pick<EstadoJogo, 'pesquisas'>, destino: DestinoId): boolean {
  const req = DESTINOS[destino].requer;
  return req === null || e.pesquisas.concluidas.includes(req);
}

export interface Objetivos {
  cartaReal: boolean;
  criptaVencida: boolean;
  aldeoes: boolean;
  todos: boolean;
}

export function objetivosEra(e: VisaoCliente): Objetivos {
  const cartaReal = e.pesquisas.concluidas.includes(OBJETIVOS_ERA_1.pesquisa);
  const criptaVencida = e.objetivos.criptaVencida;
  const aldeoes = e.aldeoes.length >= OBJETIVOS_ERA_1.aldeoesMinimos;
  return { cartaReal, criptaVencida, aldeoes, todos: cartaReal && criptaVencida && aldeoes };
}
