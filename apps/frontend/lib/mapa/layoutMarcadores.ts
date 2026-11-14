// Layout da L7 em px de tela (tamanho fixo, não escala com o zoom), com
// colisão por prioridade: pin > rótulo > caixa de tempo > aviso da névoa.
// Quem tem prioridade menor procura o primeiro espaço livre (para cima, para
// baixo ou para o lado) sem cobrir ninguém de prioridade igual ou maior.
// Rótulos e caixas também não saem da janela visível do mapa. Função pura.
// O grupo em marcha também é fixo na tela (decisão do Portão 9): aventureiro de
// 32 px a partir do zoom 2; abaixo disso, o ícone de expedição de 16 px.

import { ESCALA } from '@cronarca/game-core';
import type { EstadoPin, GrupoEmMarcha, Marcadores, Pin, PontoMundo } from './marcadores';
import { formatarRestante } from './marcadores';

export interface Ret {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Medidas em px de tela (redução pedida pelo dono sobre o Figma a 2x). */
export const MEDIDAS = {
  pin: 40,
  pinBorda: 3,
  icone: 16,
  /** Do topo da caixa até a ponta. */
  pinAteAPonta: 50,
  rotuloFonte: 11,
  rotuloAltura: 20,
  rotuloFolga: 20,
  rotuloAbaixoDaPonta: 4,
  tempoFonte: 12,
  tempoAltura: 22,
  tempoFolga: 16,
  /** Lado do aventureiro do grupo em marcha, em px de tela: o da tabela de escala, fixo em qualquer zoom. */
  aventureiro: ESCALA.aventureiro,
  /** Abaixo deste zoom o grupo vira o ícone de expedição (16 px, o mesmo dos pins). */
  zoomMinimoAventureiro: 2,
  avisoFonte: 18,
  avisoFonteLonge: 13,
  avisoCadeado: 16,
  /** Abaixo deste zoom só o pin aparece (sem rótulo). */
  zoomMinimoRotulo: 1.5,
  /** Passo e alcance da busca de espaço livre. */
  passoBusca: 4,
  alcanceBusca: 240,
  /** Respiro entre itens que se evitam. */
  respiro: 2,
} as const;

export type TipoTexto = 'rotulo' | 'tempo' | 'aviso' | 'avisoLonge';
/** Largura do texto em px na fonte do tipo (o canvas mede; os testes aproximam). */
export type Medidor = (texto: string, tipo: TipoTexto) => number;

export interface Tela {
  dx: number;
  dy: number;
  zoom: number;
}

export interface PinNaTela {
  pin: Pin;
  estado: EstadoPin;
  /** Canto da caixa do pin (40 x 40); a ponta fica em x + 20, y + 50. */
  x: number;
  y: number;
  ret: Ret;
}

export interface LayoutL7 {
  pins: PinNaTela[];
  rotulos: { pin: Pin; texto: string; ret: Ret }[];
  grupos: { grupo: GrupoEmMarcha; x: number; y: number; lado: number; icone: boolean }[];
  caixas: { texto: string; ret: Ret }[];
  aviso: { texto: string; fonte: number; ret: Ret } | null;
}

const naTela = (p: PontoMundo, t: Tela) => ({ x: Math.round(p.x * t.zoom + t.dx), y: Math.round(p.y * t.zoom + t.dy) });

export function intersecta(a: Ret, b: Ret): boolean {
  return a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura;
}

const dentro = (r: Ret, area: Ret) =>
  r.x >= area.x && r.y >= area.y && r.x + r.largura <= area.x + area.largura && r.y + r.altura <= area.y + area.altura;

const comRespiro = (r: Ret, d: number): Ret => ({ x: r.x - d, y: r.y - d, largura: r.largura + 2 * d, altura: r.altura + 2 * d });

/**
 * Primeiro lugar livre perto do preferido: desloca de 4 em 4 px, tentando
 * para cima, para baixo, para a esquerda e para a direita. Null se não achar.
 */
export function primeiroLivre(preferido: Ret, obstaculos: readonly Ret[], area: Ret | null): Ret | null {
  const livre = (r: Ret) => (!area || dentro(r, area)) && obstaculos.every((o) => !intersecta(r, comRespiro(o, MEDIDAS.respiro)));
  for (let d = 0; d <= MEDIDAS.alcanceBusca; d += MEDIDAS.passoBusca) {
    const tentativas = d === 0 ? [[0, 0]] : [[0, -d], [0, d], [-d, 0], [d, 0], [-d, -d], [d, -d], [-d, d], [d, d]];
    for (const [ox, oy] of tentativas) {
      const r = { ...preferido, x: preferido.x + ox!, y: preferido.y + oy! };
      if (livre(r)) return r;
    }
  }
  return null;
}

const par = (n: number) => 2 * Math.ceil(n / 2);

/** Retângulo de tela da caixa da cripta (onde o aviso tem de ficar). */
export interface OpcoesLayout {
  viewport: { largura: number; altura: number };
  caixaCripta: Ret | null;
}

/**
 * Pés (px de tela) dos grupos que aparecem como aventureiro, para a sombra da
 * L3b. Abaixo do zoom 2 o grupo é o ícone de expedição, que não tem sombra.
 */
export function pesDosGrupos(mk: Marcadores, t: Tela): { x: number; y: number }[] {
  return t.zoom < MEDIDAS.zoomMinimoAventureiro ? [] : mk.grupos.map((g) => naTela(g.pe, t));
}

export function layoutL7(mk: Marcadores, t: Tela, medir: Medidor, op: OpcoesLayout): LayoutL7 {
  const M = MEDIDAS;
  const vp: Ret = { x: 0, y: 0, largura: op.viewport.largura, altura: op.viewport.altura };

  // 1. Pins: fixos (prioridade máxima). Só os que aparecem na tela.
  const pins: PinNaTela[] = [];
  for (const p of [...mk.pins].sort((a, b) => a.ponta.y - b.ponta.y || a.ponta.x - b.ponta.x)) {
    const ponta = naTela(p.ponta, t);
    const x = ponta.x - M.pin / 2;
    const y = ponta.y - M.pinAteAPonta;
    const ret = { x, y, largura: M.pin, altura: M.pinAteAPonta };
    if (!intersecta(ret, vp)) continue;
    pins.push({ pin: p, estado: p.estado, x, y, ret });
  }
  const ocupados: Ret[] = pins.map((p) => p.ret);

  // 2. Rótulos (só a partir de 1,5x), abaixo da ponta, dentro da tela.
  const rotulos: LayoutL7['rotulos'] = [];
  if (t.zoom >= M.zoomMinimoRotulo) {
    for (const p of pins) {
      const largura = par(medir(p.pin.nome, 'rotulo') + M.rotuloFolga);
      const preferido = { x: p.x + M.pin / 2 - largura / 2, y: p.y + M.pinAteAPonta + M.rotuloAbaixoDaPonta, largura, altura: M.rotuloAltura };
      const ret = primeiroLivre(preferido, ocupados, vp);
      if (!ret) continue; // sem espaço: o pin fica sem rótulo (nunca cobre ninguém)
      rotulos.push({ pin: p.pin, texto: p.pin.nome, ret });
      ocupados.push(ret);
    }
  }

  // 3. Grupos (o sprite não entra na colisão) e caixas de tempo.
  const grupos: LayoutL7['grupos'] = [];
  const pedidos: { texto: string; ret: Ret }[] = [];
  for (const g of mk.grupos) {
    const pe = naTela(g.pe, t);
    // Tamanho fixo na tela, sprite a 1x (pixel inteiro). Pé a 90% da altura.
    const icone = t.zoom < M.zoomMinimoAventureiro;
    const lado = icone ? M.icone : M.aventureiro;
    const topo = pe.y - Math.round(lado * 0.9);
    grupos.push({ grupo: g, x: pe.x - lado / 2, y: topo, lado, icone });
    const texto = formatarRestante(g.restanteMs);
    const largura = par(medir(texto, 'tempo') + M.tempoFolga);
    pedidos.push({ texto, ret: { x: pe.x - largura / 2, y: topo - 4 - M.tempoAltura, largura, altura: M.tempoAltura } });
  }
  for (const o of mk.obras) {
    const a = naTela(o.ancora, t);
    const texto = formatarRestante(o.restanteMs);
    const largura = par(medir(texto, 'tempo') + M.tempoFolga);
    pedidos.push({ texto, ret: { x: a.x - largura / 2, y: a.y - 4 - M.tempoAltura, largura, altura: M.tempoAltura } });
  }
  const caixas: LayoutL7['caixas'] = [];
  for (const c of pedidos) {
    if (!intersecta(c.ret, vp)) continue;
    const ret = primeiroLivre(c.ret, ocupados, vp);
    if (!ret) continue;
    caixas.push({ texto: c.texto, ret });
    ocupados.push(ret);
  }

  // 4. Aviso da névoa: dentro da caixa da cripta, no ponto livre mais longe do pin e do rótulo da Cripta.
  let aviso: LayoutL7['aviso'] = null;
  if (mk.avisoNevoa && op.caixaCripta && intersecta(op.caixaCripta, vp)) {
    const fonte = t.zoom >= M.zoomMinimoRotulo ? M.avisoFonte : M.avisoFonteLonge;
    const largura = par(medir(mk.avisoNevoa.texto, t.zoom >= M.zoomMinimoRotulo ? 'aviso' : 'avisoLonge'));
    const altura = fonte + 2 + M.avisoCadeado;
    // Só a parte visível da caixa (o aviso precisa aparecer na tela).
    const C = op.caixaCripta;
    const x0 = Math.max(C.x, 0);
    const y0 = Math.max(C.y, 0);
    const B = { x: x0, y: y0, largura: Math.min(C.x + C.largura, vp.largura) - x0, altura: Math.min(C.y + C.altura, vp.altura) - y0 };
    const daCripta = [
      ...pins.filter((p) => p.pin.id === 'cripta').map((p) => p.ret),
      ...rotulos.filter((r) => r.pin.id === 'cripta').map((r) => r.ret),
    ];
    const centroDe = (r: Ret) => ({ x: r.x + r.largura / 2, y: r.y + r.altura / 2 });
    let melhor: Ret | null = null;
    let melhorDist = -1;
    for (let y = B.y; y + altura <= B.y + B.altura; y += M.passoBusca) {
      for (let x = B.x; x + largura <= B.x + B.largura; x += M.passoBusca) {
        const r = { x, y, largura, altura };
        if (ocupados.some((o) => intersecta(r, comRespiro(o, M.respiro)))) continue;
        const c = centroDe(r);
        const dist = daCripta.length === 0 ? 0 : Math.min(...daCripta.map((o) => Math.hypot(c.x - centroDe(o).x, c.y - centroDe(o).y)));
        if (dist > melhorDist) {
          melhorDist = dist;
          melhor = r;
        }
      }
    }
    // Sem posição livre dentro da caixa: o aviso não aparece (nunca cobre pin, rótulo ou caixa).
    if (melhor) aviso = { texto: mk.avisoNevoa.texto, fonte, ret: melhor };
  }

  return { pins, rotulos, grupos, caixas, aviso };
}
