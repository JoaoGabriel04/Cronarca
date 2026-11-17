// Próximo passo (Portão 16): o que fazer agora para cumprir os objetivos da
// Era I (Carta Real, Cripta, 40 aldeões). Função pura e inteira, sem relógio
// próprio (usa e.t), sobre a visão do cliente: o cliente mostra e o servidor
// testa a mesma regra. Custos, tetos e chances vêm dos dados e das fórmulas,
// já com a Falha; nada escrito à mão.

import { CONSTRUCOES, type TipoConstrucao } from '../data/construcoes.ts';
import { OBJETIVOS_ERA_1 } from '../data/eras.ts';
import { DESTINOS, TAMANHO_MAXIMO_GRUPO } from '../data/expedicoes.ts';
import { SABIO } from '../data/lore.ts';
import { QG, TEXTOS_QG } from '../data/qg.ts';
import { PESQUISAS, type PesquisaId } from '../data/pesquisas.ts';
import { NOMES_RECURSOS, RECURSOS, type Recurso } from '../data/recursos.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import { formatarInteiro } from './cronica.ts';
import type { VisaoCliente } from './estado.ts';
import { chanceExitoBp, custoConstrucao, custoContratar, custoPesquisa, perigoDestino, poderAventureiro, type Custo } from './formulas.ts';
import { aldeoesMaximos, aventureirosNaTaverna, calcularTaxas, objetivosEra, somaNiveis, tetos, vagasGuilda } from './regras.ts';

export type TrilhaId = 'carta_real' | 'cripta' | 'aldeoes';

export interface PassoTrilha {
  trilha: TrilhaId;
  /** "Carta Real", "Cripta do Rei Cinzento", "40 aldeões". */
  titulo: string;
  cumprida: boolean;
  /** Frase de ação curta ("Construa a Pedreira"); "Cumprido" quando cumprida. */
  passo: string;
  /** Por que ainda não dá (bloqueio ou espera), ou null. */
  motivo: string | null;
  /** Dá para fazer agora (o jogador tem o que precisa). */
  pronto: boolean;
}

export interface ProximoPasso {
  /** Uma única frase de ação, nunca vazia. */
  principal: string;
  trilhas: PassoTrilha[];
  /** Os três objetivos cumpridos. */
  ascender: boolean;
  /** Dica do Sábio para o painel ("O Sábio diz: ..."), ou null. */
  sabio: string | null;
}

/** Chance mínima (pontos-base) para o passo da Cripta ser "envie" e não "fortaleça a guilda". */
export const CHANCE_MINIMA_CRIPTA_BP = 5_000;
/** A cadeia da Carta Real, na ordem. */
const CADEIA_CARTA: readonly PesquisaId[] = ['cartografia', 'estradas_reais', 'carta_real'];

const unidades = (micro: number) => formatarInteiro(Math.floor(micro / 1_000_000) * 1_000_000);
const nomeRecurso = (r: Recurso) => NOMES_RECURSOS[r].toLowerCase();
const comArtigo = (tipo: TipoConstrucao) => `${['casa', 'forja', 'muralha', 'pedreira', 'serraria', 'taverna'].includes(tipo) ? 'a' : 'o'} ${CONSTRUCOES[tipo].nome}`;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Primeiro recurso que falta para o custo (na ordem dos recursos), ou null. */
function faltando(e: VisaoCliente, custo: Custo): Recurso | null {
  return RECURSOS.find((r) => (custo[r] ?? 0) > e.recursos[r]) ?? null;
}

const slotDoTipo = (tipo: TipoConstrucao): SlotId => SLOT_IDS.find((id) => SLOTS[id].tipo === tipo)!;

/** Melhor grupo para uma expedição: os mais fortes que estão na vila, até o tamanho máximo. */
export function melhorGrupo(e: VisaoCliente): string[] {
  return e.aventureiros
    .filter((a) => a.estado === 'na_vila')
    .sort((a, b) => poderAventureiro(b) - poderAventureiro(a) || a.id.localeCompare(b.id))
    .slice(0, TAMANHO_MAXIMO_GRUPO)
    .map((a) => a.id);
}

/** Passo de uma construção (construir o primeiro slot do tipo): obra, recurso que falta ou "Construa". */
function passoConstruir(e: VisaoCliente, tipo: TipoConstrucao, para: string | null): Omit<PassoTrilha, 'trilha' | 'titulo' | 'cumprida'> {
  const slot = e.slots[slotDoTipo(tipo)];
  if (slot.obraAte !== null) return { passo: `Aguarde a obra: ${CONSTRUCOES[tipo].nome}`, motivo: `termina em ${mmss(slot.obraAte - e.t)}`, pronto: false };
  const custo = custoConstrucao(tipo, 1);
  const falta = faltando(e, custo);
  if (falta) {
    return { passo: `Construa ${comArtigo(tipo)}: ${nomeRecurso(falta)} ${unidades(e.recursos[falta])} de ${unidades(custo[falta]!)}`, motivo: para, pronto: false };
  }
  return { passo: `Construa ${comArtigo(tipo)}`, motivo: para, pronto: true };
}

function trilhaCartaReal(e: VisaoCliente): PassoTrilha {
  const base = { trilha: 'carta_real' as const, titulo: PESQUISAS.carta_real.nome };
  if (e.pesquisas.concluidas.includes('carta_real')) return { ...base, cumprida: true, passo: 'Cumprido', motivo: null, pronto: false };
  // Sem Scriptorium não há saber. A pedra inicial não chega para ele: sem pedra e sem Pedreira, a Pedreira vem antes.
  if (somaNiveis(e, 'scriptorium') === 0) {
    const custo = custoConstrucao('scriptorium', 1);
    const semPedra = (custo.pedra ?? 0) > e.recursos.pedra;
    const precisaPedreira = semPedra && somaNiveis(e, 'pedreira') === 0;
    if (precisaPedreira) return { ...base, cumprida: false, ...passoConstruir(e, 'pedreira', 'falta pedra para o Scriptorium') };
    return { ...base, cumprida: false, ...passoConstruir(e, 'scriptorium', 'sem estantes não há saber') };
  }
  const id = CADEIA_CARTA.find((p) => !e.pesquisas.concluidas.includes(p))!;
  const nome = PESQUISAS[id].nome;
  const atual = e.pesquisas.atual;
  if (atual) {
    const outra = atual.id !== id ? ` (agora: ${PESQUISAS[atual.id].nome})` : '';
    return { ...base, cumprida: false, passo: `Aguarde a pesquisa: ${PESQUISAS[atual.id].nome}`, motivo: `termina em ${mmss(atual.fim - e.t)}${outra ? `; depois, ${nome}` : ''}`, pronto: false };
  }
  const custo = custoPesquisa(id, e.falha);
  const teto = tetos(e);
  const acima = RECURSOS.find((r) => (custo[r] ?? 0) > teto[r]);
  if (acima) {
    return { ...base, cumprida: false, passo: `Amplie o Armazém para ${nome}`, motivo: `pede ${unidades(custo[acima]!)} de ${nomeRecurso(acima)}; o Armazém guarda ${unidades(teto[acima])}`, pronto: false };
  }
  const falta = faltando(e, custo);
  if (falta) {
    const semFonteDeOuro = falta === 'ouro' && somaNiveis(e, 'mercado') === 0;
    return {
      ...base, cumprida: false,
      passo: `Pesquise ${nome}: ${nomeRecurso(falta)} ${unidades(e.recursos[falta])} de ${unidades(custo[falta]!)}`,
      motivo: semFonteDeOuro ? 'falta ouro: construa o Mercado ou explore as Ruínas' : null,
      pronto: false,
    };
  }
  return { ...base, cumprida: false, passo: `Pesquise ${nome}`, motivo: null, pronto: true };
}

function trilhaCripta(e: VisaoCliente): PassoTrilha {
  const nomeCripta = DESTINOS.cripta.nome;
  const base = { trilha: 'cripta' as const, titulo: nomeCripta };
  if (e.objetivos.criptaVencida) return { ...base, cumprida: true, passo: 'Cumprido', motivo: null, pronto: false };
  const requer = DESTINOS.cripta.requer;
  if (requer && !e.pesquisas.concluidas.includes(requer)) {
    return { ...base, cumprida: false, passo: `Treine a guilda: ${DESTINOS.floresta_lobos.nome}`, motivo: `falta a pesquisa ${PESQUISAS[requer].nome}`, pronto: false };
  }
  const indo = e.expedicoes.find((x) => x.destino === 'cripta');
  if (indo) return { ...base, cumprida: false, passo: 'Aguarde o grupo na Cripta', motivo: `volta em ${mmss(indo.fim - e.t)}`, pronto: false };
  const grupo = melhorGrupo(e);
  if (grupo.length === 0) return { ...base, cumprida: false, passo: 'Reúna a guilda', motivo: 'ninguém na vila (feridos ou em expedição)', pronto: false };
  const poder = grupo.reduce((s, id) => s + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0);
  const perigo = perigoDestino('cripta', e.falha);
  const chance = chanceExitoBp(poder, perigo);
  const pct = `${Math.round(chance / 100)}%`;
  if (e.recursos.comida <= 0) return { ...base, cumprida: false, passo: `Envie um grupo à Cripta (perigo ${perigo})`, motivo: 'sem comida: expedições não partem', pronto: false };
  if (chance >= CHANCE_MINIMA_CRIPTA_BP) return { ...base, cumprida: false, passo: `Envie um grupo à Cripta (perigo ${perigo})`, motivo: `chance de ${pct}`, pronto: true };
  // Fraca demais: contratar (se há vaga e ouro), equipar na Forja ou treinar em destinos mais fáceis.
  const podeContratar = aventureirosNaTaverna(e) < vagasGuilda(e) && faltando(e, custoContratar(e.contratacoes)) === null;
  const motivo = podeContratar ? 'contrate mais aventureiros' : somaNiveis(e, 'forja') > 0 ? 'melhore armas e armaduras ou treine em destinos mais fáceis' : 'treine em destinos mais fáceis e construa a Forja';
  return { ...base, cumprida: false, passo: `Fortaleça a guilda: ${pct} na Cripta`, motivo, pronto: false };
}

function trilhaAldeoes(e: VisaoCliente): PassoTrilha {
  const meta = OBJETIVOS_ERA_1.aldeoesMinimos;
  const base = { trilha: 'aldeoes' as const, titulo: `${meta} aldeões` };
  const n = e.aldeoes.length;
  if (n >= meta) return { ...base, cumprida: true, passo: 'Cumprido', motivo: null, pronto: false };
  if (n >= aldeoesMaximos(e)) {
    const casa = e.slots[slotDoTipo('casa')];
    if (casa.obraAte !== null) return { ...base, cumprida: false, passo: 'Aguarde a obra: Casa', motivo: `Casas cheias; termina em ${mmss(casa.obraAte - e.t)}`, pronto: false };
    const custo = custoConstrucao('casa', casa.nivel + 1);
    const falta = faltando(e, custo);
    return {
      ...base, cumprida: false,
      passo: `Melhore a Casa: ${n} de ${aldeoesMaximos(e)} vagas`,
      motivo: falta ? `Casas cheias; falta ${nomeRecurso(falta)} (${unidades(e.recursos[falta])} de ${unidades(custo[falta]!)})` : 'Casas cheias',
      pronto: falta === null,
    };
  }
  return { ...base, cumprida: false, passo: `Reúna aldeões: ${n} de ${meta}`, motivo: e.recursos.comida <= 0 ? 'sem comida' : null, pronto: false };
}

/** Dica do Sábio: o conflito do ouro (contratar x Estradas Reais) ou o motivo do passo principal. */
function dicaDoSabio(e: VisaoCliente, principal: PassoTrilha | null): string | null {
  const caminho: PesquisaId = 'estradas_reais';
  const cartografiaFeita = e.pesquisas.concluidas.includes('cartografia') || e.pesquisas.atual?.id === 'cartografia';
  const ouro = custoPesquisa(caminho, e.falha).ouro ?? 0;
  const podeGastarOuro = aventureirosNaTaverna(e) < vagasGuilda(e);
  if (cartografiaFeita && !e.pesquisas.concluidas.includes(caminho) && e.recursos.ouro < ouro && podeGastarOuro) {
    return `${SABIO.prefixo} ${SABIO.guardeOuro(unidades(ouro), PESQUISAS[caminho].nome)}`;
  }
  // Quartel General (Portão 21): se o jogador demorar a explorar (QG oculto há QG.dicaDoSabioAposMs), o Sábio aponta o norte.
  // Vem antes do aviso de "falta X" (que quase sempre existe no começo e taparia a dica) e depois do conflito do ouro.
  if (e.qg.estado === 'oculto' && e.t - e.qg.desde >= QG.dicaDoSabioAposMs) {
    const dica = TEXTOS_QG.dicaDoSabio;
    return `${SABIO.prefixo} ${dica.charAt(0).toLowerCase()}${dica.slice(1)}`;
  }
  // Esperas (obra, pesquisa, grupo a caminho) e a chance não são conselho: o Sábio só fala de bloqueios.
  const motivo = principal?.motivo;
  if (motivo && !/^(termina|volta|chance)/.test(motivo)) return `${SABIO.prefixo} ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}.`;
  return null;
}

/**
 * O próximo passo da Era I. Prioridade: fome; a Carta Real quando dá para
 * agir; as Casas quando estão cheias e a melhoria cabe; a Cripta quando dá
 * para enviar; senão o primeiro objetivo não cumprido (Carta Real, Cripta,
 * aldeões). Tudo cumprido: ascender.
 */
export function proximoPasso(e: VisaoCliente): ProximoPasso {
  const trilhas = [trilhaCartaReal(e), trilhaCripta(e), trilhaAldeoes(e)];
  const [carta, cripta, aldeoes] = trilhas as [PassoTrilha, PassoTrilha, PassoTrilha];
  if (objetivosEra(e).todos) {
    return { principal: 'Ascenda: os três objetivos estão cumpridos', trilhas, ascender: true, sabio: `${SABIO.prefixo} o Relógio espera.` };
  }
  // Fome: comida em 0 e sem subir. Ação possível sempre: mudar aldeões para Fazendeiro.
  if (e.recursos.comida <= 0 && calcularTaxas(e).saldo.comida <= 0) {
    return { principal: 'Sem comida: mude aldeões para Fazendeiro', trilhas, ascender: false, sabio: `${SABIO.prefixo} sem comida, os ofícios param e ninguém parte em expedição.` };
  }
  const escolhido =
    (carta.pronto && carta) || (aldeoes.pronto && aldeoes) || (cripta.pronto && cripta) || trilhas.find((t) => !t.cumprida)!;
  return { principal: escolhido.passo, trilhas, ascender: false, sabio: dicaDoSabio(e, escolhido) };
}
