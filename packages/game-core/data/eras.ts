// Eras e estado inicial do ciclo (handoff "Eras e ascensão" e "Economia v0").
import type { SlotId } from './slots.ts';
import type { Oficio } from './aventureiros.ts';
import type { Recurso } from './recursos.ts';

/** Textos do Figma (tela Eras): lema da era jogável e descrição das próximas. */
export const ERAS = [
  { numero: 1, nome: 'Aldeia', jogavel: true, texto: 'Forje as primeiras ferramentas, abra a taverna e teste o rei' },
  { numero: 2, nome: 'Reino', jogavel: false, texto: 'Cidades, comércio e cavalaria. A guilda vira uma ordem e as expedições ganham rotas reais.' },
  { numero: 3, nome: 'Arcana', jogavel: false, texto: 'Torres, magia e criaturas. A alquimia reescreve as cadeias de produção.' },
  { numero: 4, nome: 'Dimensões', jogavel: false, texto: 'Fendas no tempo abrem futuros e passados alternativos, cada um com suas regras.' },
] as const;

/** Objetivos da Era I: todos precisam valer no momento de ascender. */
export const OBJETIVOS_ERA_1 = {
  pesquisa: 'carta_real',
  destinoVencido: 'cripta',
  aldeoesMinimos: 40,
} as const;

export const ESTADO_INICIAL_CICLO = {
  recursos: { madeira: 100, pedra: 50, comida: 80, ferro: 15, ouro: 40, saber: 0 } satisfies Record<Recurso, number>,
  /** Slots prontos no nível 1; os demais começam vazios (nível 0). */
  slotsProntos: ['casa_1', 'armazem_1', 'celeiro_1', 'serraria_1'] satisfies SlotId[],
  aldeoes: ['fazendeiro', 'lenhador'] satisfies Oficio[],
  aventureiros: 1,
} as const;
