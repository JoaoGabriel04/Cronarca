// Catálogo de construções (handoff, A12): uma linha por slot do núcleo, com o
// estado de cada uma. Função pura da visão do cliente; quem valida a obra
// continua sendo o servidor (construir { slot }).
import { CONSTRUCOES, type TipoConstrucao } from '../data/construcoes.ts';
import type { PesquisaId } from '../data/pesquisas.ts';
import { RECURSOS, type Recurso } from '../data/recursos.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import type { VisaoCliente } from './estado.ts';
import { custoConstrucao, tempoObraMs, type Custo } from './formulas.ts';

export type EstadoLinhaCatalogo = 'construivel' | 'sem_recursos' | 'em_obra' | 'construida' | 'bloqueada';

/** Ordem do catálogo: o que dá para fazer agora primeiro (Figma). */
export const ORDEM_CATALOGO: readonly EstadoLinhaCatalogo[] = ['construivel', 'sem_recursos', 'em_obra', 'construida', 'bloqueada'];

export interface LinhaCatalogo {
  slot: SlotId;
  tipo: TipoConstrucao;
  /** "Serraria", e "Serraria II" no segundo slot do mesmo tipo. */
  nome: string;
  estado: EstadoLinhaCatalogo;
  /** Nível atual (0 no slot vazio). */
  nivel: number;
  /** Custo do nível 1, em micro-unidades (só no slot vazio). */
  custo: Custo;
  /** Recursos do custo que o jogador não tem (Sem recursos). */
  falta: Recurso[];
  /** Obra em andamento: início, fim e quanto já passou (0 a 1). */
  obra: { inicio: number; fim: number; fracao: number } | null;
  /** Bloqueada: a pesquisa que falta. */
  requer: PesquisaId | null;
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Nome do slot: o tipo, com o número romano a partir do segundo slot do mesmo tipo. */
export function nomeDoSlot(slot: SlotId): string {
  const tipo = SLOTS[slot].tipo;
  const mesmos = SLOT_IDS.filter((id) => SLOTS[id].tipo === tipo);
  const i = mesmos.indexOf(slot);
  const nome = CONSTRUCOES[tipo].nome;
  return i > 0 ? `${nome} ${ROMANOS[i] ?? i + 1}` : nome;
}

export function linhaCatalogo(e: VisaoCliente, slot: SlotId, agora: number): LinhaCatalogo {
  const tipo = SLOTS[slot].tipo;
  const s = e.slots[slot];
  const base = { slot, tipo, nome: nomeDoSlot(slot), nivel: s.nivel, custo: {}, falta: [], obra: null, requer: null };
  if (s.obraAte !== null) {
    const fim = s.obraAte;
    const inicio = fim - tempoObraMs(s.nivel + 1);
    const fracao = Math.min(1, Math.max(0, (agora - inicio) / (fim - inicio)));
    return { ...base, estado: 'em_obra', obra: { inicio, fim, fracao } };
  }
  if (s.nivel >= 1) return { ...base, estado: 'construida' };
  const requer = CONSTRUCOES[tipo].requer ?? null;
  if (requer && !e.pesquisas.concluidas.includes(requer)) return { ...base, estado: 'bloqueada', requer };
  const custo = custoConstrucao(tipo, 1);
  const falta = RECURSOS.filter((r) => (custo[r] ?? 0) > e.recursos[r]);
  return { ...base, estado: falta.length === 0 ? 'construivel' : 'sem_recursos', custo, falta };
}

/** As 11 linhas, na ordem do catálogo; dentro de cada estado, a ordem dos slots nos dados. */
export function linhasCatalogo(e: VisaoCliente, agora: number): LinhaCatalogo[] {
  const linhas = SLOT_IDS.map((id) => linhaCatalogo(e, id, agora));
  return linhas
    .map((l, i) => ({ l, i }))
    .sort((a, b) => ORDEM_CATALOGO.indexOf(a.l.estado) - ORDEM_CATALOGO.indexOf(b.l.estado) || a.i - b.i)
    .map((x) => x.l);
}

/** Slots vazios que o jogador já pode pagar (o selo do botão Construir). */
export function construiveis(e: VisaoCliente): SlotId[] {
  return SLOT_IDS.filter((id) => linhaCatalogo(e, id, e.t).estado === 'construivel');
}
