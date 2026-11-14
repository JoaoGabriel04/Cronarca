// Dados das telas Heróis, Expedições e Eras (Portão 12). Tudo vem do estado e
// das regras do game-core; nada de número fixo aqui. Funções puras.

import {
  chanceExitoBp, custoContratar, custoEquipamento, custoReliquia, DESTINOS, DESTINOS_IDS, destinoAberto, duracaoExpedicaoMs,
  ERAS, FORMULAS, MICRO, NIVEL_MAXIMO_CONSTRUCAO, NOMES_CLASSES, nivelReliquia, objetivosEra, OBJETIVOS_ERA_1, PESQUISAS,
  poderAventureiro, RELIQUIAS, RELIQUIAS_IDS, SLOT_IDS, SLOTS, TAMANHO_MAXIMO_GRUPO, vagasGuilda,
  type Classe, type DestinoId, type Recurso, type RefSprite, type ReliquiaId, type VisaoCliente,
} from '@cronarca/game-core';
import { formatarHora, formatarInteiro, formatarRestante, formatarTaxa, textoEra } from './dados';

type Custo = Partial<Record<Recurso, number>>;
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const podePagar = (e: VisaoCliente, custo: Custo) => (Object.entries(custo) as [Recurso, number][]).every(([r, v]) => e.recursos[r] >= v);
export const custoNaTela = (custo: Custo) => (Object.entries(custo) as [Recurso, number][]).map(([recurso, v]) => ({ recurso, valor: formatarInteiro(v) }));

/** "Aldric", "Aldric e Dara", "Aldric, Dara e Elisa". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

// ---------- Heróis ----------

export type EstadoHeroi = { tipo: 'na_vila' | 'em_expedicao' | 'ferido'; texto: string };

export interface Peca {
  nivel: number;
  maximo: number;
  custo: { recurso: Recurso; valor: string }[];
  /** Pode melhorar agora (no máximo, em expedição ou sem recursos: não). */
  pode: boolean;
  motivo: string | null;
}

export interface CartaHeroi {
  id: string;
  nome: string;
  classe: Classe;
  linha: string;
  poder: number;
  estado: EstadoHeroi;
  arma: Peca;
  armadura: Peca;
}

function estadoDoHeroi(a: VisaoCliente['aventureiros'][number], agora: number): EstadoHeroi {
  if (a.estado === 'em_expedicao') return { tipo: 'em_expedicao', texto: 'Em expedição' };
  if (a.estado === 'ferido') return { tipo: 'ferido', texto: `Ferido ${formatarRestante((a.feridoAte ?? agora) - agora)}` };
  return { tipo: 'na_vila', texto: 'Na vila' };
}

function pecaDe(e: VisaoCliente, a: VisaoCliente['aventureiros'][number], peca: 'arma' | 'armadura'): Peca {
  const maximo = FORMULAS.aventureiro.equipamentoMaximo;
  const nivel = a[peca];
  if (nivel >= maximo) return { nivel, maximo, custo: [], pode: false, motivo: 'Nível máximo' };
  const custo = custoEquipamento(peca, nivel);
  const ocupado = a.estado === 'em_expedicao';
  const pagavel = podePagar(e, custo);
  return { nivel, maximo, custo: custoNaTela(custo), pode: !ocupado && pagavel, motivo: ocupado ? 'Em expedição' : pagavel ? null : 'Recursos insuficientes' };
}

export function cartasHerois(e: VisaoCliente, agora: number): CartaHeroi[] {
  return e.aventureiros.map((a) => ({
    id: a.id,
    nome: a.nome,
    classe: a.classe,
    linha: `${NOMES_CLASSES[a.classe]} · nível ${a.nivel}`,
    poder: poderAventureiro(a),
    estado: estadoDoHeroi(a, agora),
    arma: pecaDe(e, a, 'arma'),
    armadura: pecaDe(e, a, 'armadura'),
  }));
}

export interface Guilda {
  vagas: string;
  subtitulo: string;
  contratar: { custo: { recurso: Recurso; valor: string }[]; pode: boolean; motivo: string | null };
  resumo: { poderTotal: number; vagas: string; consumo: string; proximaVaga: string; cabecalho: string };
}

export function guilda(e: VisaoCliente): Guilda {
  const vagas = vagasGuilda(e);
  const n = e.aventureiros.length;
  const custo = custoContratar(e.contratacoes);
  const cheia = n >= vagas;
  const pagavel = podePagar(e, custo);
  const consumo = Math.round(FORMULAS.consumo.comidaPorAventureiro * 1000) * n;
  const taverna = SLOT_IDS.filter((id) => SLOTS[id].tipo === 'taverna');
  const nivelTaverna = Math.max(0, ...taverna.map((id) => e.slots[id].nivel));
  const proximaVaga =
    nivelTaverna === 0 ? 'Construir a Taverna' : nivelTaverna >= NIVEL_MAXIMO_CONSTRUCAO ? 'Taverna no nível máximo' : `Taverna nível ${nivelTaverna + 1}`;
  return {
    vagas: `${n} / ${vagas}`,
    subtitulo: `${n} / ${vagas} vagas · consomem comida`,
    contratar: { custo: custoNaTela(custo), pode: !cheia && pagavel, motivo: cheia ? 'Guilda cheia' : pagavel ? null : 'Recursos insuficientes' },
    resumo: {
      poderTotal: e.aventureiros.reduce((s, a) => s + poderAventureiro(a), 0),
      vagas: `${n} de ${vagas}`,
      consumo: formatarTaxa(-consumo),
      proximaVaga,
      cabecalho: `${textoEra(e.era).split(' · ')[0]} · Ciclo ${e.ciclo}`,
    },
  };
}

// ---------- Expedições ----------

export interface ChipGrupo {
  id: string;
  nome: string;
  classe: Classe;
  linha: string;
  selecionado: boolean;
  disponivel: boolean;
  motivo: string | null;
}

/** Só quem está na vila entra no grupo; o grupo vale só com ids que ainda podem ir. */
export function grupoValido(e: VisaoCliente, selecionados: readonly string[]): string[] {
  return selecionados.filter((id) => e.aventureiros.find((a) => a.id === id)?.estado === 'na_vila').slice(0, TAMANHO_MAXIMO_GRUPO);
}

export function chipsGrupo(e: VisaoCliente, selecionados: readonly string[]): { chips: ChipGrupo[]; poder: number } {
  const grupo = grupoValido(e, selecionados);
  const cheio = grupo.length >= TAMANHO_MAXIMO_GRUPO;
  const chips = e.aventureiros.map((a): ChipGrupo => {
    const selecionado = grupo.includes(a.id);
    const fora = a.estado === 'em_expedicao' ? 'Em expedição' : a.estado === 'ferido' ? 'Ferido' : null;
    return {
      id: a.id,
      nome: a.nome,
      classe: a.classe,
      linha: `nível ${a.nivel} · poder ${poderAventureiro(a)}`,
      selecionado,
      disponivel: fora === null && (selecionado || !cheio),
      motivo: fora ?? (!selecionado && cheio ? `Grupo cheio (${TAMANHO_MAXIMO_GRUPO})` : null),
    };
  });
  return { chips, poder: grupo.reduce((s, id) => s + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0) };
}

export interface Andamento {
  id: string;
  texto: string;
  progresso: number;
  restante: string;
}

export function emAndamento(e: VisaoCliente, agora: number): Andamento[] {
  return e.expedicoes.map((x) => ({
    id: x.id,
    texto: `${DESTINOS[x.destino].nome} · ${juntarNomes(x.grupo.map((id) => e.aventureiros.find((a) => a.id === id)?.nome ?? id))}`,
    progresso: Math.min(1, Math.max(0, (agora - x.inicio) / Math.max(1, x.fim - x.inicio))),
    restante: formatarRestante(x.fim - agora),
  }));
}

export interface LinhaDestino {
  destino: DestinoId;
  nome: string;
  descricao: string;
  aberto: boolean;
  requer: string | null;
  perigo: string;
  saque: { recurso: Recurso; faixa: string }[];
  /** Chance com o grupo escolhido (null sem grupo). */
  chance: { texto: string; nivel: 'alta' | 'media' | 'baixa' } | null;
  pode: boolean;
  motivo: string | null;
}

const faixa = ([a, b]: readonly [number, number]) => `${decimal.format(a)}–${decimal.format(b)}`;

export function linhasDestinos(e: VisaoCliente, selecionados: readonly string[]): LinhaDestino[] {
  const grupo = grupoValido(e, selecionados);
  const poder = grupo.reduce((s, id) => s + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0);
  return DESTINOS_IDS.map((id) => {
    const d = DESTINOS[id];
    const aberto = destinoAberto(e, id);
    const duracao = duracaoExpedicaoMs(id, nivelReliquia(e, 'caminhos_eternos'));
    const bp = grupo.length ? chanceExitoBp(poder, d.perigo) : null;
    const semComida = e.recursos.comida <= 0;
    return {
      destino: id,
      nome: d.nome,
      descricao: d.descricao,
      aberto,
      requer: aberto || !d.requer ? null : `Requer a pesquisa ${PESQUISAS[d.requer].nome}`,
      perigo: `Perigo ${d.perigo} · ${formatarRestante(duracao).replace(/^0(\d):/, '$1:')}`,
      saque: (Object.entries(d.saque) as [Recurso, readonly [number, number]][]).map(([recurso, f]) => ({ recurso, faixa: faixa(f) })),
      chance: bp === null ? null : { texto: `${Math.round(bp / 100)}%`, nivel: bp >= 8_000 ? 'alta' : bp >= 5_000 ? 'media' : 'baixa' },
      pode: aberto && grupo.length > 0 && !semComida,
      motivo: !aberto ? null : grupo.length === 0 ? 'Escolha o grupo' : semComida ? 'Sem comida' : null,
    };
  });
}

export interface CartaRelatorio {
  chave: string;
  nome: string;
  vitoria: boolean;
  hora: string;
  texto: string;
  saque: { recurso: Recurso; valor: string }[];
}

/** Do mais novo para o mais velho. */
export function relatorios(e: VisaoCliente): CartaRelatorio[] {
  return e.relatorios
    .map((r, i) => ({ r, i }))
    .reverse()
    .map(({ r, i }) => {
      const saque = (Object.entries(r.saque) as [Recurso, number][]).filter(([, v]) => v > 0).map(([recurso, v]) => ({ recurso, valor: decimal.format(Math.floor(v / 1000) / 1000) }));
      const quem = juntarNomes(r.grupo);
      const verbo = r.grupo.length > 1 ? 'voltaram' : 'voltou';
      const feridos = r.feridos.length === 0 ? `${quem} ${verbo} sem feridos.` : `${quem} ${verbo}; ${juntarNomes(r.feridos)} ${r.feridos.length > 1 ? 'feridos' : 'ferido'}.`;
      return {
        chave: `${r.em}-${i}`,
        nome: DESTINOS[r.destino].nome,
        vitoria: r.vitoria,
        hora: formatarHora(r.em),
        texto: r.vitoria ? feridos : r.feridos.length ? `O grupo recuou; ${juntarNomes(r.feridos)} ${r.feridos.length > 1 ? 'voltaram feridos' : 'voltou ferido'}.` : 'O grupo recuou antes de achar algo.',
        saque,
      };
    });
}

// ---------- Eras ----------

export interface Objetivo {
  texto: string;
  feito: boolean;
  progresso: { atual: number; total: number } | null;
}

export function eraAtual(e: VisaoCliente) {
  const o = objetivosEra(e);
  const total = OBJETIVOS_ERA_1.aldeoesMinimos;
  const aldeoes = e.aldeoes.length;
  const objetivos: Objetivo[] = [
    { texto: `Pesquisar a ${PESQUISAS[OBJETIVOS_ERA_1.pesquisa].nome}`, feito: o.cartaReal, progresso: null },
    { texto: `Vencer a ${DESTINOS[OBJETIVOS_ERA_1.destinoVencido].nome}`, feito: o.criptaVencida, progresso: null },
    { texto: `Reunir ${total} aldeões (${aldeoes} agora)`, feito: o.aldeoes, progresso: { atual: Math.min(aldeoes, total), total } },
  ];
  return {
    titulo: textoEra(e.era),
    ciclo: `Ciclo ${e.ciclo}`,
    texto: ERAS[e.era - 1]?.texto ?? '',
    objetivos,
    podeAscender: o.todos,
  };
}

export interface CartaReliquia {
  id: ReliquiaId;
  nome: string;
  nivel: string;
  efeito: string;
  custo: string;
  pode: boolean;
  motivo: string | null;
}

export function reliquias(e: VisaoCliente): { titulo: string; cartas: CartaReliquia[] } {
  const disponiveis = e.reliquias.total - e.reliquias.gastas;
  const cartas = RELIQUIAS_IDS.map((id): CartaReliquia => {
    const d = RELIQUIAS[id];
    const nivel = nivelReliquia(e, id);
    const maximo = nivel >= d.nivelMaximo;
    const custo = custoReliquia(id, nivel);
    return {
      id,
      nome: d.nome,
      nivel: `${nivel} / ${d.nivelMaximo}`,
      efeito: `${maiuscula(d.efeito)}, por nível.`,
      custo: maximo ? 'Nível máximo' : `${custo} relíquia${custo === 1 ? '' : 's'}`,
      pode: !maximo && disponiveis >= custo,
      motivo: maximo ? 'Nível máximo' : disponiveis >= custo ? null : 'Relíquias insuficientes',
    };
  });
  return { titulo: `${disponiveis} disponíve${disponiveis === 1 ? 'l' : 'is'} · ${e.reliquias.total} no total`, cartas };
}

const SPRITE_ERA: Record<number, string> = { 2: 'castelo', 3: 'torre', 4: 'portal' };
const ROMANOS = ['I', 'II', 'III', 'IV'];

export function caminhoDoTempo(e: VisaoCliente) {
  return ERAS.filter((x) => x.numero > e.era).map((x) => ({
    numero: x.numero,
    titulo: textoEra(x.numero),
    texto: x.texto,
    sprite: { grupo: 'futuro', id: SPRITE_ERA[x.numero] ?? 'portal' } satisfies RefSprite,
    liberacao: `Liberada ao ascender da Era ${ROMANOS[x.numero - 2]}`,
  }));
}

/** Micro-unidades para unidades (para comparar com a tela nos testes). */
export const unidades = (micro: number) => micro / MICRO;
