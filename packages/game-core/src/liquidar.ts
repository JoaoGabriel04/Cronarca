// Liquidação preguiçosa: avança o estado até um instante, aplicando em ordem
// tudo o que aconteceu no meio. Entre dois acontecimentos as taxas são
// constantes, então cada trecho é linear e calculado em inteiros exatos.
// Por isso liquidar em um passo ou em muitos dá exatamente o mesmo estado.
import { NOME_OCIOSO, OFICIO_OCIOSO } from '../data/aldeoes.ts';
import { NOMES_OFICIOS } from '../data/aventureiros.ts';
import { CONSTRUCOES } from '../data/construcoes.ts';
import { DESTINOS } from '../data/expedicoes.ts';
import { EVENTO_PARAMETROS, EVENTOS_IDS, NOMES_EVENTOS, type EventoId } from '../data/eventos.ts';
import { FORMULAS } from '../data/formulas.ts';
import { PESQUISAS } from '../data/pesquisas.ts';
import { NOMES_RECURSOS, RECURSOS, type Recurso } from '../data/recursos.ts';
import { SLOT_IDS, SLOTS } from '../data/slots.ts';
import { formatarInteiro, registrar } from './cronica.ts';
import type { EstadoJogo, Expedicao } from './estado.ts';
import { xpParaSubir } from './formulas.ts';
import { abrirMercador } from './mercador.ts';
import { sortearIntervaloEventoMs } from './inicial.ts';
import { bp, divTeto, fracaoBp, micro } from './inteiros.ts';
import { aldeoesMaximos, calcularTaxas, oficioDoProximoAldeao, somaNiveis, tetos } from './regras.ts';
import { criarSorteador, type Sorteador } from './rng.ts';

const MS_POR_ALDEAO = FORMULAS.aldeoes.segundosPorChegada * 1000;

/** Soma ganhos (≥ 0) cortando no teto; devolve o que de fato entrou. */
export function receber(e: EstadoJogo, ganhos: Partial<Record<Recurso, number>>): Partial<Record<Recurso, number>> {
  const teto = tetos(e);
  const entrou: Partial<Record<Recurso, number>> = {};
  for (const [r, v] of Object.entries(ganhos) as [Recurso, number][]) {
    const novo = Math.min(teto[r], e.recursos[r] + v);
    entrou[r] = novo - e.recursos[r];
    e.recursos[r] = novo;
  }
  return entrou;
}

/**
 * Chega aldeão sempre que houver vaga nas Casas. Com a comida em 0 ele chega
 * como Fazendeiro (oficioDoProximoAldeao): a vila não fica presa sem comida,
 * porque melhorar a Casa sempre traz quem produz.
 */
function podeChegarAldeao(e: EstadoJogo): boolean {
  return e.aldeoes.length < aldeoesMaximos(e);
}

/** Ganho de um evento, em micro: o maior entre o fixo e a fração do teto atual do recurso. */
export function ganhoDeEvento(e: EstadoJogo, recurso: Recurso, fixo: number, fracaoDoTeto: number): number {
  return Math.max(micro(fixo), fracaoBp(tetos(e)[recurso], bp(fracaoDoTeto)));
}

function descreverGanhos(ganhos: Partial<Record<Recurso, number>>): string {
  // Arredonda para a Crônica; o que some no arredondamento (menos de meia unidade) não entra na frase.
  const partes = RECURSOS.filter((r) => formatarInteiro(ganhos[r] ?? 0) !== '0').map(
    (r) => `${formatarInteiro(ganhos[r]!)} ${NOMES_RECURSOS[r].toLowerCase()}`,
  );
  return partes.length > 0 ? partes.join(', ') : 'nada (armazém cheio)';
}

function resolverExpedicao(e: EstadoJogo, exp: Expedicao) {
  const resultado = e.segredo.resultados[exp.id] ?? { vitoria: false, saque: {}, feridos: [] };
  delete e.segredo.resultados[exp.id];
  e.expedicoes = e.expedicoes.filter((x) => x.id !== exp.id);
  const destino = DESTINOS[exp.destino];
  const A = FORMULAS.aventureiro;

  for (const id of exp.grupo) {
    const av = e.aventureiros.find((a) => a.id === id);
    if (!av) continue;
    av.xp += resultado.vitoria ? A.xpVitoria : A.xpRecuo;
    while (av.nivel < A.nivelMaximo && av.xp >= xpParaSubir(av.nivel)) {
      av.xp -= xpParaSubir(av.nivel);
      av.nivel += 1;
    }
    if (av.nivel >= A.nivelMaximo) av.xp = 0;
    if (resultado.feridos.includes(id)) {
      av.estado = 'ferido';
      av.feridoAte = exp.fim + A.segundosFerido * 1000;
    } else {
      av.estado = 'na_vila';
      av.feridoAte = null;
    }
  }

  const nomes = (ids: readonly string[]) => ids.map((id) => e.aventureiros.find((a) => a.id === id)?.nome ?? id);
  const relatar = (saque: Partial<Record<Recurso, number>>) => {
    e.relatorios.push({ destino: exp.destino, grupo: nomes(exp.grupo), vitoria: resultado.vitoria, saque, feridos: nomes(resultado.feridos), em: exp.fim });
    const excesso = e.relatorios.length - FORMULAS.relatorios.maximo;
    if (excesso > 0) e.relatorios.splice(0, excesso);
  };
  if (resultado.vitoria) {
    const entrou = receber(e, resultado.saque);
    relatar(entrou);
    if (exp.destino === 'cripta') e.objetivos.criptaVencida = true;
    registrar(e, 'Expedicao', `Vitória em ${destino.nome}: ${descreverGanhos(entrou)}.`, exp.fim);
  } else {
    relatar({});
    const feridos = resultado.feridos.length;
    const extra = feridos === 0 ? '' : feridos === 1 ? ' Um aventureiro voltou ferido.' : ` ${feridos} aventureiros voltaram feridos.`;
    registrar(e, 'Alerta', `O grupo recuou de ${destino.nome}, sem saque.${extra}`, exp.fim);
  }
}

/** Aplica o efeito de um evento já sorteado. Exportado para os testes. */
export function aplicarEvento(e: EstadoJogo, id: EventoId, t: number) {
  const P = EVENTO_PARAMETROS;
  const nome = NOMES_EVENTOS[id];
  switch (id) {
    case 'mercador_viajante':
      abrirMercador(e, t);
      break;
    case 'bandidos':
      if (somaNiveis(e, 'muralha') >= P.bandidos.muralhaMinima) {
        registrar(e, 'Evento', `${nome}: a Muralha repeliu o ataque.`, t);
      } else {
        const ouro = fracaoBp(e.recursos.ouro, bp(P.bandidos.perdaOuro));
        const comida = fracaoBp(e.recursos.comida, bp(P.bandidos.perdaComida));
        e.recursos.ouro -= ouro;
        e.recursos.comida -= comida;
        registrar(e, 'Alerta', `${nome}: levaram ${formatarInteiro(ouro)} ouro e ${formatarInteiro(comida)} comida.`, t);
      }
      break;
    case 'tempestade':
      registrar(e, 'Evento', `${nome}: ${descreverGanhos(receber(e, { madeira: ganhoDeEvento(e, 'madeira', P.tempestade.madeira, P.tempestade.fracaoDoTeto) }))}.`, t);
      break;
    case 'festival_colheita':
      registrar(e, 'Evento', `${nome}: ${descreverGanhos(receber(e, { comida: ganhoDeEvento(e, 'comida', P.festival_colheita.comida, P.festival_colheita.fracaoDoTeto) }))}.`, t);
      break;
    case 'incendio': {
      const perda = fracaoBp(e.recursos.madeira, bp(P.incendio.perdaMadeira));
      e.recursos.madeira -= perda;
      registrar(e, 'Alerta', `${nome}: queimaram ${formatarInteiro(perda)} madeira.`, t);
      break;
    }
    case 'cometa':
      registrar(e, 'Evento', `${nome}: ${descreverGanhos(receber(e, { saber: ganhoDeEvento(e, 'saber', P.cometa.saber, P.cometa.fracaoDoTeto) }))}.`, t);
      break;
  }
}

/** Aplica, numa ordem fixa, tudo o que vence até o instante t. */
function processarVencimentos(e: EstadoJogo, s: Sorteador) {
  const t = e.t;
  for (const id of SLOT_IDS) {
    const slot = e.slots[id];
    if (slot.obraAte !== null && slot.obraAte <= t) {
      slot.nivel += 1;
      slot.obraAte = null;
      const nome = CONSTRUCOES[SLOTS[id].tipo].nome;
      registrar(e, 'Construir', slot.nivel === 1 ? `${nome} construída.` : `${nome} chegou ao nível ${slot.nivel}.`, t);
    }
  }

  const pesquisa = e.pesquisas.atual;
  if (pesquisa && pesquisa.fim <= t) {
    e.pesquisas.concluidas.push(pesquisa.id);
    e.pesquisas.atual = null;
    registrar(e, 'Saber', `Pesquisa concluída: ${PESQUISAS[pesquisa.id].nome}.`, t);
  }

  const vencidas = e.expedicoes.filter((x) => x.fim <= t).sort((a, b) => a.fim - b.fim || a.id.localeCompare(b.id));
  for (const exp of vencidas) resolverExpedicao(e, exp);

  for (const av of e.aventureiros) {
    if (av.estado === 'ferido' && av.feridoAte !== null && av.feridoAte <= t) {
      av.estado = 'na_vila';
      av.feridoAte = null;
    }
  }

  if (e.mercador && e.mercador.expiraEm <= t) {
    e.mercador = null;
    registrar(e, 'Evento', 'O Mercador Viajante seguiu viagem.', t);
  }

  while (e.segredo.proximoEventoEm <= t) {
    aplicarEvento(e, s.escolher(EVENTOS_IDS), e.segredo.proximoEventoEm);
    e.segredo.proximoEventoEm += sortearIntervaloEventoMs(s);
  }

  if (e.progressoAldeaoMs >= MS_POR_ALDEAO && podeChegarAldeao(e)) {
    const oficio = oficioDoProximoAldeao(e);
    e.aldeoes.push({ oficio });
    e.progressoAldeaoMs = 0;
    const nome = oficio === OFICIO_OCIOSO ? NOME_OCIOSO : NOMES_OFICIOS[oficio];
    registrar(e, 'Aldeao', `Um ${nome.toLowerCase()} chegou à vila.`, t);
  }

  // Quem terminou o deslocamento passa a produzir no ofício novo.
  for (const a of e.aldeoes) if (a.ativoEm !== undefined && a.ativoEm <= t) delete a.ativoEm;
}

/** Próximo instante em que algo muda (ou `alvo`, se nada mudar antes). */
function proximoAcontecimento(e: EstadoJogo, alvo: number, saldoComida: number): number {
  let prox = alvo;
  const considerar = (instante: number) => {
    if (instante > e.t && instante < prox) prox = instante;
  };
  for (const id of SLOT_IDS) {
    const fim = e.slots[id].obraAte;
    if (fim !== null) considerar(fim);
  }
  if (e.pesquisas.atual) considerar(e.pesquisas.atual.fim);
  for (const x of e.expedicoes) considerar(x.fim);
  for (const a of e.aventureiros) if (a.feridoAte !== null) considerar(a.feridoAte);
  if (e.mercador) considerar(e.mercador.expiraEm);
  for (const a of e.aldeoes) if (a.ativoEm !== undefined) considerar(a.ativoEm);
  considerar(e.segredo.proximoEventoEm);
  if (podeChegarAldeao(e) && e.progressoAldeaoMs < MS_POR_ALDEAO) {
    considerar(e.t + (MS_POR_ALDEAO - e.progressoAldeaoMs));
  }
  const comida = e.recursos.comida;
  if (comida > 0 && saldoComida < 0) considerar(e.t + divTeto(comida, -saldoComida));
  // Comida saindo do zero religa os bônus de ofício e o rodízio de ofícios.
  if (comida === 0 && saldoComida > 0) considerar(e.t + 1);
  return prox;
}

/** Avança um trecho linear de `dt` ms com as taxas atuais. */
function avancarTrecho(e: EstadoJogo, dt: number, saldo: Record<Recurso, number>) {
  const teto = tetos(e);
  const chegando = podeChegarAldeao(e);
  for (const r of RECURSOS) {
    // Produção que passaria do teto é descartada. Nada fica acima do teto:
    // tudo que entra é cortado nele, e o teto só cresce.
    e.recursos[r] = Math.min(teto[r], Math.max(0, e.recursos[r] + saldo[r] * dt));
  }
  if (chegando) e.progressoAldeaoMs = Math.min(MS_POR_ALDEAO, e.progressoAldeaoMs + dt);
  e.t += dt;
}

/**
 * Liquida o estado até `alvo` (ms). Não altera o estado recebido. Se `alvo`
 * for anterior ao instante já liquidado, nada muda (o relógio não volta).
 */
export function liquidar(estado: EstadoJogo, alvo: number): EstadoJogo {
  const e = structuredClone(estado);
  const s = criarSorteador(e.segredo.rng);
  processarVencimentos(e, s);
  while (e.t < alvo) {
    const { saldo } = calcularTaxas(e);
    const prox = proximoAcontecimento(e, alvo, saldo.comida);
    avancarTrecho(e, prox - e.t, saldo);
    processarVencimentos(e, s);
  }
  e.segredo.rng = s.estado;
  return e;
}
