// Árvores com vento (versão 2 do mapa): as 1583 árvores da arte saíram da
// imagem e são desenhadas na L4, ordenadas pelo pé junto com o núcleo. Funções
// puras: a grade espacial que recorta só as visíveis (nunca as 1583 a cada
// quadro), o quadro do balanço de cada uma e os nomes dos sprites.
//
// Clique e hover não mudam: a caixa e o contorno vêm de `clicaveis`, no
// desenho pintado (campo `quadro`). O balanço só mexe a copa (1 px de sprite).

import { ESCALA, faseDe, indiceNoTempo, type ArvoreMapa, type MapaJogo } from '@cronarca/game-core';
import type { RelogioAnim } from './objetos';

/** Lado do sprite da árvore, em mundo (tabela de escala). */
export const LADO_ARVORE = ESCALA.arvore;
/** Lado da célula da grade, em mundo: 12 x 9 células no mapa de 3072 x 2304. */
export const CELULA_ARVORES = 256;
/**
 * Quadro de repouso: o desenho pintado na arte original (os quadros 2 e 4 são
 * iguais; no 1 e no 3 a copa vai 1 px para cada lado). Parado (preferência ou
 * movimento reduzido), a árvore fica nele e o mapa é idêntico à arte.
 */
export const QUADRO_REPOUSO = 2;

/** Pasta dos sprites em public/mapa. */
const PASTA = 'arvores';

/** Sprite do quadro k (1..n) de uma árvore, para o carregador (/mapa/<nome>.png). */
export const spriteDaArvore = (a: Pick<ArvoreMapa, 'variante' | 'quadro'>, k: number) => `${PASTA}/${a.variante}_${a.quadro}_${k}`;

/** Todos os sprites de árvore que o mapa usa (variante x desenho x quadro). */
export function spritesDasArvores(m: MapaJogo): string[] {
  const nomes = new Set<string>();
  for (const a of m.arvores) for (let k = 1; k <= m.balanco.duracoesMs.length; k++) nomes.add(spriteDaArvore(a, k));
  return [...nomes].sort();
}

/** Quadro (1..n) que a árvore mostra no instante do relógio, com a fase dela. */
export function quadroDaArvore(a: Pick<ArvoreMapa, 'id'>, duracoesMs: readonly number[], r: RelogioAnim): number {
  if (!r.animado) return QUADRO_REPOUSO;
  const ciclo = duracoesMs.reduce((x, y) => x + y, 0);
  return indiceNoTempo(duracoesMs, r.t + faseDe(a.id, ciclo)) + 1;
}

export interface GradeArvores {
  colunas: number;
  linhas: number;
  /** Índices em `m.arvores` de cada célula (pelo canto do sprite), em ordem crescente. */
  celulas: readonly (readonly number[])[];
}

/** Grade espacial das árvores, montada uma vez por mapa. */
export function gradeDeArvores(m: MapaJogo): GradeArvores {
  const colunas = Math.ceil(m.largura / CELULA_ARVORES);
  const linhas = Math.ceil(m.altura / CELULA_ARVORES);
  const celulas: number[][] = Array.from({ length: colunas * linhas }, () => []);
  const lim = (v: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(v / CELULA_ARVORES)));
  m.arvores.forEach((a, i) => celulas[lim(a.oy, linhas) * colunas + lim(a.ox, colunas)]!.push(i));
  return { colunas, linhas, celulas };
}

/** Retângulo em mundo. */
export interface RetMundo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Índices das árvores cujo sprite cruza a área (em mundo), em ordem de pé.
 * Só percorre as células que a área toca, com margem do lado do sprite para
 * cima e para a esquerda (a célula é a do canto do sprite).
 */
export function arvoresVisiveis(m: MapaJogo, g: GradeArvores, area: RetMundo): number[] {
  const c0 = Math.max(0, Math.floor((area.x - LADO_ARVORE) / CELULA_ARVORES));
  const l0 = Math.max(0, Math.floor((area.y - LADO_ARVORE) / CELULA_ARVORES));
  const c1 = Math.min(g.colunas - 1, Math.floor((area.x + area.largura) / CELULA_ARVORES));
  const l1 = Math.min(g.linhas - 1, Math.floor((area.y + area.altura) / CELULA_ARVORES));
  const out: number[] = [];
  for (let l = l0; l <= l1; l++) {
    for (let c = c0; c <= c1; c++) {
      for (const i of g.celulas[l * g.colunas + c]!) {
        const a = m.arvores[i]!;
        if (a.ox < area.x + area.largura && a.ox + LADO_ARVORE > area.x && a.oy < area.y + area.altura && a.oy + LADO_ARVORE > area.y) out.push(i);
      }
    }
  }
  // O meta já vem em ordem de pé: o índice é a ordem de desenho.
  return out.sort((a, b) => a - b);
}
