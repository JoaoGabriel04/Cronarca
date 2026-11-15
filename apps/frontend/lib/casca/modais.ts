// Dados dos modais do Portão 13 (Melhorar, Construir, Pesquisa, Ascensão).
// Tudo derivado do estado e das regras do game-core; funções puras, testadas
// sem navegador. Os números vêm de packages/game-core/data.

import {
  construiveis, CONSTRUCOES, custoConstrucao, EVENTO_PARAMETROS, linhaCatalogo, linhasCatalogo, NOMES_RECURSOS, TEXTOS_CATALOGO, FORMULAS, NIVEL_MAXIMO_CONSTRUCAO, objetivosEra, PESQUISAS, PESQUISAS_IDS,
  micro, reliquiasNaAscensao, SLOTS, somaNiveis, tempoObraMs,
  type Custo, type EstadoLinhaCatalogo, type LinhaCatalogo, type PesquisaId, type Recurso, type RefSprite, type SlotId, type TipoConstrucao, type VisaoCliente,
} from '@cronarca/game-core';
import { excecoesDoPiso, formatarInteiro, formatarRestante, textoEra, textoGuarda } from './dados';
import { juntarNomes } from './telas';

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export interface CustoModal {
  recurso: Recurso;
  valor: string;
  /** O jogador não tem o bastante (número em vermelho, como no Figma). */
  falta: boolean;
}

export function custoModal(e: VisaoCliente, custo: Custo): CustoModal[] {
  return (Object.entries(custo) as [Recurso, number][]).map(([recurso, v]) => ({ recurso, valor: formatarInteiro(v), falta: e.recursos[recurso] < v }));
}

/** Tempo de obra ou de pesquisa no formato do Figma ("0:45", "1:30", "1:02:00"). */
export function formatarDuracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ---------- Melhorar ----------

/** "A casa", "O armazém": artigo de cada construção, para a nota do modal. */
const FEMININO: Record<TipoConstrucao, boolean> = {
  casa: true, armazem: false, celeiro: false, serraria: true, pedreira: true,
  scriptorium: false, forja: true, mercado: false, taverna: true, muralha: true,
};

/**
 * Efeito da construção deste slot com `nivel` níveis, no formato curto do
 * Figma ("+8 aldeões", "Guarda 675", "+2 madeira/s"). As outras construções
 * do mesmo tipo continuam como estão (o Armazém soma os níveis de todos).
 */
export function efeitoNoNivel(e: VisaoCliente, slot: SlotId, nivel: number): string {
  const tipo = SLOTS[slot].tipo;
  const dados = CONSTRUCOES[tipo];
  if (dados.producao) return `+${decimal.format(dados.producao.porSegundo * nivel)} ${dados.producao.recurso}/s`;
  const outros = somaNiveis(e, tipo) - e.slots[slot].nivel;
  switch (tipo) {
    case 'casa':
      return `+${FORMULAS.aldeoes.porNivelDeCasa * nivel} aldeões`;
    case 'armazem':
      return `${textoGuarda(e, 'armazem', outros + nivel)}${excecoesDoPiso(e, outros + nivel)}`;
    case 'celeiro':
      return `${textoGuarda(e, 'celeiro', outros + nivel)} de comida`;
    case 'taverna': {
      const g = FORMULAS.guilda;
      const hospitalidade = nivel >= 1 && e.pesquisas.concluidas.includes('hospitalidade') ? g.vagasHospitalidadePorTaverna : 0;
      const vagas = g.vagasPorNivelDeTaverna * nivel + hospitalidade;
      return `+${vagas} vaga${vagas === 1 ? '' : 's'}`;
    }
    case 'muralha':
      return outros + nivel >= EVENTO_PARAMETROS.bandidos.muralhaMinima ? 'Repele bandidos' : 'Sem defesa';
    default:
      return dados.efeito;
  }
}

export interface DadosObra {
  slot: SlotId;
  nome: string;
  /** O que a construção faz ("Produz madeira"), do arquivo de dados. */
  efeito: string;
  /** Sprite animado da construção (quadros.json). */
  sprite: RefSprite;
  nivel: number;
  alvo: number;
  /** Etiqueta do título: "Nv 3 → Nv 4" ou "Nível 1". */
  etiqueta: string;
  /** Efeito de hoje; null no Construir (ainda não há). */
  hoje: string | null;
  depois: string;
  custo: CustoModal[];
  tempo: string;
  situacao: 'pronta' | 'obra' | 'maximo';
  /** Em obra: quanto falta. */
  restante: string | null;
  pode: boolean;
  motivo: string | null;
  nota: string;
}

function obra(e: VisaoCliente, slot: SlotId, agora: number): DadosObra {
  const tipo = SLOTS[slot].tipo;
  const nome = CONSTRUCOES[tipo].nome;
  const s = e.slots[slot];
  const emObra = s.obraAte !== null;
  const maximo = s.nivel >= NIVEL_MAXIMO_CONSTRUCAO;
  const alvo = Math.min(s.nivel + 1, NIVEL_MAXIMO_CONSTRUCAO);
  const custo = maximo ? [] : custoModal(e, custoConstrucao(tipo, alvo));
  const falta = custo.some((c) => c.falta);
  const artigo = FEMININO[tipo] ? 'A' : 'O';
  const ocupado = FEMININO[tipo] ? 'ocupada' : 'ocupado';
  const motivo = emObra ? 'Em obra' : maximo ? 'Nível máximo' : falta ? 'Recursos insuficientes' : null;
  return {
    slot,
    nome,
    efeito: CONSTRUCOES[tipo].efeito.charAt(0).toUpperCase() + CONSTRUCOES[tipo].efeito.slice(1),
    sprite: { grupo: 'construcao', id: tipo },
    nivel: s.nivel,
    alvo,
    etiqueta: maximo ? `Nv ${s.nivel}` : `Nv ${s.nivel} → Nv ${alvo}`,
    hoje: s.nivel === 0 ? null : efeitoNoNivel(e, slot, s.nivel),
    depois: efeitoNoNivel(e, slot, alvo),
    custo,
    tempo: maximo ? '' : formatarDuracao(tempoObraMs(alvo)),
    situacao: emObra ? 'obra' : maximo ? 'maximo' : 'pronta',
    restante: emObra ? formatarRestante(s.obraAte! - agora) : null,
    pode: motivo === null,
    motivo,
    nota: `${artigo} ${nome.toLowerCase()} fica ${ocupado} durante a obra e o efeito atual continua valendo.`,
  };
}

/** Modal Melhorar (construir é pelo Catálogo, A12). */
export const dadosMelhorar = (e: VisaoCliente, slot: SlotId, agora: number) => obra(e, slot, agora);

// ---------- Catálogo de construções (A12) ----------

export interface LinhaCatalogoTela {
  slot: SlotId;
  nome: string;
  /** Sprite 48 animado da construção (quadros.json). */
  sprite: RefSprite;
  estado: EstadoLinhaCatalogo;
  custo: CustoModal[];
  /** Motivo em texto (não só cor): "Falta pedra e ouro", "Requer Cartografia". */
  motivo: string | null;
  /** Construída: "Nível 3 → 4" ou "Nível 10 · máximo". */
  nivel: string | null;
  /** Construída e abaixo do máximo: o efeito de hoje e o do próximo nível ("+12 aldeões" → "+16 aldeões"). */
  efeito: { hoje: string; depois: string } | null;
  /** Tempo da obra do próximo nível ("1:22 de obra"); null sem obra possível. */
  tempo: string | null;
  obra: { restante: string; fracao: number } | null;
  /** O botão da linha (Em obra e Bloqueada não têm). */
  acao: 'construir' | 'melhorar' | null;
  /** Construir desativado (Sem recursos): o botão fica com aria-disabled. */
  pode: boolean;
}

function paraTela(e: VisaoCliente, l: LinhaCatalogo, agora: number): LinhaCatalogoTela {
  const T = TEXTOS_CATALOGO;
  const vazio = l.estado === 'construivel' || l.estado === 'sem_recursos';
  if (l.estado === 'construida') {
    // Resumo do próximo nível na própria linha (o mesmo cálculo do modal Melhorar).
    const o = obra(e, l.slot, agora);
    const maximo = o.situacao === 'maximo';
    const faltando = o.custo.filter((c) => c.falta).map((c) => NOMES_RECURSOS[c.recurso].toLowerCase());
    return {
      slot: l.slot,
      nome: l.nome,
      sprite: { grupo: 'construcao', id: l.tipo },
      estado: l.estado,
      custo: o.custo,
      motivo: faltando.length ? `${T.falta} ${juntarNomes(faltando)}` : null,
      nivel: maximo ? `${T.nivel} ${o.nivel} · ${T.nivelMaximo}` : `${T.nivel} ${o.nivel} → ${o.alvo}`,
      efeito: maximo || o.hoje === null ? null : { hoje: o.hoje, depois: o.depois },
      tempo: maximo ? null : `${o.tempo} ${T.deObra}`,
      obra: null,
      acao: maximo ? null : 'melhorar',
      pode: !maximo && faltando.length === 0,
    };
  }
  return {
    slot: l.slot,
    nome: l.nome,
    sprite: { grupo: 'construcao', id: l.tipo },
    estado: l.estado,
    custo: vazio ? custoModal(e, l.custo) : [],
    motivo:
      l.estado === 'sem_recursos' ? `${T.falta} ${juntarNomes(l.falta.map((r) => NOMES_RECURSOS[r].toLowerCase()))}`
      : l.estado === 'bloqueada' && l.requer ? `${T.requer} ${PESQUISAS[l.requer].nome}`
      : null,
    nivel: null,
    efeito: null,
    tempo: vazio ? `${formatarDuracao(tempoObraMs(1))} ${T.deObra}` : null,
    obra: l.obra ? { restante: formatarRestante(l.obra.fim - agora), fracao: l.obra.fracao } : null,
    acao: vazio ? 'construir' : null,
    pode: l.estado === 'construivel',
  };
}

/**
 * Linhas do catálogo para a tela. `ordem`: a ordem guardada quando o catálogo
 * abriu (as linhas não pulam de lugar enquanto ele está aberto; o estado de
 * cada uma continua ao vivo).
 */
export function linhasCatalogoTela(e: VisaoCliente, agora: number, ordem?: readonly SlotId[]): LinhaCatalogoTela[] {
  const linhas = ordem ? ordem.map((id) => linhaCatalogo(e, id, agora)) : linhasCatalogo(e, agora);
  return linhas.map((l) => paraTela(e, l, agora));
}

/**
 * Selo do botão Construir: quantos slots vazios já dá para pagar. Some quando
 * o catálogo abre (`vistos` = os construíveis naquele momento) e volta quando
 * aparece um construível novo.
 */
export function seloConstruir(e: VisaoCliente, vistos: ReadonlySet<SlotId>): number {
  const agora = construiveis(e);
  return agora.some((id) => !vistos.has(id)) ? agora.length : 0;
}

// ---------- Pesquisa ----------

export interface CartaPesquisa {
  id: PesquisaId;
  nome: string;
  descricao: string;
  custo: CustoModal[];
  tempo: string;
  estado: 'concluida' | 'andamento' | 'disponivel' | 'bloqueada';
  /** Em andamento: 0 a 1 e o tempo que falta. */
  progresso: number | null;
  restante: string | null;
  /** Bloqueada: "Requer Cartografia". */
  requer: string | null;
  pode: boolean;
  motivo: string | null;
}

export function dadosPesquisa(e: VisaoCliente, agora: number) {
  const atual = e.pesquisas.atual;
  const cartas = PESQUISAS_IDS.map((id): CartaPesquisa => {
    const p = PESQUISAS[id];
    const custoMicro: Custo = {};
    for (const [r, v] of Object.entries(p.custo) as [Recurso, number][]) custoMicro[r] = micro(v);
    const custo = custoModal(e, custoMicro);
    const base = { id, nome: p.nome, descricao: p.descricao, custo, tempo: formatarDuracao(p.segundos * 1000), progresso: null, restante: null, requer: null };
    if (e.pesquisas.concluidas.includes(id)) return { ...base, estado: 'concluida', pode: false, motivo: null };
    if (atual?.id === id) {
      const total = p.segundos * 1000;
      const falta = Math.max(0, atual.fim - agora);
      return { ...base, estado: 'andamento', progresso: Math.min(1, Math.max(0, 1 - falta / total)), restante: `${formatarRestante(falta)} restantes`, pode: false, motivo: null };
    }
    const pendente = p.requer.find((r) => !e.pesquisas.concluidas.includes(r));
    if (pendente) return { ...base, estado: 'bloqueada', requer: `Requer ${PESQUISAS[pendente].nome}`, pode: false, motivo: null };
    const motivo = atual ? 'Outra pesquisa em andamento' : custo.some((c) => c.falta) ? 'Recursos insuficientes' : null;
    return { ...base, estado: 'disponivel', pode: motivo === null, motivo };
  });
  const nivel = somaNiveis(e, 'scriptorium');
  return {
    saber: `${formatarInteiro(e.recursos.saber)} de saber`,
    subtitulo: `Scriptorium nível ${nivel} · uma pesquisa por vez`,
    cartas,
  };
}

/** Selo do botão Pesquisa: quantas dá para começar agora (0 com uma em andamento ou sem saber). */
export function seloPesquisa(e: VisaoCliente): number {
  return dadosPesquisa(e, e.t).cartas.filter((c) => c.estado === 'disponivel' && c.pode).length;
}

// ---------- Ascensão ----------

/**
 * Só a Era I é jogável: ascender abre o ciclo seguinte da mesma era (o
 * game-core reinicia tudo, inclusive aventureiros, e mantém as relíquias).
 */
export function dadosAscensao(e: VisaoCliente) {
  const ganho = reliquiasNaAscensao(e.ciclo);
  return {
    era: textoEra(e.era),
    de: `Ciclo ${e.ciclo}`,
    para: `Ciclo ${e.ciclo + 1}`,
    ganho: `+${ganho} relíquia${ganho === 1 ? '' : 's'} ao ascender`,
    reinicia: ['Vila e construções', 'Aldeões', 'Pesquisas', 'Recursos', 'Aventureiros e equipamentos'],
    leva: ['Relíquias e seus níveis', 'Registro do ciclo'],
    pode: objetivosEra(e).todos,
  };
}

/** Abas do Catálogo (Figma "Folha - Construcoes", nos dois layouts). */
export type FiltroCatalogo = 'todas' | 'disponiveis';

/** Disponíveis: só o que dá para construir agora (o mesmo critério do selo do botão Construir). */
export function filtrarCatalogo(linhas: readonly LinhaCatalogoTela[], filtro: FiltroCatalogo): LinhaCatalogoTela[] {
  return filtro === 'todas' ? [...linhas] : linhas.filter((l) => l.estado === 'construivel');
}
