// Grandezas derivadas do estado: tetos, vagas, taxas, desbloqueios.
// Tudo puro e inteiro; usado pela simulação, pelas ações e pela interface.
import { COMIDA_MINIMA_ALDEAO, OFICIO_OCIOSO, PESOS_POLITICA, type OficioAldeao } from '../data/aldeoes.ts';
import { RODIZIO_OFICIOS, type Oficio } from '../data/aventureiros.ts';
import { CONSTRUCOES, type TipoConstrucao } from '../data/construcoes.ts';
import { DESTINOS, type DestinoId } from '../data/expedicoes.ts';
import { capacidadeDoAlojamento, DESTINO_QG } from '../data/qg.ts';
import { FORMULAS } from '../data/formulas.ts';
import { ESTADO_INICIAL_CICLO, OBJETIVOS_ERA_1 } from '../data/eras.ts';
import { RECURSOS, type Recurso } from '../data/recursos.ts';
import type { ReliquiaId } from '../data/reliquias.ts';
import { SLOT_IDS, SLOTS } from '../data/slots.ts';
import type { EstadoJogo, VisaoCliente } from './estado.ts';
import { poderAventureiro, tetoMicro } from './formulas.ts';
import { aplicarBonus, bp, micro, mili } from './inteiros.ts';

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

/**
 * Piso do teto no ciclo (Portão 18a): o estoque inicial com o Legado. Assim o
 * Legado rende o que o nível promete mesmo com o Armazém e o Celeiro no 1, sem
 * nada ficar acima do teto. Sem Legado, o piso fica abaixo de 300 e não muda nada.
 */
export function pisoDoTeto(e: Pick<EstadoJogo, 'reliquias'>): Record<Recurso, number> {
  const legado = e.reliquias.niveis.legado ?? 0;
  const bonus = F.reliquias.legadoPorNivel as Partial<Record<Recurso, number>>;
  const piso = {} as Record<Recurso, number>;
  for (const r of RECURSOS) piso[r] = micro(ESTADO_INICIAL_CICLO.recursos[r]) + micro(bonus[r] ?? 0) * legado;
  return piso;
}

/** Tetos com o Armazém e o Celeiro nos níveis dados (somados), já com o piso do Legado. */
export function tetosNosNiveis(e: Pick<EstadoJogo, 'reliquias'>, armazem: number, celeiro: number): Record<Recurso, number> {
  const piso = pisoDoTeto(e);
  const t = {} as Record<Recurso, number>;
  for (const r of RECURSOS) t[r] = Math.max(tetoMicro(r === 'comida' ? celeiro : armazem), piso[r]);
  return t;
}

/** Tetos de agora: Armazém (5 recursos) e Celeiro (comida), com o piso do Legado. Serve também à visão do cliente. */
export function tetos(e: Pick<EstadoJogo, 'slots' | 'reliquias'>): Record<Recurso, number> {
  return tetosNosNiveis(e, somaNiveis(e, 'armazem'), somaNiveis(e, 'celeiro'));
}

export function aldeoesMaximos(e: VisaoCliente): number {
  return F.aldeoes.porNivelDeCasa * somaNiveis(e, 'casa');
}

/**
 * Comida por segundo (milésimos) de n aventureiros (alojados ou não): cada um come base + crescimento × (n − 1)
 * (Portão 22, curva C), então a guilda pequena custa quase nada e a grande pesa. Inteiros.
 */
export function consumoComidaAventureiros(n: number): number {
  if (n <= 0) return 0;
  return n * (mili(F.consumo.comidaBaseAventureiro) + mili(F.consumo.comidaCrescimentoAventureiro) * (n - 1));
}

/** Aventureiros que ocupam vaga da Taverna: quem mora no QG (alojado) não conta. */
export const aventureirosNaTaverna = (e: Pick<VisaoCliente, 'aventureiros'>): number => e.aventureiros.filter((a) => !a.alojado).length;

/** Capacidade do Alojamento agora: 0 até o QG ser reerguido. */
export const capacidadeAlojamento = (e: Pick<VisaoCliente, 'qg'>): number => (e.qg.estado === 'reerguido' ? capacidadeDoAlojamento(e.qg.nivel) : 0);

/**
 * Quem atravessa a ascensão: os mais fortes (poder, depois nível e id), até a capacidade do Alojamento.
 * Fora dela ficam os demais, que saem da guilda. A escolha manual é do Portão 25.
 */
export function ordemDeAtravessar<T extends { id: string; nivel: number; arma: number; armadura: number }>(aventureiros: readonly T[]): T[] {
  return [...aventureiros].sort((a, b) => poderDe(b) - poderDe(a) || b.nivel - a.nivel || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
const poderDe = (a: { nivel: number; arma: number; armadura: number }) => poderAventureiro(a);

export function vagasGuilda(e: VisaoCliente): number {
  const g = F.guilda;
  const hospitalidade = e.pesquisas.concluidas.includes('hospitalidade')
    ? g.vagasHospitalidadePorTaverna * quantasConstruidas(e, 'taverna')
    : 0;
  return g.vagasBase + g.vagasPorNivelDeTaverna * somaNiveis(e, 'taverna') + hospitalidade;
}

/** Quantos aldeões têm o ofício (contando os que estão a caminho dele). */
export function quantosNoOficio(e: Pick<VisaoCliente, 'aldeoes'>, oficio: OficioAldeao): number {
  let n = 0;
  for (const a of e.aldeoes) if (a.oficio === oficio) n += 1;
  return n;
}

/** Pesos da distribuição automática: os da política pronta ou, em "manter", a proporção do último ajuste manual. */
export function pesosDaDistribuicao(e: Pick<VisaoCliente, 'aldeoesConfig'>): Record<Oficio, number> {
  const c = e.aldeoesConfig;
  if (c.politica !== 'manter') return PESOS_POLITICA[c.politica];
  const pesos = {} as Record<Oficio, number>;
  for (const o of RODIZIO_OFICIOS) pesos[o] = c.proporcao?.[o] ?? 0;
  // Proporção toda zerada (todos foram para Ocioso): cai na Equilibrada.
  return RODIZIO_OFICIOS.some((o) => pesos[o] > 0) ? pesos : PESOS_POLITICA.equilibrada;
}

/**
 * Saldo de comida por segundo (milésimos) se mais um aldeão chegasse, contando
 * como já produzindo quem está a caminho para Fazendeiro.
 */
export function saldoComidaComMaisUm(e: VisaoCliente): number {
  const v = { ...e, aldeoes: e.aldeoes.map((a) => (a.oficio === 'fazendeiro' ? { oficio: a.oficio } : a)) };
  return calcularTaxas(v).saldo.comida - mili(F.consumo.comidaPorAldeao);
}

/** Quem chega precisa ser Fazendeiro: comida em 0 ou abaixo do mínimo, ou o saldo ficaria negativo com ele. */
export function chegaComoFazendeiro(e: VisaoCliente): boolean {
  return e.recursos.comida < micro(COMIDA_MINIMA_ALDEAO) || saldoComidaComMaisUm(e) < 0;
}

/**
 * Ofício de quem chega. Pouca comida ou saldo que ficaria negativo: Fazendeiro,
 * sempre (inclusive com a automática desligada). Automática desligada: Ocioso.
 * Ligada: o ofício mais abaixo da sua parte pela política, ou seja, o menor
 * quantidade / peso (em inteiros: q_i × p_j < q_j × p_i), desempate pela ordem
 * dos ofícios. Pesos iguais reproduzem o rodízio antigo numa conta nova.
 */
export function oficioDoProximoAldeao(e: VisaoCliente): OficioAldeao {
  if (chegaComoFazendeiro(e)) return 'fazendeiro';
  if (!e.aldeoesConfig.automatica) return OFICIO_OCIOSO;
  const pesos = pesosDaDistribuicao(e);
  let melhor: Oficio | null = null;
  for (const o of RODIZIO_OFICIOS) {
    if (pesos[o] <= 0) continue;
    if (melhor === null || quantosNoOficio(e, o) * pesos[melhor] < quantosNoOficio(e, melhor) * pesos[o]) melhor = o;
  }
  return melhor ?? 'fazendeiro';
}

/** Aldeão que produz agora: tem ofício produtivo e já chegou nele (fora do deslocamento). */
export function aldeaoAtivo(a: { oficio: OficioAldeao; ativoEm?: number }, t: number): boolean {
  return a.oficio !== OFICIO_OCIOSO && (a.ativoEm === undefined || a.ativoEm <= t);
}

/** Quantos produzem no ofício agora (sem os que ainda estão a caminho). */
function contarOficio(e: VisaoCliente, oficio: Oficio): number {
  let n = 0;
  for (const a of e.aldeoes) if (a.oficio === oficio && aldeaoAtivo(a, e.t)) n += 1;
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
    mili(F.consumo.comidaPorAldeao) * e.aldeoes.length + consumoComidaAventureiros(e.aventureiros.length);

  const saldo = { ...producao };
  saldo.comida -= consumoComida;
  return { producao, consumoComida, saldo };
}

export function destinoAberto(e: Pick<EstadoJogo, 'pesquisas' | 'qg' | 'expedicoes'>, destino: DestinoId): boolean {
  // Ruínas do Quartel General: só com o QG oculto e sem outro grupo já a caminho (a descoberta acontece uma vez).
  if (destino === DESTINO_QG) return e.qg.estado === 'oculto' && !e.expedicoes.some((x) => x.destino === DESTINO_QG);
  const req = DESTINOS[destino].requer;
  return req === null || e.pesquisas.concluidas.includes(req);
}

/**
 * O destino aparece na lista e no mapa? O das Ruínas do QG some depois de descoberto (entra o objeto das Ruínas);
 * enquanto um grupo está a caminho ele continua à vista.
 */
export function destinoVisivel(e: Pick<EstadoJogo, 'qg'>, destino: DestinoId): boolean {
  return destino !== DESTINO_QG || e.qg.estado === 'oculto';
}

/** O QG foi reerguido: a tela da Tropa e a Mesa de Guerra (Portão 22) só abrem com isto. */
export const qgReerguido = (e: Pick<EstadoJogo, 'qg'>): boolean => e.qg.estado === 'reerguido';

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
