import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  animacao, CONSTRUCOES, MAPA, META_MAPA, SLOT_IDS, SLOTS, HITBOX_CONSTRUCAO, HITBOX_MINIMA_TELA, LIMITE_ARRASTO_PX, RAIO_ACERTO_PIXEL_TELA, TILE,
  TOLERANCIA_MOUSE_PX, type SlotId,
} from '@cronarca/game-core';
import { contornoDilatado, mascaraDe, pertoDoOpaco } from '../lib/mapa/mascaras';
import { lerPng } from './png';
import { describe, expect, it } from 'vitest';
import {
  acertar, clicaveisDoMapa, comMinimo, contornoDoDestaque, spritesDosContornos, contem, hitboxObjeto, hitboxSlot, iniciarGesto, moverGesto, ponteiroDe, pontoNoCanvas, slotsVazios, soltarGesto,
  type Cena, type Clicavel,
} from '../lib/mapa/acerto';
import { estadoInicial, liquidar, preverAcao, visaoDoCliente } from '@cronarca/game-core';
import { estadoDeExemplo } from '../lib/mapa/exemplo';
import { marcadores } from '../lib/mapa/marcadores';
import type { Ret } from '../lib/mapa/layoutMarcadores';
import { camadaObjetos } from '../lib/mapa/objetos';

const VP = { largura: 876, altura: 712 };
const identidade = (zoom: number) => (p: { x: number; y: number }) => ({ x: p.x / zoom, y: p.y / zoom });
const m = MAPA;
// Um ponto qualquer bem dentro da área jogável, em mundo.
const DENTRO = { x: m.jogavel.x + 2 * TILE, y: m.jogavel.y + 2 * TILE };

function cena(parcial: Partial<Cena>): Cena {
  return { pins: [], clicaveis: [], vazios: [], paraMundo: identidade(1), zoom: 1, ponteiro: 'mouse', ...parcial };
}

/** Clicável sintético com hitbox em mundo (só pela caixa). */
const alvo = (id: string, hitbox: Ret): Clicavel => ({ id, recurso: 'madeira', hitbox, origem: { x: hitbox.x, y: hitbox.y }, sprite: '', porPixel: false });

describe('hitboxes dos dados', () => {
  it('as 10 construções têm hitbox dentro do sprite', () => {
    for (const [tipo, hb] of Object.entries(HITBOX_CONSTRUCAO)) {
      expect(hb.x >= 0 && hb.y >= 0 && hb.x + hb.largura <= 48 && hb.y + hb.altura <= 48, tipo).toBe(true);
    }
    expect(Object.keys(HITBOX_CONSTRUCAO)).toHaveLength(10);
  });

  it('árvores e pedras da imagem e construções de pé entram no teste de acerto; só as produtoras coletam', () => {
    const e = estadoDeExemplo(0);
    const c = clicaveisDoMapa(m, camadaObjetos(m, e.slots));
    const construidas = SLOT_IDS.filter((id) => e.slots[id].nivel >= 1);
    expect(c.filter((x) => !(x.id in SLOTS))).toHaveLength(1455);
    expect(c.filter((x) => x.id in SLOTS).map((x) => x.id).sort()).toEqual([...construidas].sort());
    // Imagem: a caixa x, y, w, h do meta, só pela caixa; madeira das árvores, pedra das pedras.
    for (const x of c.filter((x) => !(x.id in SLOTS))) {
      const fonte = m.clicaveis.find((k) => k.id === x.id)!;
      expect(x.hitbox).toEqual(fonte.caixa);
      expect(x.porPixel).toBe(false);
      expect(x.recurso).toBe(fonte.tipo === 'arvore' ? 'madeira' : 'pedra');
    }
    // As da imagem vêm antes (por baixo da L4), na ordem do pé.
    const imagem = c.filter((x) => !(x.id in SLOTS)).map((x) => m.clicaveis.find((k) => k.id === x.id)!.y);
    expect(imagem).toEqual([...imagem].sort((a, b) => a - b));
    expect(c.findIndex((x) => x.id in SLOTS)).toBe(1455);
    expect(c.find((x) => x.id === 'serraria_1')?.recurso).toBe('madeira');
    // Casa, armazém e celeiro abrem o Melhorar: entram, mas não rendem nada no clique.
    for (const x of c.filter((x) => x.id in SLOTS)) {
      const dados = CONSTRUCOES[SLOTS[x.id as SlotId].tipo];
      expect(x.recurso, x.id).toBe(dados.producao && !dados.cliqueAbre ? dados.producao.recurso : null);
    }
    // Props do núcleo (flores, poço...) não são clicáveis.
    expect(c.every((x) => !m.props.some((p) => p.id === x.id))).toBe(true);
  });

  it('o Scriptorium entra como construção (abre a Pesquisa) e não coleta saber', () => {
    const e = estadoDeExemplo(0);
    const c = clicaveisDoMapa(m, camadaObjetos(m, { ...e.slots, scriptorium_1: { nivel: 2 } }));
    const s = c.find((x) => x.id === 'scriptorium_1')!;
    expect(s.recurso).toBeNull();
    const unico = cena({ clicaveis: [s], zoom: 4, paraMundo: identidade(4) });
    const centro = { x: (s.hitbox.x + s.hitbox.largura / 2) * 4, y: (s.hitbox.y + s.hitbox.altura / 2) * 4 };
    expect(acertar(unico, centro)).toEqual({ tipo: 'construcao', slotId: 'scriptorium_1' });
  });
});

describe('teste de acerto', () => {
  const r: Ret = { x: DENTRO.x, y: DENTRO.y, largura: 60, altura: 60 };

  it('dentro, na borda e fora', () => {
    // Toque: 60 px já passa dos 44, então a hitbox é a própria (sem a folga do mouse).
    const c = cena({ clicaveis: [alvo('a', r)], ponteiro: 'toque' });
    expect(acertar(c, { x: r.x + 30, y: r.y + 30 })?.tipo).toBe('objeto');
    expect(acertar(c, { x: r.x, y: r.y })).toMatchObject({ id: 'a' }); // borda de cima e da esquerda conta
    expect(acertar(c, { x: r.x + 59.9, y: r.y + 59.9 })).toMatchObject({ id: 'a' });
    expect(acertar(c, { x: r.x + 60, y: r.y + 30 })).toBeNull(); // fim é exclusivo
    expect(acertar(c, { x: r.x - 1, y: r.y + 30 })).toBeNull();
  });

  it('em cada tipo real de clicável: centro da hitbox acerta, fora dela não', () => {
    const itens = camadaObjetos(m, Object.fromEntries(m.slots.map((x) => [x.id, { nivel: 1 }])));
    const clic = clicaveisDoMapa(m, itens);
    // Uma amostra de cada variante da imagem e todas as construções.
    const variantes = new Map(m.clicaveis.map((k) => [k.variante, k.id]));
    const amostra = clic.filter((c) => c.id in SLOTS || [...variantes.values()].includes(c.id));
    expect(amostra.length).toBe(variantes.size + SLOT_IDS.length);
    {
      for (const c of amostra) {
        const unico = cena({ clicaveis: [c], zoom: 4, paraMundo: identidade(4) });
        const centro = { x: (c.hitbox.x + c.hitbox.largura / 2) * 4, y: (c.hitbox.y + c.hitbox.altura / 2) * 4 };
        expect(acertar(unico, centro), c.id).toMatchObject(c.recurso ? { tipo: 'objeto', id: c.id } : { tipo: 'construcao', slotId: c.id });
        // A 4x a hitbox já passa de 44 px de tela: logo fora dela não acerta.
        const fora = { x: (c.hitbox.x + c.hitbox.largura + 2) * 4, y: centro.y };
        expect(acertar(unico, fora), c.id).toBeNull();
      }
    }
  });

  it('objetos sobrepostos: o da frente (último desenhado) vence', () => {
    const tras = alvo('tras', r);
    const frente = alvo('frente', { ...r, x: r.x + 20, y: r.y + 20 });
    const p = { x: r.x + 30, y: r.y + 30 };
    expect(acertar(cena({ clicaveis: [tras, frente] }), p)).toMatchObject({ id: 'frente' });
    expect(acertar(cena({ clicaveis: [frente, tras] }), p)).toMatchObject({ id: 'tras' });
    expect(acertar(cena({ clicaveis: [tras, frente] }), { x: r.x + 5, y: r.y + 5 })).toMatchObject({ id: 'tras' });
  });

  it('prioridade: pin, depois objeto, depois slot vazio', () => {
    const p = { x: r.x + 30, y: r.y + 30 };
    const pin = { destino: 'mina' as const, estado: 'bloqueado' as const, ret: { x: p.x - 10, y: p.y - 10, largura: 40, altura: 50 } };
    const vazio = { slotId: 'forja_1' as const, area: r };
    const objeto = alvo('arvore_1', r);
    expect(acertar(cena({ pins: [pin], clicaveis: [objeto], vazios: [vazio] }), p)).toEqual({ tipo: 'pin', destino: 'mina', estado: 'bloqueado' });
    expect(acertar(cena({ clicaveis: [objeto], vazios: [vazio] }), p)).toMatchObject({ tipo: 'objeto', id: 'arvore_1' });
    expect(acertar(cena({ vazios: [vazio] }), p)).toEqual({ tipo: 'slotVazio', slotId: 'forja_1' });
  });

  it('pin bloqueado também é acertado, com o estado', () => {
    const pin = { destino: 'cripta' as const, estado: 'bloqueado' as const, ret: { x: 10, y: 10, largura: 40, altura: 50 } };
    expect(acertar(cena({ pins: [pin] }), { x: 20, y: 20 })).toEqual({ tipo: 'pin', destino: 'cripta', estado: 'bloqueado' });
  });

  it('hitbox mínima de 44 px de tela em qualquer zoom', () => {
    const pedra: Ret = { x: DENTRO.x, y: DENTRO.y, largura: 21, altura: 15 };
    for (const zoom of [1, 2, 3]) {
      const m = comMinimo(pedra, zoom);
      expect(m.largura * zoom).toBeGreaterThanOrEqual(HITBOX_MINIMA_TELA);
      expect(m.altura * zoom).toBeGreaterThanOrEqual(HITBOX_MINIMA_TELA);
      expect(m.x + m.largura / 2).toBeCloseTo(pedra.x + pedra.largura / 2, 9);
    }
    // Toque a 1x: um ponto 10 px acima da pedra ainda acerta (a hitbox cresceu para 44).
    const c = cena({ clicaveis: [alvo('pedra_1', pedra)], ponteiro: 'toque' });
    expect(acertar(c, { x: pedra.x + 10, y: pedra.y - 10 })).toMatchObject({ id: 'pedra_1' });
  });

  it('pointerType: só mouse é mouse; toque e caneta usam o mínimo de 44 px', () => {
    expect(ponteiroDe('mouse')).toBe('mouse');
    expect(ponteiroDe('touch')).toBe('toque');
    expect(ponteiroDe('pen')).toBe('toque');
  });

  it('mouse: hitbox real mais 4 px de tela, em qualquer zoom', () => {
    const r0: Ret = { x: DENTRO.x, y: DENTRO.y, largura: 21, altura: 15 };
    for (const zoom of [1, 2, 3, 4]) {
      const h = hitboxObjeto(r0, zoom, 'mouse');
      expect((r0.x - h.x) * zoom).toBeCloseTo(TOLERANCIA_MOUSE_PX, 9);
      expect((h.largura - r0.largura) * zoom).toBeCloseTo(2 * TOLERANCIA_MOUSE_PX, 9);
    }
  });

  describe('pedra pequena (caixa de 21 x 15)', () => {
    // Caixa de uma pedra pequena num quadro de 24 em DENTRO.
    const hb = { x: 2, y: 5, largura: 21, altura: 15 };
    const pedra = alvo('pedra_1', { x: DENTRO.x + hb.x, y: DENTRO.y + hb.y, largura: hb.largura, altura: hb.altura });
    const centro = { x: DENTRO.x + 12, y: DENTRO.y + 12 };
    const tela = (zoom: number, p: { x: number; y: number }) => ({ x: p.x * zoom, y: p.y * zoom });
    const com = (zoom: number, ponteiro: 'mouse' | 'toque') => cena({ clicaveis: [pedra], zoom, paraMundo: identidade(zoom), ponteiro });

    it('1x: a 17 px do centro, mouse não acerta e toque acerta', () => {
      const p = tela(1, { x: centro.x + 17, y: centro.y });
      expect(acertar(com(1, 'mouse'), p)).toBeNull();
      expect(acertar(com(1, 'toque'), p)).toMatchObject({ id: 'pedra_1' });
    });

    it('2x: a 17 px de mundo do centro (34 de tela) nenhum acerta, pois 44 px de tela são só 22 de mundo', () => {
      const p = tela(2, { x: centro.x + 17, y: centro.y });
      expect(acertar(com(2, 'mouse'), p)).toBeNull();
      expect(acertar(com(2, 'toque'), p)).toBeNull();
    });

    it('2x: logo abaixo da pedra (fora da real + 4 px, dentro dos 44 px), mouse não acerta e toque acerta', () => {
      // Real termina em y 20 do sprite; mouse em 22; toque (22 de mundo, centrado) em 23,5.
      const p = tela(2, { x: centro.x, y: DENTRO.y + 23 });
      expect(acertar(com(2, 'mouse'), p)).toBeNull();
      expect(acertar(com(2, 'toque'), p)).toMatchObject({ id: 'pedra_1' });
    });
  });

  it('slot vazio: com mouse, um ponto no tile vizinho não o aciona; em qualquer zoom', () => {
        const vazios = slotsVazios(m, estadoDeExemplo(0).slots);
    for (const v of vazios) {
      const s = m.slots.find((x) => x.id === v.slotId)!;
      const meioY = v.area.y + v.area.altura / 2;
      const meioX = v.area.x + v.area.largura / 2;
      const vizinhos = [
        { x: s.x - TILE / 2, y: meioY }, // tile à esquerda do sprite
        { x: s.x + 48 + TILE / 2, y: meioY }, // tile à direita
        { x: meioX, y: s.y - TILE / 2 }, // tile acima
        { x: meioX, y: s.y + 48 + TILE / 2 }, // tile abaixo
      ];
      for (const zoom of [1, 2, 3, 4]) {
        const c = cena({ vazios: [v], zoom, paraMundo: identidade(zoom) });
        expect(acertar(c, { x: meioX * zoom, y: meioY * zoom }), v.slotId).toEqual({ tipo: 'slotVazio', slotId: v.slotId });
        for (const p of vizinhos) expect(acertar(c, { x: p.x * zoom, y: p.y * zoom }), `${v.slotId} ${zoom}x`).toBeNull();
      }
    }
  });

  it('slot vazio: a hitbox é a pegada do sprite do nível 1, sem mínimo para mouse', () => {
        const forja = slotsVazios(m, estadoDeExemplo(0).slots).find((v) => v.slotId === 'forja_1')!;
    const s = m.slots.find((x) => x.id === 'forja_1')!;
    const hb = HITBOX_CONSTRUCAO.forja;
    expect(forja.area).toEqual({ x: s.x + hb.x, y: s.y + hb.y, largura: hb.largura, altura: hb.altura });
    expect(hitboxSlot(forja.area, 1, 'mouse')).toEqual(forja.area);
    expect(hitboxSlot(forja.area, 1, 'toque')).toEqual(comMinimo(forja.area, 1));
  });

  it('todo clicável da imagem tem o pé dentro da área jogável', () => {
    const J = m.jogavel;
    for (const c of m.clicaveis) expect(c.x >= J.x && c.x < J.x + J.largura && c.y >= J.y && c.y < J.y + J.altura, c.id).toBe(true);
  });

  it('slot vazio: nível 0 e sem obra', () => {
        const e = estadoDeExemplo(0);
    const vazios = slotsVazios(m, e.slots).map((v) => v.slotId).sort();
    // Início do ciclo: 4 construídos; a serraria_2 tem a obra de exemplo.
    expect(vazios).toEqual(['forja_1', 'mercado_1', 'muralha_1', 'pedreira_1', 'scriptorium_1', 'taverna_1']);
  });

  it('o ponto do evento compensa a escala CSS do canvas', () => {
    // Canvas mostrado com metade do tamanho (zoom do navegador, layout): o ponto dobra.
    expect(pontoNoCanvas(538, 456, { left: 100, top: 100, width: 438, height: 356 }, VP)).toEqual({ x: 876, y: 712 });
    expect(pontoNoCanvas(100, 100, { left: 100, top: 100, width: 876, height: 712 }, VP)).toEqual({ x: 0, y: 0 });
    expect(contem({ x: 0, y: 0, largura: 1, altura: 1 }, { x: 0.5, y: 0.5 })).toBe(true);
  });
});

describe('arrastar não é clicar (mouse e toque)', () => {
  for (const dispositivo of ['mouse', 'toque']) {
    it(`${dispositivo}: até 6 px é clique, sem pan`, () => {
      let g = iniciarGesto({ x: 100, y: 100 });
      const r = moverGesto(g, { x: 104, y: 104 }); // 5,7 px
      g = r.gesto;
      expect(r.pan).toEqual({ x: 0, y: 0 });
      expect(g.arrastando).toBe(false);
      expect(soltarGesto(g, { x: 104, y: 104 })).toBe('clique');
    });

    it(`${dispositivo}: passou de 6 px vira pan e soltar não gera clique, mesmo voltando ao ponto inicial`, () => {
      let g = iniciarGesto({ x: 100, y: 100 });
      const r1 = moverGesto(g, { x: 100 + LIMITE_ARRASTO_PX + 1, y: 100 });
      g = r1.gesto;
      expect(g.arrastando).toBe(true);
      expect(r1.pan).toEqual({ x: LIMITE_ARRASTO_PX + 1, y: 0 }); // o pan aplica tudo desde o início
      const r2 = moverGesto(g, { x: 100, y: 100 });
      expect(r2.pan).toEqual({ x: -(LIMITE_ARRASTO_PX + 1), y: 0 });
      expect(soltarGesto(r2.gesto, { x: 100, y: 100 })).toBeNull();
    });
  }
});

describe('acerto em duas etapas: caixa e pixel (mouse)', () => {
  // Construção real (casa): sprite 48, telhado com cantos vazios dentro da caixa.
  // A máscara é sempre a do quadro 1 (Portão Animação).
  const Q1 = animacao('construcao', 'casa').quadros[0]!;
  const mascaras = new Map([[Q1, mascaraDe(lerPng(Q1))]]);
  const hb = HITBOX_CONSTRUCAO.casa;
  const casa = (id: string, origem: { x: number; y: number }): Clicavel => ({
    id, recurso: 'madeira', hitbox: { x: origem.x + hb.x, y: origem.y + hb.y, largura: hb.largura, altura: hb.altura },
    origem, sprite: Q1, porPixel: true,
  });
  const com = (clicaveis: Clicavel[], zoom: number, ponteiro: 'mouse' | 'toque') =>
    cena({ clicaveis, zoom, paraMundo: identidade(zoom), ponteiro, mascara: (n) => mascaras.get(n) });
  const O = { x: DENTRO.x, y: DENTRO.y };
  const tela = (zoom: number, x: number, y: number) => ({ x: (O.x + x) * zoom, y: (O.y + y) * zoom });
  const opaco = (x: number, y: number) => mascaras.get(Q1)!.opaco[y * 48 + x] === 1;

  /** Um ponto da caixa da casa sem pixel opaco a menos de `folga` px de sprite. */
  function cantoVazio(folga: number) {
    for (let y = hb.y; y < hb.y + hb.altura; y++) {
      for (let x = hb.x; x < hb.x + hb.largura; x++) {
        let perto = false;
        for (let yy = y - folga; yy <= y + folga && !perto; yy++) for (let xx = x - folga; xx <= x + folga; xx++) if (xx >= 0 && yy >= 0 && xx < 48 && yy < 48 && opaco(xx, yy)) perto = true;
        if (!perto) return { x: x + 0.5, y: y + 0.5 };
      }
    }
    throw new Error('sem canto vazio');
  }

  /** Um pixel opaco do miolo (com os 8 vizinhos também opacos). */
  function miolo() {
    for (let y = hb.y + 10; y < hb.y + hb.altura - 2; y++) {
      for (let x = hb.x + 10; x < hb.x + hb.largura - 2; x++) {
        let cheio = true;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (!opaco(xx, yy)) cheio = false;
        if (cheio) return { x: x + 0.5, y: y + 0.5 };
      }
    }
    throw new Error('sem miolo');
  }

  it('o quadro 1 cabe na caixa e semitransparente não conta', () => {
    {
      const mk = mascaras.get(Q1)!;
      for (let i = 0; i < mk.opaco.length; i++) if (mk.opaco[i]) {
        const x = i % mk.largura, y = Math.floor(i / mk.largura);
        expect(x >= hb.x && x < hb.x + hb.largura && y >= hb.y && y < hb.y + hb.altura).toBe(true);
      }
    }
    expect(mascaraDe({ largura: 1, altura: 1, dados: new Uint8ClampedArray([0, 0, 0, 254]) }).opaco[0]).toBe(0);
  });

  for (const zoom of [1, 2, 4]) {
    it(`${zoom}x: canto vazio da casa não acerta com mouse; o corpo acerta; com toque o canto acerta (caixa de 44)`, () => {
      const p = casa('casa_1', O);
      const canto = cantoVazio(Math.ceil(RAIO_ACERTO_PIXEL_TELA / zoom) + 1);
      const corpo = miolo();
      expect(acertar(com([p], zoom, 'mouse'), tela(zoom, canto.x, canto.y))).toBeNull();
      expect(acertar(com([p], zoom, 'mouse'), tela(zoom, corpo.x, corpo.y))).toMatchObject({ id: 'casa_1' });
      expect(acertar(com([p], zoom, 'toque'), tela(zoom, canto.x, canto.y))).toMatchObject({ id: 'casa_1' });
    });
  }

  it('dilatação: até 3 px de tela de um pixel opaco acerta, além disso não', () => {
    const mk = mascaras.get(Q1)!;
    // Borda esquerda de uma linha do meio da caixa: primeiro opaco da linha.
    const y = hb.y + Math.floor(hb.altura / 2);
    let x = 0;
    while (!mk.opaco[y * mk.largura + x]) x++;
    for (const zoom of [1, 2, 4]) {
      const c = com([casa('casa_1', O)], zoom, 'mouse');
      const dentro = { x: (O.x + x) * zoom - RAIO_ACERTO_PIXEL_TELA, y: (O.y + y + 0.5) * zoom };
      const fora = { x: (O.x + x) * zoom - RAIO_ACERTO_PIXEL_TELA - 1.5, y: (O.y + y + 0.5) * zoom };
      expect(pertoDoOpaco(mk, x - RAIO_ACERTO_PIXEL_TELA / zoom, y + 0.5, zoom, RAIO_ACERTO_PIXEL_TELA)).toBe(true);
      expect(acertar(c, dentro), `${zoom}x dentro`).toMatchObject({ id: 'casa_1' });
      if (!pertoDoOpaco(mk, x - (RAIO_ACERTO_PIXEL_TELA + 1.5) / zoom, y + 0.5, zoom, RAIO_ACERTO_PIXEL_TELA)) expect(acertar(c, fora), `${zoom}x fora`).toBeNull();
    }
  });

  it('sobrepostas: vence a da frente quando o pixel dela está sob o ponteiro', () => {
    const tras = casa('tras', O);
    const frente = casa('frente', { x: O.x + 6, y: O.y + 4 });
    // Ponto opaco nas duas.
    let p: { x: number; y: number } | null = null;
    for (let y = 4 + hb.y; y < hb.y + hb.altura && !p; y++) for (let x = 6 + hb.x; x < hb.x + hb.largura && !p; x++) if (opaco(x, y) && opaco(x - 6, y - 4)) p = { x: x + 0.5, y: y + 0.5 };
    expect(acertar(com([tras, frente], 1, 'mouse'), tela(1, p!.x, p!.y))).toMatchObject({ id: 'frente' });
  });

  it('sobrepostas: ponteiro num vão da da frente cai na de trás', () => {
    const tras = casa('tras', O);
    const frente = casa('frente', { x: O.x + 14, y: O.y });
    const mT = mascaras.get(Q1)!;
    let achado: { x: number; y: number } | null = null;
    for (let y = hb.y; y < hb.y + hb.altura && !achado; y++) {
      for (let x = 14 + hb.x; x < 14 + hb.x + hb.largura && x < 48 && !achado; x++) {
        const naFrente = { x: x - 14 + 0.5, y: y + 0.5 };
        if (mT.opaco[y * 48 + x] && !pertoDoOpaco(mT, naFrente.x, naFrente.y, 1, RAIO_ACERTO_PIXEL_TELA)) achado = { x: x + 0.5, y: y + 0.5 };
      }
    }
    expect(achado).not.toBeNull();
    const p = tela(1, achado!.x, achado!.y);
    expect(contem(hitboxObjeto(frente.hitbox, 1, 'mouse'), { x: p.x, y: p.y })).toBe(true); // a caixa da frente cobre o ponto
    expect(acertar(com([tras, frente], 1, 'mouse'), p)).toMatchObject({ id: 'tras' });
  });

  it('árvores e pedras da imagem só pela caixa x, y, w, h; construções pelo pixel', () => {
    const c = clicaveisDoMapa(m, camadaObjetos(m, { casa_1: { nivel: 1 } }));
    expect(c.filter((x) => !(x.id in SLOTS)).every((x) => !x.porPixel)).toBe(true);
    expect(c.filter((x) => x.id in SLOTS).every((x) => x.porPixel)).toBe(true);
    // Canto da caixa acerta com mouse (a caixa é o teste de clique), fora dela não.
    const arvore = c.find((x) => x.id === 'a0000')!;
    const zoom = 3;
    const unico = cena({ clicaveis: [arvore], zoom, paraMundo: identidade(zoom) });
    expect(acertar(unico, { x: (arvore.hitbox.x + 0.5) * zoom, y: (arvore.hitbox.y + 0.5) * zoom })).toMatchObject({ id: 'a0000' });
    expect(acertar(unico, { x: (arvore.hitbox.x - 3) * zoom, y: (arvore.hitbox.y + 5) * zoom })).toBeNull();
  });

  it('contorno da máscara dilatada: fica a até 3 px de tela do desenho', () => {
    const mk = mascaras.get(Q1)!;
    for (const zoom of [1, 4]) {
      const pontos = contornoDilatado(mk, zoom, RAIO_ACERTO_PIXEL_TELA);
      expect(pontos.length).toBeGreaterThan(0);
      for (const p of pontos.slice(0, 200)) expect(pertoDoOpaco(mk, (p.x + 0.5) / zoom, (p.y + 0.5) / zoom, zoom, RAIO_ACERTO_PIXEL_TELA)).toBe(true);
    }
  });
});

describe('troca do slot vazio pela construção', () => {
  it('ao concluir a obra, a hitbox do slot vazio vira a hitbox de produção; durante a obra, caixa de tempo e nenhum segundo construir', () => {
    const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
    const e = estadoInicial({ semente: 1, agora: T0 });
    e.segredo.proximoEventoEm = T0 + 10 ** 9;
    e.slots.armazem_1.nivel = 3;
    e.recursos.madeira = 600_000_000;
    e.recursos.pedra = 600_000_000;
    e.recursos.ferro = 300_000_000;
    const slot = m.slots.find((x) => x.id === 'forja_1')!;
    const hbForja = HITBOX_CONSTRUCAO.forja;
    const centro = { x: slot.x + hbForja.x + hbForja.largura / 2, y: slot.y + hbForja.y + hbForja.altura / 2 };
    // Só a forja: ela encosta em outras construções (que agora também são clicáveis).
    const cenaDe = (v: { slots: typeof e.slots }) =>
      cena({ clicaveis: clicaveisDoMapa(m, camadaObjetos(m, v.slots)).filter((c) => c.id === 'forja_1'), vazios: slotsVazios(m, v.slots).filter((x) => x.slotId === 'forja_1') });

    // Antes: slot vazio, com a pegada da forja.
    const antes = visaoDoCliente(e);
    expect(acertar(cenaDe(antes), centro)).toEqual({ tipo: 'slotVazio', slotId: 'forja_1' });
    expect(slotsVazios(m, antes.slots).find((v) => v.slotId === 'forja_1')!.area).toEqual({ x: slot.x + hbForja.x, y: slot.y + hbForja.y, largura: hbForja.largura, altura: hbForja.altura });

    // Durante a obra: sai dos vazios, ainda não é clicável, mostra a caixa de tempo e recusa um segundo construir.
    const r = preverAcao(antes, { tipo: 'construir', slot: 'forja_1' }, T0);
    expect(r.ok).toBe(true);
    const obra = r.estado;
    const fim = obra.slots.forja_1.obraAte!;
    expect(fim).toBeGreaterThan(T0);
    expect(slotsVazios(m, obra.slots).some((v) => v.slotId === 'forja_1')).toBe(false);
    expect(clicaveisDoMapa(m, camadaObjetos(m, obra.slots)).some((c) => c.id === 'forja_1')).toBe(false);
    expect(acertar(cenaDe(obra), centro)).toBeNull();
    expect(marcadores(m, obra, T0 + 1000).obras.map((o) => o.slot)).toContain('forja_1');
    expect(preverAcao(obra, { tipo: 'construir', slot: 'forja_1' }, T0 + 1000)).toMatchObject({ ok: false, erro: 'slot_ocupado' });

    // Concluída: clicável com a hitbox de produção da forja, e não é mais slot vazio.
    const pronta = visaoDoCliente(liquidar({ ...obra, segredo: e.segredo }, fim + 1));
    expect(pronta.slots.forja_1).toMatchObject({ nivel: 1, obraAte: null });
    const c = clicaveisDoMapa(m, camadaObjetos(m, pronta.slots)).find((x) => x.id === 'forja_1')!;
    expect(c.hitbox).toEqual({ x: slot.x + hbForja.x, y: slot.y + hbForja.y, largura: hbForja.largura, altura: hbForja.altura });
    expect(c.recurso).toBe('ferro');
    expect(slotsVazios(m, pronta.slots).some((v) => v.slotId === 'forja_1')).toBe(false);
    expect(acertar(cenaDe(pronta), centro)).toMatchObject({ tipo: 'objeto', id: 'forja_1' });
    expect(marcadores(m, pronta, fim + 1).obras.map((o) => o.slot)).not.toContain('forja_1');
  });
});

describe('destaque do hover em árvore e pedra (seção 5b)', () => {
  const a = MAPA.clicaveis.find((c) => c.tipo === 'arvore')!;
  const p = MAPA.clicaveis.find((c) => c.tipo === 'pedra')!;
  const pasta = join(__dirname, '..', 'public', 'mapa');

  it('mouse: o contorno <variante>_<quadro> com o canto em (cx, cy), em pixel inteiro de tela, em 1x a 4x', () => {
    for (const zoom of [1, 2, 3, 4]) {
      const tela = { dx: -1234, dy: 57, zoom };
      for (const c of [a, p]) {
        const r = contornoDoDestaque(MAPA, c.id, 'mouse', tela)!;
        expect(r).toEqual({ sprite: `contornos/${c.contorno.nome}`, x: c.contorno.x * zoom - 1234, y: c.contorno.y * zoom + 57 });
        expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
      }
    }
    // O nome vem da variante e do quadro do meta.
    for (const c of [a, p]) expect(c.contorno.nome).toBe(`${c.variante}_${META_MAPA.clicaveis.find((k) => k.id === c.id)!.quadro}`);
  });

  it('toque não tem destaque; construção e id desconhecido também não (construção tem o realce do sprite)', () => {
    const tela = { dx: 0, dy: 0, zoom: 2 };
    expect(contornoDoDestaque(MAPA, a.id, 'toque', tela)).toBeNull();
    expect(contornoDoDestaque(MAPA, 'serraria_1', 'mouse', tela)).toBeNull();
    expect(contornoDoDestaque(MAPA, null, 'mouse', tela)).toBeNull();
  });

  it('os 24 contornos existem e cada um envolve a caixa de clique do seu clicável', () => {
    const sprites = spritesDosContornos(MAPA);
    expect(sprites).toHaveLength(24);
    const lados = new Map(sprites.map((s) => {
      const b = readFileSync(join(pasta, `${s}.png`));
      return [s, { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) }];
    }));
    for (const c of MAPA.clicaveis) {
      const l = lados.get(`contornos/${c.contorno.nome}`)!;
      const k = c.caixa;
      expect(c.contorno.x <= k.x && c.contorno.y <= k.y && c.contorno.x + l.largura >= k.x + k.largura && c.contorno.y + l.altura >= k.y + k.altura, c.id).toBe(true);
    }
  });
});
