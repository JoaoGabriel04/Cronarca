// Desenha a L5 (trilhas, antes da névoa) e a L7 (depois dela) a partir do
// layout em px de tela (lib/mapa/layoutMarcadores). Cores do frame
// `Mapa - Desktop`; tamanhos reduzidos a pedido do dono, fixos na tela.

import { animacao, faseDe, quadroNoTempo } from '@cronarca/game-core';
import { layoutL7, MEDIDAS as M, type LayoutL7, type Medidor, type Ret, type Tela, type TipoTexto } from '../../lib/mapa/layoutMarcadores';
import type { Marcadores } from '../../lib/mapa/marcadores';
import type { RelogioAnim } from '../../lib/mapa/objetos';
import type { Sprites } from '../../lib/mapa/sprites';

/** Famílias das fontes (vêm das variáveis do next/font) para o canvas. */
export interface Fontes {
  titulo: string;
  mono: string;
}

const COR = {
  contorno: '#1a100a',
  madeira: '#3a2818',
  madeiraLuz: '#6e482c',
  madeiraSombra: '#2a1c12',
  texto: '#f0e8c0',
  textoApagado: '#a08a68',
  tempo: '#ffd060',
  aviso: '#c8d8ff',
  trilha: '#f0e8c0',
  trilhaSombra: 'rgb(138 106 72 / 0.7)',
  pulsoFora: 'rgb(255 208 96 / 0.25)',
  pulsoDentro: 'rgb(255 208 96 / 0.4)',
};

const PIN = {
  ativo: { fundo: '#ffd060', luz: '#ffffff', sombra: '#c8b890' },
  aberto: { fundo: '#e8dcc0', luz: '#ffffff', sombra: '#c8b890' },
  bloqueado: { fundo: '#4a3220', luz: '#6e482c', sombra: '#2a1c12' },
} as const;

/** O espaço da Alegreya SC Bold mede 2 px no canvas e as palavras grudam; o Figma mostra mais largo. */
const ENTRE_PALAVRAS_TITULO = 2;
const PONTO_TRILHA = 6;

const naTela = (x: number, y: number, t: Tela) => ({ x: Math.round(x * t.zoom + t.dx), y: Math.round(y * t.zoom + t.dy) });

function ret(ctx: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

/** Placa de madeira com borda de 3 px e cantos recortados. */
function placa(ctx: CanvasRenderingContext2D, r: Ret) {
  const b = M.pinBorda;
  ret(ctx, COR.contorno, r.x + b, r.y, r.largura - 2 * b, b);
  ret(ctx, COR.contorno, r.x + b, r.y + r.altura - b, r.largura - 2 * b, b);
  ret(ctx, COR.contorno, r.x, r.y + b, b, r.altura - 2 * b);
  ret(ctx, COR.contorno, r.x + r.largura - b, r.y + b, b, r.altura - 2 * b);
  ret(ctx, COR.madeira, r.x + b, r.y + b, r.largura - 2 * b, r.altura - 2 * b);
  ret(ctx, COR.madeiraLuz, r.x + b, r.y + b, r.largura - 2 * b, 1);
  ret(ctx, COR.madeiraSombra, r.x + b, r.y + r.altura - b - 1, r.largura - 2 * b, 1);
}

function fonteDe(tipo: TipoTexto, f: Fontes) {
  if (tipo === 'tempo') return `500 ${M.tempoFonte}px ${f.mono}`;
  if (tipo === 'rotulo') return `700 ${M.rotuloFonte}px ${f.titulo}`;
  return `700 ${tipo === 'aviso' ? M.avisoFonte : M.avisoFonteLonge}px ${f.titulo}`;
}

const espacoLetras = (tipo: TipoTexto) => (tipo === 'aviso' ? 2 : tipo === 'avisoLonge' ? 1 : 0);
const espacoPalavras = (tipo: TipoTexto) => (tipo === 'tempo' ? 0 : ENTRE_PALAVRAS_TITULO);

function estilo(ctx: CanvasRenderingContext2D, tipo: TipoTexto, f: Fontes) {
  ctx.font = fonteDe(tipo, f);
  ctx.letterSpacing = `${espacoLetras(tipo)}px`;
  ctx.wordSpacing = `${espacoPalavras(tipo)}px`;
  ctx.fontKerning = 'none';
}

export function medidorDoCanvas(ctx: CanvasRenderingContext2D, f: Fontes): Medidor {
  return (texto, tipo) => {
    ctx.save();
    estilo(ctx, tipo, f);
    const w = ctx.measureText(texto).width;
    ctx.restore();
    return Math.ceil(w);
  };
}

function texto(ctx: CanvasRenderingContext2D, tipo: TipoTexto, f: Fontes, cor: string, t: string, x: number, y: number) {
  ctx.save();
  estilo(ctx, tipo, f);
  ctx.fillStyle = cor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
  ctx.restore();
}

export function desenharTrilhas(ctx: CanvasRenderingContext2D, mk: Marcadores, t: Tela) {
  for (const tr of mk.trilhas) {
    for (const p of tr.pontos) {
      const s = naTela(p.x, p.y, t);
      ret(ctx, COR.trilhaSombra, s.x - 1, s.y - 1, PONTO_TRILHA, PONTO_TRILHA);
      ret(ctx, COR.trilha, s.x - 3, s.y - 3, PONTO_TRILHA, PONTO_TRILHA);
    }
  }
}

export interface OpcoesL7 {
  viewport: { largura: number; altura: number };
  /** Caixa, em mundo, onde o aviso da névoa pode ficar (quadrado inscrito no círculo); null sem névoa. */
  caixaAviso: Ret | null;
}

/** Caixa em mundo para px de tela, nos mesmos inteiros do desenho. */
function caixaNaTela(r: Ret, t: Tela): Ret {
  const x = Math.round(r.x * t.zoom + t.dx);
  const y = Math.round(r.y * t.zoom + t.dy);
  return { x, y, largura: r.largura * t.zoom, altura: r.altura * t.zoom };
}

/** Desenha e devolve o layout (o teste de acerto usa os pins dele). */
export function desenharL7(ctx: CanvasRenderingContext2D, mk: Marcadores, sprites: Sprites, f: Fontes, relogio: RelogioAnim, t: Tela, op: OpcoesL7): LayoutL7 {
  const L = layoutL7(mk, t, medidorDoCanvas(ctx, f), { viewport: op.viewport, caixaCripta: op.caixaAviso ? caixaNaTela(op.caixaAviso, t) : null });
  const b = M.pinBorda;
  const lado = M.pin;
  const dentro = lado - 2 * b;

  // Ordem de desenho inversa à prioridade de colisão: aviso, caixas, rótulos, pins por cima.
  if (L.aviso) {
    const a = L.aviso;
    const tipo: TipoTexto = a.fonte === M.avisoFonte ? 'aviso' : 'avisoLonge';
    texto(ctx, tipo, f, COR.aviso, a.texto, a.ret.x + a.ret.largura / 2, a.ret.y + a.fonte / 2);
    const cadeado = sprites.get('icone-bloqueado');
    if (cadeado) ctx.drawImage(cadeado, a.ret.x + a.ret.largura / 2 - M.avisoCadeado / 2, a.ret.y + a.fonte + 2, M.avisoCadeado, M.avisoCadeado);
  }

  for (const g of L.grupos) {
    const a = animacao('aventureiro', g.grupo.classe);
    const img = sprites.get(g.icone ? 'icone-expedicao' : quadroNoTempo(a, relogio.t, faseDe(g.grupo.expedicao, a.cicloMs), relogio.animado));
    if (img) ctx.drawImage(img, g.x, g.y, g.lado, g.lado);
  }
  for (const c of L.caixas) {
    placa(ctx, c.ret);
    texto(ctx, 'tempo', f, COR.tempo, c.texto, c.ret.x + c.ret.largura / 2, c.ret.y + c.ret.altura / 2 + 1);
  }
  for (const r of L.rotulos) {
    placa(ctx, r.ret);
    texto(ctx, 'rotulo', f, r.pin.estado === 'bloqueado' ? COR.textoApagado : COR.texto, r.texto, r.ret.x + r.ret.largura / 2, r.ret.y + r.ret.altura / 2 + 1);
  }

  for (const p of L.pins) {
    const { x, y } = p;
    const c = PIN[p.estado];
    if (p.estado === 'ativo') {
      ret(ctx, COR.pulsoFora, x - 4, y - 4, lado + 8, lado + 8);
      ret(ctx, COR.pulsoDentro, x, y, lado, lado);
    }
    // Ponta em três degraus (proporcional à caixa de 40).
    ret(ctx, COR.contorno, x + 13, y + 38, 14, 4);
    ret(ctx, COR.contorno, x + 15, y + 42, 10, 4);
    ret(ctx, COR.contorno, x + 17, y + 46, 6, 4);
    // Caixa.
    ret(ctx, COR.contorno, x + b, y, dentro, b);
    ret(ctx, COR.contorno, x + b, y + lado - b, dentro, b);
    ret(ctx, COR.contorno, x, y + b, b, dentro);
    ret(ctx, COR.contorno, x + lado - b, y + b, b, dentro);
    ret(ctx, c.fundo, x + b, y + b, dentro, dentro);
    ret(ctx, c.luz, x + b, y + b, dentro, 2);
    ret(ctx, c.sombra, x + b, y + lado - b - 2, dentro, 2);
    ret(ctx, c.fundo, x + 16, y + 38, 8, 4);
    ret(ctx, c.fundo, x + 18, y + 42, 4, 4);
    // Ícone de 16 desenhado a 1x.
    const icone = sprites.get(p.estado === 'bloqueado' ? 'icone-bloqueado' : 'icone-expedicao');
    if (icone) ctx.drawImage(icone, x + (lado - M.icone) / 2, y + (lado - M.icone) / 2, M.icone, M.icone);
  }
  return L;
}

/** Lê as famílias do next/font e espera as duas carregarem (senão o 1º quadro sai com a fonte errada). */
export async function carregarFontes(): Promise<Fontes> {
  const css = getComputedStyle(document.documentElement);
  const f: Fontes = {
    titulo: css.getPropertyValue('--fonte-titulo').trim() || 'serif',
    mono: css.getPropertyValue('--fonte-numero').trim() || 'monospace',
  };
  // Só a família principal: a de reserva do next/font é local() e falha no fonts.load.
  const principal = (familias: string) => familias.split(',')[0]!.trim();
  await Promise.all([
    document.fonts.load(`700 ${M.rotuloFonte}px ${principal(f.titulo)}`),
    document.fonts.load(`500 ${M.tempoFonte}px ${principal(f.mono)}`),
  ]);
  return f;
}
