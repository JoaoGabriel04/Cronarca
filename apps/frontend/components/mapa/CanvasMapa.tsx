'use client';

// Canvas do mapa: câmera (Portão 6), mapa grande fixo (7c: L0 = mapa_base.png),
// L4 (construções, props do núcleo e aldeões), trilhas, L6 (névoa da Cripta,
// Portão 9) e, por cima dela, o contorno do hover, os pins, os rótulos e o
// aviso; e a interação (9b): clique em árvore, pedra, construção, pin e slot
// vazio, hover e o "+N".
// Portão 10: o estado e o clique vêm de fora (servidor com previsão, ou o
// preview de depuração); o mapa só desenha e emite intenções.
// Controles e leitura de depuração são provisórios (a UI é a L8, Portão 11).

import {
  animacao, CLASSES, CONSTRUCOES, formatarQuantidade, OFICIOS, OFICIOS_ALDEAO, HITBOX_CONSTRUCAO, mapaDaVersao, RAIO_ACERTO_PIXEL_TELA, SLOT_IDS, SOMBRA_ELIPSE_16, TILE,
  type MapaJogo, type SlotId, type VisaoCliente,
} from '@cronarca/game-core';
import { gsap } from 'gsap';
import { MedidorDeCliques, rotuloDaTaxa } from '../../lib/jogo/cliques';
import { BRILHO_MS, desenharLascas } from './desenharLascas';
import { Plus } from 'lucide-react';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode, type Ref } from 'react';
import {
  acertar, clicaveisDoMapa, clicavelDaImagem, contornoDoDestaque, hitboxObjeto, spritesDosContornos, hitboxSlot, iniciarGesto, moverGesto, ponteiroDe, pontoNoCanvas, slotsVazios, soltarGesto,
  type Alvo, type Cena, type EventoMapa, type Gesto, type Ponteiro,
} from '../../lib/mapa/acerto';
import {
  deslocamento, escalaDoCanvas, limitarCamera, mundoParaTela, moverCamera, telaParaMundo, zoomNoPonto,
  type Area, type Camera, type Ponto, type Tamanho,
} from '../../lib/mapa/camera';
import { iniciarPinca, moverPinca, type Pinca } from '../../lib/mapa/pinca';
import { pesDosGrupos, type LayoutL7 } from '../../lib/mapa/layoutMarcadores';
import { marcadores } from '../../lib/mapa/marcadores';
import { camadaObjetos, sombrasAGerar, spritesDosObjetos, type ArvoresNoPlano, type ItemL4, type RelogioAnim } from '../../lib/mapa/objetos';
import { gradeDeArvores, spritesDasArvores } from '../../lib/mapa/arvores';
import { animacaoLigada } from '../../lib/anim/movimento';
import { carregarSprites, type Sprites } from '../../lib/mapa/sprites';
import { areaDoMapa, cameraDoSlot, FOCO_SLOT, VIEWPORT_DESKTOP, VISOES, visoesDe } from '../../lib/mapa/visoes';
import { carregarFontes, desenharL7, desenharTrilhas, type Fontes } from './desenharMarcadores';
import { desenharObjetos } from './desenharObjetos';
import { gerarMascaras } from './gerarMascaras';
import { gerarSombras, type Sombras } from './gerarSombras';
import { contornoDilatado, type Mascara } from '../../lib/mapa/mascaras';
import { carregarMapaBase, desenharMapaBase } from './desenharMapaBase';
import { urlMapaFrente } from '../../lib/mapa/mapaBase';
import { desenharFrente, ladrilhosProntos, type LadrilhoPronto } from './desenharFrente';
import { gerarNevoa } from './desenharNevoa';
import { caixaDaNevoa, caixaDoAviso, nevoasAtivas, SPRITES_NEVOA, type NevoaAtiva } from '../../lib/mapa/nevoa';
import { EfeitosClique } from './efeitosClique';
import estilos from './mapa.module.css';

const CORES = {
  fora: '#0d1512',
  carregando: '#1f2e26',
  linha: 'rgb(255 255 255 / 0.18)',
  hitbox: '#ff4fd8',
  mascara: '#ffe14f',
  slotIndicio: '#f0e8c0',
  slotIndicioFundo: 'rgb(26 16 10 / 0.8)',
  /** Tracejado em duas cores (escuro por baixo, dourado por cima): lê sobre grama, estrada e telhado. */
  slotTracejadoEscuro: '#1a100a',
  slotTracejadoClaro: '#ffd060',
  hitboxPin: '#4fd8ff',
  hitboxSlot: '#7dff4f',
  /** Sobreposição do meta (tecla G): área jogável, núcleo, destinos e pontos decorativos. */
  metaJogavel: '#ffd060',
  metaNucleo: '#ff8a3d',
  metaDestino: '#4fd8ff',
  metaPoi: '#d0a0ff',
};

/** Quanto de roda acumulada vale um passo de zoom (um "clique" de mouse dá ~100). */
const PASSO_RODA = 50;
/** Tremida do objeto clicado: duração e amplitude (px de tela). */
const TREMIDA_MS = 220;
const TREMIDA_PX = 2;

interface Camadas {
  /** Mapa para o qual foram carregadas (só muda se a versão do mapa mudar). */
  mapa: MapaJogo;
  /** L0: a imagem do mapa (versão 2: sem as árvores). */
  base: HTMLImageElement;
  /** Pedras, arbustos e flores que ficam na frente das árvores (desenhados logo depois delas), em ladrilhos. */
  frente: readonly LadrilhoPronto[];
  /** Árvores da L4: o mapa e a grade do culling. */
  arvores: ArvoresNoPlano;
  sprites: Sprites;
  /** Sombras pela silhueta, geradas no carregamento (L3b). */
  sombras: Sombras;
  /** Máscaras de acerto por pixel (alfa 255), do quadro 1 de cada sprite. */
  mascaras: ReadonlyMap<string, Mascara>;
  fontes: Fontes;
}

/** Contornos da máscara dilatada (tecla J), por sprite e zoom. */
const contornos = new Map<string, { x: number; y: number }[]>();
function contornoEmCache(nome: string, m: Mascara, zoom: number) {
  const chave = `${nome}@${zoom}`;
  let c = contornos.get(chave);
  if (!c) {
    c = contornoDilatado(m, zoom, RAIO_ACERTO_PIXEL_TELA);
    contornos.set(chave, c);
  }
  return c;
}

interface OpcoesDesenho {
  cam: Camera;
  mapa: MapaJogo;
  /** L6: névoas ativas, já desenhadas em 1x (textura recortada pelo círculo). */
  nevoas: readonly { n: NevoaAtiva; tela: HTMLCanvasElement }[];
  escala: number;
  camadas: Camadas | null;
  itens: readonly ItemL4[];
  estado: VisaoCliente;
  /** Relógio do jogo (servidor, estimado). */
  relogio: () => number;
  /** Tamanho do mapa na tela, em px CSS (muda com a janela). */
  vp: Tamanho;
  /** Relógio da animação dos sprites (lido uma vez por quadro de tela). */
  anim: RelogioAnim;
  /** Saída: árvores desenhadas no último quadro (medição de desempenho). */
  medidas: { arvores: number };
  /** Tecla G: grade de tiles e o meta (área jogável, núcleo, destinos). */
  mostrarGrade: boolean;
  /** Tecla H: hitboxes por cima do mapa. */
  mostrarHitboxes: boolean;
  /** Tecla J: contorno da máscara dilatada (acerto por pixel). */
  mostrarMascaras: boolean;
  /** Tecla B (só desenvolvimento): as 11 construções de pé ao mesmo tempo. */
  todasConstrucoes: boolean;
  /** Slot vazio sob o mouse: contorno tracejado da pegada e o nome da construção. */
  slotSobMouse: SlotId | null;
  /** Slot que acabou de entrar em obra pelo Catálogo: contorno que pisca. */
  piscando: { slot: SlotId; desde: number } | null;
  /** Último tipo de ponteiro: a hitbox efetiva depende dele. */
  ponteiro: Ponteiro;
  destaque: string | null;
  tremida: { id: string; desde: number } | null;
  /** Pedra clicada: o contorno acende e as lascas saltam por BRILHO_MS. */
  brilho: { id: string; desde: number } | null;
}

function desenhar(ctx: CanvasRenderingContext2D, o: OpcoesDesenho): LayoutL7 | null {
  const { cam, mapa, escala, camadas, itens, estado, anim, vp: VP } = o;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = CORES.fora;
  ctx.fillRect(0, 0, VP.largura, VP.altura);

  const d = deslocamento(cam, VP);
  const passo = TILE * cam.zoom;
  const w = mapa.largura * cam.zoom;
  const h = mapa.altura * cam.zoom;

  if (!camadas) {
    ctx.fillStyle = CORES.carregando;
    ctx.fillRect(d.x, d.y, w, h);
    return null;
  }
  // Grupos em marcha e contadores seguem o relógio do servidor; a tremida, o local.
  const agora = o.relogio();
  const tela = { dx: d.x, dy: d.y, zoom: cam.zoom };
  desenharMapaBase(ctx, camadas.base, cam, VP); // L0
  const mk = marcadores(mapa, estado, agora);
  // L3b: sombras (inclusive a do grupo em marcha); L4: props do núcleo e construções, ordenados pelo Y do pé.
  const local = Date.now();
  const t = o.tremida && local - o.tremida.desde < TREMIDA_MS ? o.tremida : null;
  const dxTremida = t ? Math.round(Math.sin(((local - t.desde) / TREMIDA_MS) * Math.PI * 4) * TREMIDA_PX) : 0;
  o.medidas.arvores = desenharObjetos(ctx, itens, camadas.sprites, camadas.sombras, anim, { ...tela, largura: VP.largura, altura: VP.altura }, {
    destaque: o.destaque,
    tremida: t ? { id: t.id, dx: dxTremida } : null,
  }, pesDosGrupos(mk, tela), camadas.arvores);
  // O que estava na frente das árvores na arte (pedras, arbustos): por cima delas, só os ladrilhos visíveis.
  desenharFrente(ctx, camadas.frente, tela, VP);
  desenharTrilhas(ctx, mk, tela); // trilhas: por baixo da névoa
  // L6: névoa da Cripta, no zoom inteiro (a textura já vem recortada pelo círculo em 1x).
  for (const { n, tela: img } of o.nevoas) {
    const c = caixaDaNevoa(n);
    ctx.drawImage(img, c.x * cam.zoom + d.x, c.y * cam.zoom + d.y, c.largura * cam.zoom, c.altura * cam.zoom);
  }
  // L7: árvore ou pedra da imagem sob o mouse (só desktop) ganha o contorno pronto da variante,
  // com o canto em (cx, cy), no zoom inteiro (cada px do contorno vira zoom x zoom px de tela).
  const contorno = contornoDoDestaque(mapa, o.destaque, o.ponteiro, tela);
  const imgContorno = contorno && camadas.sprites.get(contorno.sprite);
  if (contorno && imgContorno) ctx.drawImage(imgContorno, contorno.x, contorno.y, imgContorno.naturalWidth * cam.zoom, imgContorno.naturalHeight * cam.zoom);
  // Clique em pedra: no tempo da tremida, o contorno acende (também no toque) e algumas lascas saltam.
  if (o.brilho && local - o.brilho.desde < BRILHO_MS) {
    const b = contornoDoDestaque(mapa, o.brilho.id, 'mouse', tela);
    const imgB = b && camadas.sprites.get(b.sprite);
    if (b && imgB) ctx.drawImage(imgB, b.x, b.y, imgB.naturalWidth * cam.zoom, imgB.naturalHeight * cam.zoom);
    const c = clicavelDaImagem(mapa, o.brilho.id);
    if (c) desenharLascas(ctx, c.x * cam.zoom + tela.dx, c.y * cam.zoom + tela.dy, (local - o.brilho.desde) / BRILHO_MS, cam.zoom);
  }
  const cripta = o.nevoas.find((x) => x.n.destino === 'cripta');
  const layout = desenharL7(ctx, mk, camadas.sprites, camadas.fontes, anim, tela, { viewport: VP, caixaAviso: cripta ? caixaDoAviso(cripta.n) : null }); // pins, rótulos e aviso por cima da névoa

  // Grade de depuração (tecla G) e o meta por cima. Linhas de 1 px em coordenada inteira: sem antisserrilhado.
  if (o.mostrarGrade) desenharMeta(ctx, mapa, cam.zoom, d, w, h, passo);

  // Hitboxes de depuração (tecla H): as efetivas, as mesmas que o teste de acerto usa
  // para o ponteiro atual. Magenta = objeto/produtora, verde = slot vazio, ciano = pin.
  if (o.mostrarHitboxes) {
    const caixa = (r: { x: number; y: number; largura: number; altura: number }, cor: string) => {
      const x0 = Math.round(r.x * cam.zoom + d.x);
      const y0 = Math.round(r.y * cam.zoom + d.y);
      const x1 = Math.round((r.x + r.largura) * cam.zoom + d.x);
      const y1 = Math.round((r.y + r.altura) * cam.zoom + d.y);
      ctx.save();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      ctx.restore();
    };
    for (const c of clicaveisDoMapa(mapa, itens)) caixa(hitboxObjeto(c.hitbox, cam.zoom, o.ponteiro), CORES.hitbox);
    ctx.save();
    ctx.font = '500 10px monospace';
    ctx.textBaseline = 'top';
    for (const v of o.todasConstrucoes ? [] : slotsVazios(mapa, estado.slots)) {
      const r = hitboxSlot(v.area, cam.zoom, o.ponteiro);
      caixa(r, CORES.hitboxSlot);
      // slotId no canto da caixa, com fundo para ler sobre qualquer terreno.
      const x = Math.round(r.x * cam.zoom + d.x) + 2;
      const y = Math.round(r.y * cam.zoom + d.y) + 2;
      const w = Math.ceil(ctx.measureText(v.slotId).width) + 4;
      ctx.fillStyle = 'rgb(13 21 18 / 0.8)';
      ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = CORES.hitboxSlot;
      ctx.fillText(v.slotId, x + 2, y + 1);
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = CORES.hitboxPin;
    for (const p of layout.pins) ctx.strokeRect(p.ret.x + 0.5, p.ret.y + 0.5, p.ret.largura - 1, p.ret.altura - 1);
    ctx.restore();
  }
  // Indício do slot vazio sob o mouse: contorno tracejado de 1 px na pegada e o nome da construção.
  const vazio = o.slotSobMouse && !o.todasConstrucoes ? slotsVazios(mapa, estado.slots).find((v) => v.slotId === o.slotSobMouse) : undefined;
  if (vazio) {
    const x0 = Math.round(vazio.area.x * cam.zoom + d.x);
    const y0 = Math.round(vazio.area.y * cam.zoom + d.y);
    const x1 = Math.round((vazio.area.x + vazio.area.largura) * cam.zoom + d.x);
    const y1 = Math.round((vazio.area.y + vazio.area.altura) * cam.zoom + d.y);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = CORES.slotTracejadoEscuro;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    ctx.strokeStyle = CORES.slotTracejadoClaro;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    const tipo = mapa.slots.find((x) => x.id === vazio.slotId)!.tipo;
    const nome = CONSTRUCOES[tipo].nome;
    ctx.setLineDash([]);
    ctx.font = `700 11px ${camadas.fontes.titulo}`;
    ctx.wordSpacing = '2px';
    const w = Math.ceil(ctx.measureText(nome).width) + 10;
    const cx = Math.round((x0 + x1) / 2);
    const ty = Math.max(0, y0 - 20);
    ctx.fillStyle = CORES.slotIndicioFundo;
    ctx.fillRect(cx - Math.floor(w / 2), ty, w, 16);
    ctx.fillStyle = CORES.slotIndicio;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nome, cx, ty + 8);
    ctx.restore();
  }

  // Catálogo: o slot da obra nova pisca (contorno de 2 px na pegada) por ~1,2 s.
  const pisca = o.piscando;
  const fase = pisca ? Date.now() - pisca.desde : Infinity;
  if (pisca && fase < FOCO_SLOT.piscarMs && Math.floor(fase / FOCO_SLOT.passoPiscarMs) % 2 === 0) {
    const s = mapa.slots.find((x) => x.id === pisca.slot);
    if (s) {
      const hb = HITBOX_CONSTRUCAO[s.tipo];
      const x0 = Math.round((s.x + hb.x) * cam.zoom + d.x);
      const y0 = Math.round((s.y + hb.y) * cam.zoom + d.y);
      const x1 = Math.round((s.x + hb.x + hb.largura) * cam.zoom + d.x);
      const y1 = Math.round((s.y + hb.y + hb.altura) * cam.zoom + d.y);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CORES.slotTracejadoEscuro;
      ctx.strokeRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
      ctx.strokeStyle = CORES.slotTracejadoClaro;
      ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
      ctx.restore();
    }
  }

  // Tecla J: contorno da máscara dilatada (3 px de tela) de quem acerta por pixel (quadro 1).
  if (o.mostrarMascaras) {
    ctx.fillStyle = CORES.mascara;
    for (const c of clicaveisDoMapa(mapa, itens)) {
      if (!c.porPixel) continue;
      const nome = c.sprite;
      const m = camadas.mascaras.get(nome);
      if (!m) continue;
      const x0 = c.origem.x * cam.zoom + d.x;
      const y0 = c.origem.y * cam.zoom + d.y;
      if (x0 > VP.largura || y0 > VP.altura || x0 + m.largura * cam.zoom < 0 || y0 + m.altura * cam.zoom < 0) continue;
      for (const p of contornoEmCache(nome, m, cam.zoom)) ctx.fillRect(x0 + p.x, y0 + p.y, 1, 1);
    }
  }
  return layout;
}

/** Tecla G: grade de tiles, área jogável, núcleo, destinos (com o nome) e pontos decorativos. */
function desenharMeta(ctx: CanvasRenderingContext2D, mapa: MapaJogo, zoom: number, d: Ponto, w: number, h: number, passo: number) {
  ctx.fillStyle = CORES.linha;
  for (let c = 1; c < mapa.largura / TILE; c++) ctx.fillRect(d.x + c * passo, d.y, 1, h);
  for (let l = 1; l < mapa.altura / TILE; l++) ctx.fillRect(d.x, d.y + l * passo, w, 1);
  const ret = (r: { x: number; y: number; largura: number; altura: number }, cor: string, largura: number) => {
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = largura;
    const m = largura / 2;
    ctx.strokeRect(r.x * zoom + d.x + m, r.y * zoom + d.y + m, r.largura * zoom - largura, r.altura * zoom - largura);
    ctx.restore();
  };
  ret(mapa.jogavel, CORES.metaJogavel, 2);
  ret(mapa.nucleo, CORES.metaNucleo, 2);
  ctx.save();
  ctx.font = '500 11px monospace';
  ctx.textBaseline = 'middle';
  const ponto = (p: { x: number; y: number; id: string }, cor: string) => {
    const x = Math.round(p.x * zoom + d.x);
    const y = Math.round(p.y * zoom + d.y);
    ctx.fillStyle = '#0d1512';
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = cor;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    const tw = Math.ceil(ctx.measureText(p.id).width) + 6;
    ctx.fillStyle = 'rgb(13 21 18 / 0.85)';
    ctx.fillRect(x + 8, y - 8, tw, 16);
    ctx.fillStyle = cor;
    ctx.fillText(p.id, x + 11, y);
  };
  for (const p of mapa.destinos) ponto(p, CORES.metaDestino);
  for (const p of mapa.pois) ponto(p, CORES.metaPoi);
  ctx.restore();
}

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function descreverEvento(e: EventoMapa): string {
  return e.tipo === 'pinClicado' ? `pinClicado { destino: ${e.destino}, estado: ${e.estado} }` : `${e.tipo} { slotId: ${e.slotId} }`;
}

/** Relógio da animação agora; desligada (preferência ou prefers-reduced-motion), tudo no quadro 1. */
const relogioAnim = (animado: boolean): RelogioAnim => ({ t: Date.now(), animado: animado && animacaoLigada() });

/** O que o clique num objeto devolve: o ganho previsto (para o "+N") e o desfecho no servidor. */
export interface CliqueObjeto {
  ganho: number;
  /** Não rendeu porque o recurso está no teto do armazém: mostra "Cheio" no lugar do "+N". */
  cheio: boolean;
  /** Bateu no teto de cliques por segundo (o aviso explicativo sai uma vez; o rótulo "+N/s máx." vem da taxa). */
  limite?: boolean;
  /** Quanto cada clique rende (micro), com as relíquias: a taxa de coleta é cliques por segundo vezes isto. */
  ganhoPorCliqueMicro?: number;
  /** false: o servidor recusou (o "+N" some). */
  aceito: Promise<boolean>;
}

export interface PropsCanvasMapa {
  /** Estado mostrado (base do servidor com as ações previstas); estado.mundo diz a versão do mapa. */
  estado: VisaoCliente;
  /** Relógio do jogo (o do servidor, estimado): grupos em marcha e contadores. */
  relogio: () => number;
  /** Intenção de clique num objeto (só o id; quem decide o ganho é a regra). */
  clicarObjeto: (id: string) => CliqueObjeto;
  /** Eventos para as telas e modais (Portões 12 e 13). */
  aoEvento?: (e: EventoMapa) => void;
  /** Ferramentas de depuração (leitura, ajuda, teclas G H J B M V 1 a 4). Só em desenvolvimento. */
  depuracao?: boolean;
  /** Comandos da casca (Vila/Reino, zoom, minimapa). */
  controle?: Ref<ControleMapa>;
  /**
   * Camadas HTML por cima do canvas (L8 e L9 da casca). Como função, recebe a
   * câmera e o tamanho do mapa na mesma renderização (zoom, minimapa), sem
   * copiar esse estado para o pai por efeito.
   */
  children?: ReactNode | ((cam: Camera, vp: Tamanho) => ReactNode);
  /** Sprites animados (Configurações); desligado, tudo fica no quadro 1. */
  animado?: boolean;
  /** Linha de ajuda das teclas abaixo do mapa (só no preview de depuração; na casca não cabe). */
  mostrarAjuda?: boolean;
  /**
   * Ocupa todo o pai e se redimensiona com ele (ResizeObserver). Sem isso, o
   * tamanho fixo do Figma (876 x 712), usado no preview de depuração.
   */
  ajustavel?: boolean;
  /** Câmera inicial (o preview abre no Reino em 1x, por exemplo); sem ela, o Reino em 2x. */
  cameraInicial?: Camera;
  /** Celular (até 600 px): Vila e Reino em 2x (spec 4c). */
  celular?: boolean;
}

/** O que a casca pode pedir ao mapa (Portão 11). */
export interface ControleMapa {
  /** Catálogo: a câmera vai até o slot (GSAP; salta com prefers-reduced-motion) e ele pisca. */
  focarSlot: (slot: SlotId) => void;
  irPara: (visao: 'vila' | 'mapa') => void;
  zoom: (passo: 1 | -1) => void;
  /** Zoom inteiro exato (preview: botões 1x a 4x), mantendo o centro. */
  definirZoom: (zoom: number) => void;
  /** Liga e desliga a grade com o meta (a mesma tecla G). */
  alternarGrade: () => void;
  /** Centra a câmera num ponto de mundo (clique no minimapa). */
  centrar: (p: Ponto) => void;
}

/** Todas as construções de pé e os 5 ofícios: carrega sprites e sombras de uma vez (obra concluída ou aldeão novo não recarrega nada). */
const TODOS_CONSTRUIDOS = Object.fromEntries(SLOT_IDS.map((id) => [id, { nivel: 1 }]));
/** Todos os ofícios e o Ocioso: o pré-carregamento dos sprites cobre qualquer aldeão que o mapa possa desenhar. */
const TODOS_OFICIOS = OFICIOS_ALDEAO.map((oficio) => ({ oficio }));

export function CanvasMapa({ estado, relogio, clicarObjeto, aoEvento, depuracao = false, controle, children, mostrarAjuda = true, ajustavel = false, animado = true, cameraInicial, celular = false }: PropsCanvasMapa) {
  const mapa = mapaDaVersao(estado.mundo.versaoMapa);
  const area = useMemo<Area>(() => areaDoMapa(mapa), [mapa]);
  const itens = useMemo(() => camadaObjetos(mapa, estado.slots, estado.aldeoes), [mapa, estado.slots, estado.aldeoes]);
  // Tecla B: só o desenho muda (todas de pé, com os 5 aldeões); o clique continua seguindo o estado.
  const itensTodos = useMemo(() => camadaObjetos(mapa, TODOS_CONSTRUIDOS, TODOS_OFICIOS), [mapa]);
  const relogioRef = useRef(relogio);
  relogioRef.current = relogio;
  const animadoRef = useRef(animado);
  animadoRef.current = animado;

  const canvas = useRef<HTMLCanvasElement>(null);
  const camadaEfeitos = useRef<HTMLDivElement>(null);
  const efeitos = useRef<EfeitosClique | null>(null);
  const gesto = useRef<Gesto | null>(null);
  /** Dedos (ou ponteiros) pressionados no canvas, pelo pointerId: com dois, é pinça. */
  const dedos = useRef(new Map<number, Ponto>());
  const pinca = useRef<Pinca | null>(null);
  const ultimoLayout = useRef<LayoutL7 | null>(null);
  const roda = useRef(0);
  const [VP, setVp] = useState<Tamanho>(VIEWPORT_DESKTOP);
  const moldura = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>(() => limitarCamera(cameraInicial ?? VISOES.mapa, area, VIEWPORT_DESKTOP));

  // Tamanho do mapa = tamanho do pai, em px CSS inteiros. A câmera fica dentro da imagem.
  useEffect(() => {
    const el = moldura.current;
    if (!ajustavel || !el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const novo = { largura: Math.max(1, Math.floor(r.width)), altura: Math.max(1, Math.floor(r.height)) };
      setVp((v) => (v.largura === novo.largura && v.altura === novo.altura ? v : novo));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ajustavel]);
  useEffect(() => {
    setCam((c) => limitarCamera(c, area, VP));
  }, [VP, area]);
  const [escala, setEscala] = useState(1);
  const [cursor, setCursor] = useState<Ponto | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [sobre, setSobre] = useState<Alvo | null>(null);
  const [tremida, setTremida] = useState<{ id: string; desde: number } | null>(null);
  const [brilho, setBrilho] = useState<{ id: string; desde: number } | null>(null);
  /** Ritmo de cliques por objeto (a taxa de coleta que sobe do clique). */
  const medidor = useRef(new MedidorDeCliques());
  const [piscando, setPiscando] = useState<{ slot: SlotId; desde: number } | null>(null);
  /** Câmera indo até um slot (Catálogo); qualquer gesto do jogador corta. */
  const indo = useRef<gsap.core.Tween | null>(null);
  const camAtual = useRef(cam);
  camAtual.current = cam;
  useEffect(() => () => void indo.current?.kill(), []);
  const [ultimoEvento, setUltimoEvento] = useState<string | null>(null);
  const [camadas, setCamadas] = useState<Camadas | null>(null);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [mostrarHitboxes, setMostrarHitboxes] = useState(false);
  const [mostrarMascaras, setMostrarMascaras] = useState(false);
  const [todasConstrucoes, setTodasConstrucoes] = useState(false);
  const [ponteiro, setPonteiro] = useState<Ponteiro>('mouse');
  // O que o laço de desenho precisa; atualizado a cada render, lido a cada quadro.
  const paraDesenhar = useRef<Omit<OpcoesDesenho, 'anim' | 'medidas'> | null>(null);

  // Hover com o mouse parado: quando a câmera, o zoom ou os objetos mudam, o que
  // está sob o ponteiro muda sem pointermove. Refaz o teste depois do próximo
  // quadro, que já traz os pins da L7 na posição nova.
  useEffect(() => {
    if (!cursor || gesto.current) return;
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setSobre(acertar(cena(), cursor)));
    });
    return () => cancelAnimationFrame(id);
    // Fora das dependências de propósito: o cursor (o aoMover já cuida do movimento).
  }, [cam, itens, estado.slots, ponteiro]);

  // Aparelho de toque: começa em modo toque (os marcadores de slot vazio já aparecem antes do 1º toque).
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) setPonteiro('toque');
  }, []);

  // Escala da tela (muda ao trocar de monitor ou com o zoom do navegador).
  useEffect(() => {
    const atualizar = () => setEscala(escalaDoCanvas(window.devicePixelRatio));
    atualizar();
    window.addEventListener('resize', atualizar);
    return () => window.removeEventListener('resize', atualizar);
  }, []);

  // Camada HTML do "+N".
  useEffect(() => {
    if (!camadaEfeitos.current) return;
    const e = new EfeitosClique(camadaEfeitos.current, formatarQuantidade);
    efeitos.current = e;
    return () => e.destruir();
  }, []);

  // Carrega a imagem do mapa, os sprites e as fontes uma vez por mapa.
  useEffect(() => {
    let ativo = true;
    const doL7 = ['icone-expedicao', 'icone-bloqueado', ...CLASSES.flatMap((c) => animacao('aventureiro', c).quadros)];
    const possiveis = camadaObjetos(mapa, TODOS_CONSTRUIDOS, TODOS_OFICIOS);
    // Os 64 quadros das árvores e a camada de frente carregam junto com o mapa (sem piscar).
    Promise.all([carregarMapaBase(), carregarMapaBase(urlMapaFrente()), carregarSprites([...spritesDosContornos(mapa), ...SPRITES_NEVOA, ...spritesDosObjetos(possiveis), ...spritesDasArvores(mapa), SOMBRA_ELIPSE_16.sprite, ...doL7]), carregarFontes()])
      .then(([base, frente, sprites, fontes]) => {
        if (!ativo) return;
        setCamadas({
          mapa,
          base,
          frente: ladrilhosProntos(frente),
          arvores: { mapa, grade: gradeDeArvores(mapa) },
          sprites,
          sombras: gerarSombras(sprites, sombrasAGerar(possiveis)),
          mascaras: gerarMascaras(sprites, clicaveisDoMapa(mapa, possiveis).flatMap((c) => (c.porPixel ? [c.sprite] : []))),
          fontes,
        });
      })
      .catch((erro: unknown) => console.error('[mapa]', erro));
    return () => {
      ativo = false;
    };
  }, [mapa]);

  // L6: a névoa só muda quando a pesquisa que abre o destino termina.
  const chaveNevoas = nevoasAtivas(estado).map((n) => n.destino).join(',');
  const nevoas = useMemo(
    () => (camadas ? nevoasAtivas(estado).map((n) => ({ n, tela: gerarNevoa(n, camadas.sprites) })) : []),
    // Só a lista de destinos importa (o resto do estado muda a cada quadro).
    [camadas, chaveNevoas],
  );

  const destaque = sobre?.tipo === 'objeto' ? sobre.id : sobre?.tipo === 'construcao' ? sobre.slotId : null;
  const slotSobMouse = sobre?.tipo === 'slotVazio' && ponteiro === 'mouse' ? sobre.slotId : null;
  useEffect(() => {
    // Até a imagem e os sprites chegarem, desenha a tela de espera.
    const prontas = camadas?.mapa === mapa ? camadas : null;
    paraDesenhar.current = { vp: VP, cam, mapa, nevoas, escala, camadas: prontas, itens: todasConstrucoes ? itensTodos : itens, estado, todasConstrucoes, slotSobMouse, piscando, mostrarGrade, mostrarHitboxes, mostrarMascaras, ponteiro, destaque, tremida, brilho, relogio: () => relogioRef.current() };
  }, [VP, cam, mapa, nevoas, escala, camadas, itens, itensTodos, todasConstrucoes, slotSobMouse, piscando, estado, mostrarGrade, mostrarHitboxes, mostrarMascaras, ponteiro, destaque, tremida, brilho]);

  // Laço de desenho: um quadro por atualização da tela, para o grupo em marcha
  // andar liso e o contador virar no segundo certo. O quadro da animação de
  // cada sprite (durações do quadros.json, com a fase do item) vem do relógio, não de um timer.
  useEffect(() => {
    let id = 0;
    const medidas = { arvores: 0 };
    const laco = () => {
      const ctx = canvas.current?.getContext('2d');
      const o = paraDesenhar.current;
      if (ctx && o) {
        ultimoLayout.current = desenhar(ctx, { ...o, anim: relogioAnim(animadoRef.current), medidas });
        // Árvores desenhadas por quadro, no canvas (data-arvores), para a medição de desempenho.
        if (canvas.current && canvas.current.dataset.arvores !== String(medidas.arvores)) canvas.current.dataset.arvores = String(medidas.arvores);
      }
      id = requestAnimationFrame(laco);
    };
    id = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(id);
  }, []);

  // Roda do mouse: precisa de listener não passivo para impedir a rolagem da página.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      indo.current?.kill();
      roda.current += e.deltaY;
      if (Math.abs(roda.current) < PASSO_RODA) return;
      const passo = roda.current < 0 ? 1 : -1;
      roda.current = 0;
      const p = pontoNoCanvas(e.clientX, e.clientY, el.getBoundingClientRect(), VP);
      setCam((c) => zoomNoPonto(c, c.zoom + passo, p, area, VP));
    };
    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  }, [area, VP]);

  useImperativeHandle(controle, () => ({
    focarSlot: (slot) => {
      indo.current?.kill();
      const alvo = limitarCamera(cameraDoSlot(mapa, slot, celular), area, VP);
      setPiscando({ slot, desde: Date.now() });
      // Sem movimento (prefers-reduced-motion): salta direto. O zoom muda de uma vez (sempre inteiro); só o pan anima.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCam(alvo);
        return;
      }
      const de = limitarCamera({ ...camAtual.current, zoom: alvo.zoom }, area, VP);
      setCam(de);
      const p = { x: de.x, y: de.y };
      indo.current = gsap.to(p, {
        x: alvo.x,
        y: alvo.y,
        duration: FOCO_SLOT.animacaoS,
        ease: 'power2.inOut',
        onUpdate: () => setCam(limitarCamera({ x: p.x, y: p.y, zoom: alvo.zoom }, area, VP)),
        onComplete: () => {
          indo.current = null;
        },
      });
    },
    irPara: (visao) => setCam(limitarCamera(visao === 'vila' ? visoesDe(celular).vila : visoesDe(celular).mapa, area, VP)),
    zoom: (passo) => setCam((c) => limitarCamera({ ...c, zoom: c.zoom + passo }, area, VP)),
    centrar: (p) => setCam((c) => limitarCamera({ ...c, x: p.x, y: p.y }, area, VP)),
    definirZoom: (zoom) => setCam((c) => limitarCamera({ ...c, zoom }, area, VP)),
    alternarGrade: () => setMostrarGrade((g) => !g),
  }), [area, VP, mapa, celular]);

  // Teclas de depuração: 1 a 4 zoom, M Mapa, V Vila, G grade e meta, H hitboxes, J máscaras, B todas.
  useEffect(() => {
    if (!depuracao) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      const tecla = e.key.toLowerCase();
      if (['1', '2', '3', '4'].includes(tecla)) setCam((c) => limitarCamera({ ...c, zoom: Number(tecla) }, area, VP));
      else if (tecla === 'm') setCam(limitarCamera(visoesDe(celular).mapa, area, VP));
      else if (tecla === 'v') setCam(limitarCamera(visoesDe(celular).vila, area, VP));
      else if (tecla === 'g') setMostrarGrade((g) => !g);
      else if (tecla === 'h') setMostrarHitboxes((h) => !h);
      else if (tecla === 'j') setMostrarMascaras((j) => !j);
      // B: as 11 construções de pé ao mesmo tempo (conferir sobreposição). Nunca em produção.
      // B: as 11 construções e os 5 aldeões de pé ao mesmo tempo (conferir sobreposição). Nunca em produção.
      else if (tecla === 'b' && process.env.NODE_ENV !== 'production') setTodasConstrucoes((t) => !t);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [area, depuracao, VP, celular]);

  function pontoDoEvento(e: EventoPonteiro<HTMLCanvasElement>): Ponto {
    return pontoNoCanvas(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), VP);
  }

  function cena(): Cena {
    return {
      pins: (ultimoLayout.current?.pins ?? []).map((p) => ({ destino: p.pin.id, estado: p.estado, ret: p.ret })),
      clicaveis: clicaveisDoMapa(mapa, itens),
      vazios: slotsVazios(mapa, estado.slots),
      paraMundo: (p) => telaParaMundo(p, cam, VP),
      zoom: cam.zoom,
      ponteiro,
      mascara: (nome) => (camadas?.mapa === mapa ? camadas.mascaras.get(nome) : undefined),
    };
  }

  function emitir(ev: EventoMapa) {
    setUltimoEvento(descreverEvento(ev));
    aoEvento?.(ev);
  }

  function clicar(p: Ponto) {
    const alvo = acertar(cena(), p);
    if (!alvo) return;
    if (alvo.tipo === 'pin') return emitir({ tipo: 'pinClicado', destino: alvo.destino, estado: alvo.estado });
    if (alvo.tipo === 'slotVazio') return emitir({ tipo: 'slotVazioClicado', slotId: alvo.slotId });
    if (alvo.tipo === 'construcao') {
      setTremida({ id: alvo.slotId, desde: Date.now() });
      return emitir({ tipo: 'construcaoClicada', slotId: alvo.slotId });
    }
    // Objeto: só a intenção sai daqui. O ganho previsto vem da mesma regra do
    // servidor (limite de 5/s por objeto e 10/s no total); se o servidor recusar, o "+N" some.
    const r = clicarObjeto(alvo.id);
    setTremida({ id: alvo.id, desde: Date.now() });
    // Pedra: não treme (está pintada na imagem), então acende o contorno e solta lascas.
    if (clicavelDaImagem(mapa, alvo.id)?.tipo === 'pedra') setBrilho({ id: alvo.id, desde: Date.now() });
    setUltimoEvento(`clique em ${alvo.id}`);
    if (r.cheio) efeitos.current?.mostrarCheio(alvo.id, alvo.recurso, p.x, p.y);
    else {
      // O rótulo mostra a TAXA de coleta (recurso por segundo), não a soma: trava no teto e avisa "máx.".
      const agora = Date.now();
      medidor.current.registrar(alvo.id, agora);
      const taxa = medidor.current.taxa(alvo.id, agora, r.ganhoPorCliqueMicro ?? 0);
      if (taxa.microPorSegundo > 0) efeitos.current?.mostrarTexto(alvo.id, alvo.recurso, rotuloDaTaxa(taxa), p.x, p.y);
    }
    void r.aceito.then((ok) => {
      if (!ok) efeitos.current?.cancelar(alvo.id);
    });
  }

  /** Os dois primeiros dedos pressionados (a pinça usa só dois). */
  function doisDedos(): [Ponto, Ponto] | null {
    const [a, b] = dedos.current.values();
    return a && b ? [a, b] : null;
  }

  function aoPressionar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    indo.current?.kill();
    setPonteiro(ponteiroDe(e.pointerType));
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pontoDoEvento(e);
    dedos.current.set(e.pointerId, p);
    const par = doisDedos();
    if (par && !pinca.current) {
      // Segundo dedo: começa a pinça; o toque do primeiro não vira clique nem arrasto.
      gesto.current = null;
      setArrastando(false);
      pinca.current = iniciarPinca(par[0], par[1], cam.zoom);
      return;
    }
    if (!pinca.current) gesto.current = iniciarGesto(p);
  }

  function aoMover(e: EventoPonteiro<HTMLCanvasElement>) {
    const p = pontoDoEvento(e);
    setCursor(p);
    setPonteiro(ponteiroDe(e.pointerType));
    if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, p);
    const par = doisDedos();
    if (pinca.current && par) {
      const r = moverPinca(pinca.current, par[0], par[1]);
      pinca.current = r.pinca;
      setSobre(null);
      setCam((c) => {
        const movida = r.pan.x || r.pan.y ? moverCamera(c, r.pan.x, r.pan.y, area, VP) : c;
        return r.zoom !== movida.zoom ? zoomNoPonto(movida, r.zoom, r.centro, area, VP) : movida;
      });
      return;
    }
    const g = gesto.current;
    if (g) {
      const r = moverGesto(g, p);
      gesto.current = r.gesto;
      if (r.gesto.arrastando) {
        setArrastando(true);
        setSobre(null);
        if (r.pan.x || r.pan.y) setCam((c) => moverCamera(c, r.pan.x, r.pan.y, area, VP));
      }
      return;
    }
    // Sem botão pressionado: o que está sob o ponteiro (hover).
    setSobre(acertar(cena(), p));
  }

  /**
   * Tira um dedo da pinça: com um dedo ainda na tela, ele continua arrastando
   * (sem pulo e sem virar clique); sem nenhum, a pinça acaba.
   */
  function soltarDaPinca(pointerId: number) {
    dedos.current.delete(pointerId);
    if (doisDedos()) return;
    pinca.current = null;
    const [resto] = dedos.current.values();
    gesto.current = resto ? { inicio: resto, ultimo: resto, arrastando: true } : null;
    setArrastando(Boolean(resto));
  }

  function aoSoltar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (pinca.current) {
      soltarDaPinca(e.pointerId);
      return;
    }
    dedos.current.delete(e.pointerId);
    const g = gesto.current;
    gesto.current = null;
    setArrastando(false);
    // Depois de um pan (mouse ou toque), soltar não gera clique.
    if (g && soltarGesto(g, pontoDoEvento(e)) === 'clique') clicar(pontoDoEvento(e));
  }

  function aoCancelar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (pinca.current) {
      soltarDaPinca(e.pointerId);
      return;
    }
    dedos.current.delete(e.pointerId);
    gesto.current = null;
    setArrastando(false);
  }

  const noMundo = cursor ? telaParaMundo(cursor, cam, VP) : null;
  const dentro = noMundo && noMundo.x >= 0 && noMundo.y >= 0 && noMundo.x < mapa.largura && noMundo.y < mapa.altura;
  const classeCursor = arrastando ? estilos.arrastando : sobre ? estilos.clicavel : '';

  return (
    <div
      ref={moldura}
      className={`${estilos.moldura} ${ajustavel ? estilos.ajustavel : ''}`}
      // Para a conferência no navegador (make conferir-mapa): imagem carregada e a câmera atual.
      data-pronto={camadas?.mapa === mapa ? 'sim' : 'nao'}
      data-cam-x={cam.x}
      data-cam-y={cam.y}
      data-zoom={cam.zoom}
      data-escala={escala}
    >
      <canvas
        ref={canvas}
        className={`${estilos.canvas} ${classeCursor}`}
        width={VP.largura * escala}
        height={VP.altura * escala}
        style={{ width: VP.largura, height: VP.altura }}
        aria-label="Mapa do reino"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoCancelar}
        // Toque longo (Android) e botão direito não abrem o menu do navegador sobre o mapa.
        onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={() => {
          setCursor(null);
          setSobre(null);
        }}
      />
      {ponteiro === 'toque' && !todasConstrucoes && (
        // Toque não tem hover: um marcador fixo no centro de cada slot vazio diz que dá para construir ali.
        <div className={estilos.marcadoresSlot} aria-hidden="true">
          {slotsVazios(mapa, estado.slots).map((v) => {
            const c = mundoParaTela({ x: v.area.x + v.area.largura / 2, y: v.area.y + v.area.altura / 2 }, cam, VP);
            if (c.x < 0 || c.y < 0 || c.x > VP.largura || c.y > VP.altura) return null;
            return (
              <span key={v.slotId} className={estilos.marcadorSlot} style={{ left: Math.round(c.x), top: Math.round(c.y) }}>
                <Plus size={16} strokeWidth={2.5} />
              </span>
            );
          })}
        </div>
      )}
      <div ref={camadaEfeitos} className={estilos.efeitos} aria-hidden="true" />
      {typeof children === 'function' ? children(cam, VP) : children}
      {depuracao && (
      <>
      <p className={estilos.depuracao}>
        Mapa v{mapa.versao} · Zoom {cam.zoom}x · {ponteiro === 'mouse' ? 'Mouse' : 'Toque'} · Câmera ({numero(cam.x)}; {numero(cam.y)})
        {noMundo && (
          <>
            {' '}· Mundo ({numero(noMundo.x)}; {numero(noMundo.y)}) · Tile{' '}
            {dentro ? `(${Math.floor(noMundo.x / TILE)}; ${Math.floor(noMundo.y / TILE)})` : 'fora da imagem'}
          </>
        )}
        {todasConstrucoes && <> · Todas as construções (B)</>}
        {ultimoEvento && <> · Evento: {ultimoEvento}</>}
      </p>
      {mostrarAjuda && <p className={estilos.ajuda}>
        Arraste para mover · Clique em árvores, pedras e construções · Roda ou 1 a 4: zoom · M: Mapa · V: Vila · G: grade e meta · H: hitboxes · J: máscaras{process.env.NODE_ENV !== 'production' && ' · B: todas as construções'}
      </p>}
      </>
      )}
    </div>
  );
}
