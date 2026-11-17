// Interação com o mapa (handoff, "Interação com o mapa"): teste de acerto em
// coordenadas de mundo, hitboxes dos dados, prioridade pin > objeto > slot
// vazio, e a regra "arrastar não é clicar". Funções puras.
//
// Hitbox efetiva conforme o ponteiro: toque e caneta têm mínimo de 44 px de
// tela; mouse usa a real (pixels opacos) mais 4 px de tela, e o slot vazio só
// a pegada real. A tecla H desenha exatamente estas hitboxes.
//
// Mouse em duas etapas (só construções): a caixa só descarta quem está longe;
// o acerto de verdade exige pixel opaco do quadro 1 a até 3 px de tela
// (máscara dilatada, tecla J). Árvores e pedras da imagem (seção 5b) acertam
// pela caixa x, y, w, h do meta; pins e slots vazios, pela caixa deles.

import {
  CONSTRUCOES, HITBOX_CONSTRUCAO, HITBOX_MINIMA_TELA, LIMITE_ARRASTO_PX, RAIO_ACERTO_PIXEL_TELA, TOLERANCIA_MOUSE_PX,
  type DestinoId, type MapaJogo, type Recurso, type SlotId,
} from '@cronarca/game-core';
import type { Ret } from './layoutMarcadores';
import type { EstadoPin } from './marcadores';
import { pertoDoOpaco, type Mascara } from './mascaras';
import type { ItemL4, NiveisSlots } from './objetos';

/** Mouse, ou toque/caneta (qualquer pointerType diferente de mouse). */
export type Ponteiro = 'mouse' | 'toque';
export const ponteiroDe = (pointerType: string): Ponteiro => (pointerType === 'mouse' ? 'mouse' : 'toque');

export interface Ponto {
  x: number;
  y: number;
}

/** O que o clique acertou. */
export type Alvo =
  | { tipo: 'pin'; destino: DestinoId; estado: EstadoPin }
  | { tipo: 'objeto'; id: string; recurso: Recurso }
  /** Construção que não coleta no clique: abre o Melhorar (ou a Pesquisa, no Scriptorium). */
  | { tipo: 'construcao'; slotId: SlotId }
  | { tipo: 'slotVazio'; slotId: SlotId };

/** Eventos que o mapa emite para os portões de telas e modais (12 e 13). */
export type EventoMapa =
  | { tipo: 'slotVazioClicado'; slotId: SlotId }
  | { tipo: 'construcaoClicada'; slotId: SlotId }
  | { tipo: 'pinClicado'; destino: DestinoId; estado: EstadoPin };

export interface Clicavel {
  id: string;
  /** Recurso que o clique rende; null numa construção que abre um modal. */
  recurso: Recurso | null;
  /** Hitbox em mundo, sem o mínimo de toque (aplicado no teste conforme o zoom). */
  hitbox: Ret;
  /** Canto superior esquerdo do sprite, em mundo (para ler a máscara). */
  origem: Ponto;
  /**
   * Sprite da máscara: sempre o quadro 1 (Portão Animação; os quadros têm o
   * mesmo tamanho e o pé no mesmo ponto). Vazio nos da imagem.
   */
  sprite: string;
  /** false: só pela caixa (árvores e pedras da imagem). */
  porPixel: boolean;
}

/** Ponto dentro do retângulo; a borda conta (início inclusivo, fim exclusivo). */
export const contem = (r: Ret, p: Ponto) => p.x >= r.x && p.x < r.x + r.largura && p.y >= r.y && p.y < r.y + r.altura;

/**
 * Clicáveis na ordem de desenho (o último é o da frente): primeiro as árvores
 * e pedras da imagem (L0, por baixo de tudo, na ordem do pé), depois as
 * construções da L4. Árvores e pedras: a caixa do meta, sem máscara.
 */
export function clicaveisDoMapa(m: MapaJogo, itens: readonly ItemL4[]): Clicavel[] {
  const out: Clicavel[] = clicaveisDaImagem(m);
  const slots = new Map(m.slots.map((s) => [s.id as string, s]));
  for (const it of itens) {
    // Construções: as produtoras coletam no clique; as outras (e o Scriptorium) abrem um modal.
    const s = slots.get(it.id);
    if (!s) continue;
    const dados = CONSTRUCOES[s.tipo];
    const recurso = dados.producao && !dados.cliqueAbre ? dados.producao.recurso : null;
    const hb = HITBOX_CONSTRUCAO[s.tipo];
    out.push({
      id: s.id, recurso, hitbox: { x: it.x + hb.x, y: it.y + hb.y, largura: hb.largura, altura: hb.altura },
      origem: { x: it.x, y: it.y }, sprite: it.anim.quadros[0]!, porPixel: true,
    });
  }
  return out;
}

/** O mapa não muda: a lista da imagem (1455 itens) é montada uma vez. */
const cacheImagem = new WeakMap<MapaJogo, Clicavel[]>();
function clicaveisDaImagem(m: MapaJogo): Clicavel[] {
  let lista = cacheImagem.get(m);
  if (!lista) {
    lista = [...m.clicaveis]
      .sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1))
      .map((c) => ({ id: c.id, recurso: c.recurso, hitbox: c.caixa, origem: { x: c.caixa.x, y: c.caixa.y }, sprite: '', porPixel: false }));
    cacheImagem.set(m, lista);
  }
  return [...lista];
}

/** Pasta dos contornos do hover em public/mapa (seção 5b). */
export const PASTA_CONTORNOS = 'contornos';
/** Nome do sprite do contorno, para o carregador de sprites (/mapa/<nome>.png). */
export const spriteDoContorno = (nome: string) => `${PASTA_CONTORNOS}/${nome}`;

/**
 * Destaque do hover em árvore ou pedra da imagem (seção 5b), só com mouse (no
 * toque não há hover): o contorno pronto contornos/<variante>_<quadro>.png,
 * com o canto em (cx, cy) do meta. Devolve o sprite e o canto em px de tela,
 * inteiros (tela = mundo * zoom + d, zoom inteiro); quem desenha usa o lado
 * do PNG vezes o zoom. null se o id não é um clicável da imagem.
 */
export function contornoDoDestaque(m: MapaJogo, id: string | null, ponteiro: Ponteiro, tela: { dx: number; dy: number; zoom: number }): { sprite: string; x: number; y: number } | null {
  if (!id || ponteiro !== 'mouse') return null;
  const c = porIdDaImagem(m).get(id);
  if (!c) return null;
  return { sprite: spriteDoContorno(c.contorno.nome), x: c.contorno.x * tela.zoom + tela.dx, y: c.contorno.y * tela.zoom + tela.dy };
}

/** Todos os sprites de contorno que o mapa usa (24: variante x quadro). */
export function spritesDosContornos(m: MapaJogo): string[] {
  return [...new Set(m.clicaveis.map((c) => spriteDoContorno(c.contorno.nome)))].sort();
}

/** O clicável da imagem (árvore ou pedra) por id: o tipo e o centro da caixa, em mundo, para os efeitos do clique. */
export function clicavelDaImagem(m: MapaJogo, id: string): { tipo: 'arvore' | 'pedra'; x: number; y: number } | null {
  const c = porIdDaImagem(m).get(id);
  return c ? { tipo: c.tipo, x: c.caixa.x + c.caixa.largura / 2, y: c.caixa.y + c.caixa.altura / 2 } : null;
}

const cachePorId = new WeakMap<MapaJogo, Map<string, MapaJogo['clicaveis'][number]>>();
function porIdDaImagem(m: MapaJogo) {
  let mapa = cachePorId.get(m);
  if (!mapa) cachePorId.set(m, (mapa = new Map(m.clicaveis.map((c) => [c.id, c]))));
  return mapa;
}

/** Slots vazios (nível 0, sem obra): a pegada real da construção do nível 1, em mundo. */
export function slotsVazios(m: MapaJogo, niveis: NiveisSlots & Readonly<Partial<Record<SlotId, { obraAte?: number | null }>>>): { slotId: SlotId; area: Ret }[] {
  return m.slots
    .filter((s) => (niveis[s.id]?.nivel ?? 0) === 0 && (niveis[s.id]?.obraAte ?? null) === null)
    .map((s) => {
      const hb = HITBOX_CONSTRUCAO[s.tipo];
      return { slotId: s.id, area: { x: s.x + hb.x, y: s.y + hb.y, largura: hb.largura, altura: hb.altura } };
    });
}

/** Hitbox com o mínimo de 44 px de tela, centrado na original (toque e caneta). */
export function comMinimo(r: Ret, zoom: number): Ret {
  const min = HITBOX_MINIMA_TELA / zoom;
  const largura = Math.max(r.largura, min);
  const altura = Math.max(r.altura, min);
  return { x: r.x - (largura - r.largura) / 2, y: r.y - (altura - r.altura) / 2, largura, altura };
}

/** Cresce `px` de tela de cada lado. */
function folga(r: Ret, px: number, zoom: number): Ret {
  const f = px / zoom;
  return { x: r.x - f, y: r.y - f, largura: r.largura + 2 * f, altura: r.altura + 2 * f };
}

/** Hitbox que acerta de fato, em mundo: objeto ou construção produtora. */
export const hitboxObjeto = (r: Ret, zoom: number, p: Ponteiro): Ret => (p === 'mouse' ? folga(r, TOLERANCIA_MOUSE_PX, zoom) : comMinimo(r, zoom));
/** Slot vazio: só a pegada com mouse; com toque, o mínimo de 44 px. */
export const hitboxSlot = (r: Ret, zoom: number, p: Ponteiro): Ret => (p === 'mouse' ? r : comMinimo(r, zoom));

/**
 * Ponto do evento em px do canvas (o mesmo espaço do desenho), compensando a
 * escala CSS (zoom do navegador, layout): o retângulo na página pode não ter
 * 876 x 712 px.
 */
export function pontoNoCanvas(clienteX: number, clienteY: number, caixa: { left: number; top: number; width: number; height: number }, viewport: { largura: number; altura: number }): Ponto {
  return {
    x: ((clienteX - caixa.left) * viewport.largura) / caixa.width,
    y: ((clienteY - caixa.top) * viewport.altura) / caixa.height,
  };
}

export interface Cena {
  /** Pins na tela (do layout da L7), na ordem de desenho. */
  pins: readonly { destino: DestinoId; estado: EstadoPin; ret: Ret }[];
  clicaveis: readonly Clicavel[];
  vazios: readonly { slotId: SlotId; area: Ret }[];
  /** px do canvas -> mundo (a mesma conversão do desenho). */
  paraMundo: (p: Ponto) => Ponto;
  zoom: number;
  ponteiro: Ponteiro;
  /** Máscara de cada sprite; sem ela (ainda carregando), vale só a caixa. */
  mascara?: (nomeSprite: string) => Mascara | undefined;
}

/**
 * Segunda etapa (só mouse e só quem acerta por pixel): o pixel sob o ponteiro
 * é opaco ou está a até 3 px de tela de um opaco, no quadro 1.
 */
export function passaNoPixel(c: Clicavel, pm: Ponto, cena: Pick<Cena, 'zoom' | 'ponteiro' | 'mascara'>): boolean {
  if (cena.ponteiro !== 'mouse' || !c.porPixel) return true;
  const m = cena.mascara?.(c.sprite);
  if (!m) return true;
  return pertoDoOpaco(m, pm.x - c.origem.x, pm.y - c.origem.y, cena.zoom, RAIO_ACERTO_PIXEL_TELA);
}

/**
 * Prioridade: pin (o de cima), objeto, slot vazio. Entre objetos vence o da
 * frente (último desenhado, maior Y do pé), só entre os que passam na caixa e
 * no pixel: quem está na frente mas com o ponteiro num vão do desenho perde
 * para o de trás.
 */
export function acertar(cena: Cena, pTela: Ponto): Alvo | null {
  for (let k = cena.pins.length - 1; k >= 0; k--) {
    const p = cena.pins[k]!;
    if (contem(p.ret, pTela)) return { tipo: 'pin', destino: p.destino, estado: p.estado };
  }
  const pm = cena.paraMundo(pTela);
  for (let k = cena.clicaveis.length - 1; k >= 0; k--) {
    const c = cena.clicaveis[k]!;
    if (contem(hitboxObjeto(c.hitbox, cena.zoom, cena.ponteiro), pm) && passaNoPixel(c, pm, cena)) {
      return c.recurso ? { tipo: 'objeto', id: c.id, recurso: c.recurso } : { tipo: 'construcao', slotId: c.id as SlotId };
    }
  }
  for (const v of cena.vazios) if (contem(hitboxSlot(v.area, cena.zoom, cena.ponteiro), pm)) return { tipo: 'slotVazio', slotId: v.slotId };
  return null;
}

// ---------- Gesto: arrastar não é clicar ----------

export interface Gesto {
  inicio: Ponto;
  ultimo: Ponto;
  /** Passou de 6 px em algum momento: virou pan e não gera mais clique. */
  arrastando: boolean;
}

export function iniciarGesto(p: Ponto): Gesto {
  return { inicio: p, ultimo: p, arrastando: false };
}

/** Move o ponteiro; devolve o deslocamento de pan a aplicar (0 enquanto não passa do limite). */
export function moverGesto(g: Gesto, p: Ponto): { gesto: Gesto; pan: Ponto } {
  const arrastando = g.arrastando || Math.hypot(p.x - g.inicio.x, p.y - g.inicio.y) > LIMITE_ARRASTO_PX;
  // Ao virar arrasto, o pan aplica todo o movimento desde o início (o mapa não "pula").
  const de = g.arrastando ? g.ultimo : g.inicio;
  const pan = arrastando ? { x: p.x - de.x, y: p.y - de.y } : { x: 0, y: 0 };
  return { gesto: { ...g, ultimo: arrastando ? p : g.ultimo, arrastando }, pan };
}

/** Solta o ponteiro: clique só se nunca passou do limite (vale para mouse e toque). */
export function soltarGesto(g: Gesto, p: Ponto): 'clique' | null {
  const longe = Math.hypot(p.x - g.inicio.x, p.y - g.inicio.y) > LIMITE_ARRASTO_PX;
  return g.arrastando || longe ? null : 'clique';
}
