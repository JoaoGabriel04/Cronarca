// Slots de construção (spec do mapa, seção 5). Cada slot tem tipo fixo (A1).
// x, y: canto superior esquerdo em coordenadas de mundo, sprite 48x48.
import type { TipoConstrucao } from './construcoes.ts';

export interface DadosSlot {
  tipo: TipoConstrucao;
  x: number;
  y: number;
}

export const SLOTS = {
  casa_1: { tipo: 'casa', x: 147, y: 186 },
  scriptorium_1: { tipo: 'scriptorium', x: 188, y: 186 },
  mercado_1: { tipo: 'mercado', x: 247, y: 187 },
  taverna_1: { tipo: 'taverna', x: 138, y: 224 },
  armazem_1: { tipo: 'armazem', x: 271, y: 228 },
  forja_1: { tipo: 'forja', x: 187, y: 253 },
  serraria_1: { tipo: 'serraria', x: 95, y: 165 },
  serraria_2: { tipo: 'serraria', x: 252, y: 267 },
  celeiro_1: { tipo: 'celeiro', x: 166, y: 279 },
  muralha_1: { tipo: 'muralha', x: 184, y: 309 },
  pedreira_1: { tipo: 'pedreira', x: 280, y: 115 },
} as const satisfies Record<string, DadosSlot>;

export type SlotId = keyof typeof SLOTS;
export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];
