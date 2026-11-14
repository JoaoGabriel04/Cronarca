// Camada L4 (CRONARCA_MAPA_GRANDE.md, seção 3): o que não está na imagem.
// Props do núcleo, construções dos slots construídos e aldeões (um por ofício
// presente), ordenados pelo Y do pé. Funções puras. Tamanhos só da tabela de
// escala (ESCALA, game-core/data/mapa.ts).
// Árvores, pedras e montanhas estão no mapa_base.png (L0), estáticas.
// L3b (Portão 9c): a sombra de cada item (gerada da silhueta do sprite),
// desenhada antes de todos os objetos.

import {
  AJUSTE_PE_SOMBRA, animacao, ESCALA, faseDe, quadroNoTempo, PE_ALTURA_PERMIL, SOMBRA_ALDEAO, SOMBRA_AVENTUREIRO, SOMBRA_CONSTRUCAO, SOMBRA_ELIPSE_16,
  SOMBRA_OBJETO, ZOOM_MINIMO_ALDEOES,
  type Animacao, type ArvoreMapa, type MapaJogo, type Oficio, type SlotId, type SombraSilhueta,
} from '@cronarca/game-core';
import { arvoresVisiveis, LADO_ARVORE, quadroDaArvore, spriteDaArvore, type GradeArvores } from './arvores';

/**
 * Relógio da animação dos sprites (Portão Animação): o instante t em ms do
 * relógio local, lido uma vez por quadro de tela, e se a animação está ligada
 * (preferência do jogador e prefers-reduced-motion). Desligada: quadro 1.
 */
export interface RelogioAnim {
  t: number;
  animado: boolean;
}
/** Sem animação (testes e quem só quer o quadro 1). */
export const QUADRO_1: RelogioAnim = { t: 0, animado: false };

export interface ItemL4 {
  id: string;
  /** Animação do sprite (quadros e durações do quadros.json). */
  anim: Animacao;
  /** Deslocamento de fase em ms (do id): dois iguais lado a lado não andam juntos. */
  fase: number;
  /** Canto superior esquerdo e lado do sprite, em mundo (inteiros). */
  x: number;
  y: number;
  lado: number;
  /** Pé: chave de ordenação. */
  peX: number;
  peY: number;
  /**
   * Sombra da L3b pela silhueta: parâmetros e ajuste manual do pé (o pé sai
   * do desenho do quadro 1, ver lib/mapa/sombras). null = sem sombra.
   */
  sombra: { p: SombraSilhueta; ajuste: number } | null;
  /** Menor zoom em que o item aparece (aldeões: 3x; o resto: sempre). */
  zoomMinimo: number;
}

/** Nível de cada slot (o mapa só desenha construções de nível 1 ou mais). */
export type NiveisSlots = Readonly<Partial<Record<SlotId, { nivel: number }>>>;

const altura90 = (lado: number) => Math.floor((lado * PE_ALTURA_PERMIL) / 1000);
const comFase = (anim: Animacao, id: string) => ({ anim, fase: faseDe(id, anim.cicloMs) });

/** Os aldeões do estado (só o ofício importa para o mapa). */
export type AldeoesMapa = readonly { oficio: Oficio }[];

export function camadaObjetos(m: MapaJogo, slots: NiveisSlots, aldeoes: AldeoesMapa = []): ItemL4[] {
  const itens: ItemL4[] = [];

  for (const o of m.props) {
    const lado = ESCALA[o.tipo];
    const sombra = SOMBRA_OBJETO[o.tipo];
    itens.push({
      id: o.id,
      ...comFase(animacao('cenario', o.tipo), o.id),
      x: o.x - lado / 2,
      y: o.y - altura90(lado),
      lado,
      peX: o.x,
      peY: o.y,
      sombra: sombra ? { p: sombra, ajuste: AJUSTE_PE_SOMBRA[o.tipo] ?? 0 } : null,
      zoomMinimo: 1,
    });
  }

  for (const s of m.slots) {
    if ((slots[s.id]?.nivel ?? 0) < 1) continue;
    itens.push({
      id: s.id,
      ...comFase(animacao('construcao', s.tipo), s.id),
      x: s.x,
      y: s.y,
      lado: ESCALA.construcao,
      peX: s.x + ESCALA.construcao / 2,
      peY: s.y + altura90(ESCALA.construcao),
      sombra: { p: SOMBRA_CONSTRUCAO, ajuste: AJUSTE_PE_SOMBRA.construcao ?? 0 },
      zoomMinimo: 1,
    });
  }

  // Aldeões: um por ofício presente (no máximo 5), no lugar do ofício, mesmo sem a construção dele.
  const presentes = new Set(aldeoes.map((a) => a.oficio));
  for (const a of m.aldeoes) {
    if (!presentes.has(a.oficio)) continue;
    const lado = ESCALA.aldeao;
    itens.push({
      id: `aldeao_${a.oficio}`,
      ...comFase(animacao('aldeao', a.oficio), `aldeao_${a.oficio}`),
      x: a.x - lado / 2,
      y: a.y - altura90(lado),
      lado,
      peX: a.x,
      peY: a.y,
      sombra: { p: SOMBRA_ALDEAO, ajuste: AJUSTE_PE_SOMBRA.aldeao ?? 0 },
      zoomMinimo: ZOOM_MINIMO_ALDEOES,
    });
  }

  return itens.sort((a, b) => a.peY - b.peY || a.peX - b.peX || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Sprite (endereço do quadro) do item no instante do relógio, com a fase dele. */
export function nomeDoSprite(item: ItemL4, r: RelogioAnim): string {
  return quadroNoTempo(item.anim, r.t, item.fase, r.animado);
}

/** Todos os sprites que a L4 pode usar (todos os quadros). */
export function spritesDosObjetos(itens: readonly ItemL4[]): string[] {
  return [...new Set(itens.flatMap((it) => it.anim.quadros))].sort();
}

// ---------- Plano de desenho: L3b (sombras) e L4 (objetos) ----------

/** Área de desenho: tela = mundo * zoom + deslocamento (inteiros). */
export interface Vista {
  dx: number;
  dy: number;
  zoom: number;
  largura: number;
  altura: number;
}

export interface RetTela {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export type ComandoL4 =
  | { tipo: 'sombra'; sprite: string; ret: RetTela }
  | { tipo: 'objeto'; item: ItemL4; ret: RetTela }
  | { tipo: 'arvore'; arvore: ArvoreMapa; sprite: string; ret: RetTela };

/** Árvores da versão 2 do mapa para o plano: o mapa e a grade (montada uma vez). */
export interface ArvoresNoPlano {
  mapa: MapaJogo;
  grade: GradeArvores;
}

/** Chave da sombra gerada de um sprite (um por quadro). */
export const chaveDaSombra = (nomeSprite: string) => `sombra:${nomeSprite}`;

/** Sombra a gerar de um quadro: parâmetros, ajuste e o quadro de onde sai o pé. */
export interface SombraAGerar {
  p: SombraSilhueta;
  ajuste: number;
  /** O pé de todos os quadros é o do quadro 1 (o impacto do machado não mexe a sombra). */
  peDe: string;
}

/** O que o gerador de sombras precisa de cada quadro de cada sprite da L4. */
export function sombrasAGerar(itens: readonly ItemL4[]): Map<string, SombraAGerar> {
  const out = new Map<string, SombraAGerar>();
  for (const it of itens) {
    if (!it.sombra) continue;
    for (const q of it.anim.quadros) out.set(q, { ...it.sombra, peDe: it.anim.quadros[0]! });
  }
  return out;
}

/** Elipse de 16 (aldeão e aventureiro) em 1x, com o centro do miolo em (pe + dx, pe + dy). */
export function retDaElipse(pe: { x: number; y: number }): RetTela {
  const E = SOMBRA_ELIPSE_16;
  return {
    x: pe.x + SOMBRA_AVENTUREIRO.dx - E.largura / 2,
    y: pe.y + SOMBRA_AVENTUREIRO.dy - Math.floor(E.altura / 2),
    largura: E.largura,
    altura: E.altura,
  };
}

const visivel = (r: RetTela, v: Vista) => r.x + r.largura > 0 && r.y + r.altura > 0 && r.x < v.largura && r.y < v.altura;

/**
 * Ordem de desenho da L3b + L4: todas as sombras primeiro (sem ordem por Y
 * entre elas), depois os objetos na ordem do pé. Assim nenhuma sombra cobre
 * um objeto. A sombra de cada item é a imagem gerada do quadro que o item
 * mostra agora (com a fase dele), com a mesma origem do sprite e a escala inteira do zoom; o tamanho
 * vem da imagem gerada (`tamanhoSombra`), porque o pé sai do desenho.
 * `pesFixos` são pés em px de tela de quem tem tamanho fixo na tela
 * (aventureiros do grupo em marcha): a elipse de 16 deles fica em 1x.
 * `naTelaAbaixoDoZoom`: exceção da Vila no celular (A6, spec 4c): quem só
 * apareceria a partir de um zoom maior (os aldeões) aparece mesmo assim, com
 * o sprite em 1x (32 px de tela), apoiado pelo pé, e a sombra também em 1x.
 * `arvores`: as árvores da arte (versão 2), só as visíveis (grade), no quadro
 * do balanço, intercaladas pelo pé com os objetos. A sombra delas está na imagem.
 */
export function planoL4(
  itens: readonly ItemL4[], v: Vista, relogio: RelogioAnim,
  tamanhoSombra: (chave: string) => { largura: number; altura: number } | undefined,
  pesFixos: readonly { x: number; y: number }[] = [],
  naTelaAbaixoDoZoom = false,
  arvores: ArvoresNoPlano | null = null,
): ComandoL4[] {
  const sombras: ComandoL4[] = [];
  const objetos: ComandoL4[] = [];
  for (const it of itens) {
    const abaixo = v.zoom < it.zoomMinimo;
    if (abaixo && !naTelaAbaixoDoZoom) continue; // aldeões somem no zoom do Mapa
    // Na exceção, escala 1 e o pé no mesmo ponto da tela (o canto sai do pé, não do canto em mundo).
    const escala = abaixo ? 1 : v.zoom;
    const x = abaixo ? Math.round(it.peX * v.zoom + v.dx) - (it.peX - it.x) : it.x * v.zoom + v.dx;
    const y = abaixo ? Math.round(it.peY * v.zoom + v.dy) - (it.peY - it.y) : it.y * v.zoom + v.dy;
    const chave = chaveDaSombra(nomeDoSprite(it, relogio));
    const t = it.sombra ? tamanhoSombra(chave) : undefined;
    if (t && t.largura > 0) {
      const ret = { x, y, largura: t.largura * escala, altura: t.altura * escala };
      if (visivel(ret, v)) sombras.push({ tipo: 'sombra', sprite: chave, ret });
    }
    const ret = { x, y, largura: it.lado * escala, altura: it.lado * escala };
    if (visivel(ret, v)) objetos.push({ tipo: 'objeto', item: it, ret });
  }
  for (const pe of pesFixos) {
    const ret = retDaElipse(pe);
    if (visivel(ret, v)) sombras.push({ tipo: 'sombra', sprite: SOMBRA_ELIPSE_16.sprite, ret });
  }
  if (!arvores) return [...sombras, ...objetos];
  return [...sombras, ...intercalarArvores(objetos, arvores, v, relogio)];
}

/** Objetos (já na ordem do pé) e árvores visíveis, numa só ordem de pé; no empate, a árvore vem antes. */
function intercalarArvores(objetos: readonly ComandoL4[], { mapa, grade }: ArvoresNoPlano, v: Vista, relogio: RelogioAnim): ComandoL4[] {
  const area = { x: -v.dx / v.zoom, y: -v.dy / v.zoom, largura: v.largura / v.zoom, altura: v.altura / v.zoom };
  const lado = LADO_ARVORE * v.zoom;
  const out: ComandoL4[] = [];
  let k = 0;
  const peDe = (c: ComandoL4) => (c.tipo === 'objeto' ? c.item.peY : Number.POSITIVE_INFINITY);
  for (const i of arvoresVisiveis(mapa, grade, area)) {
    const a = mapa.arvores[i]!;
    while (k < objetos.length && peDe(objetos[k]!) < a.y) out.push(objetos[k++]!);
    const sprite = spriteDaArvore(a, quadroDaArvore(a, mapa.balanco.duracoesMs, relogio));
    out.push({ tipo: 'arvore', arvore: a, sprite, ret: { x: a.ox * v.zoom + v.dx, y: a.oy * v.zoom + v.dy, largura: lado, altura: lado } });
  }
  while (k < objetos.length) out.push(objetos[k++]!);
  return out;
}
