// Árvores com vento (versão 2 do mapa): culling pela grade, ordem pelo pé com o
// núcleo, quadro do balanço, sprites, e a arte parada idêntica à original.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { estadoInicial, MAPA, OFICIOS, SLOT_IDS, type SlotId } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import {
  arvoresVisiveis, CELULA_ARVORES, gradeDeArvores, LADO_ARVORE, QUADRO_REPOUSO, quadroDaArvore, spriteDaArvore, spritesDasArvores,
} from '../lib/mapa/arvores';
import { deslocamento, limitarCamera } from '../lib/mapa/camera';
import { camadaObjetos, planoL4, QUADRO_1, type ComandoL4, type Vista } from '../lib/mapa/objetos';
import { areaDoMapa } from '../lib/mapa/visoes';
import { ladrilhosDaFrente, ladrilhosVisiveis, LADO_LADRILHO_FRENTE } from '../lib/mapa/frente';
import { decodificarPng, lerPng, PASTA_MAPA } from './png';

const m = MAPA;
const grade = gradeDeArvores(m);
const cruza = (a: { ox: number; oy: number }, r: { x: number; y: number; largura: number; altura: number }) =>
  a.ox < r.x + r.largura && a.ox + LADO_ARVORE > r.x && a.oy < r.y + r.altura && a.oy + LADO_ARVORE > r.y;
const todas = (r: { x: number; y: number; largura: number; altura: number }) => m.arvores.flatMap((a, i) => (cruza(a, r) ? [i] : []));

describe('culling das árvores (grade de 256)', () => {
  it('a grade tem cada árvore uma vez, e as células cobrem o mapa', () => {
    expect(grade.colunas * CELULA_ARVORES).toBeGreaterThanOrEqual(m.largura);
    expect(grade.linhas * CELULA_ARVORES).toBeGreaterThanOrEqual(m.altura);
    const ids = grade.celulas.flat();
    expect(ids).toHaveLength(m.arvores.length);
    expect(new Set(ids).size).toBe(m.arvores.length);
  });

  it('devolve exatamente as que cruzam a área (igual à busca em todas), em ordem de pé', () => {
    const areas = [
      { x: 0, y: 0, largura: m.largura, altura: m.altura },
      { x: 1100, y: 700, largura: 550, altura: 406 },
      { x: 1300, y: 900, largura: 195, altura: 190 },
      { x: 255, y: 255, largura: 2, altura: 2 },
      { x: -100, y: -100, largura: 300, altura: 300 },
      { x: 2900, y: 2100, largura: 400, altura: 400 },
    ];
    for (let s = 0; s < 40; s++) areas.push({ x: (s * 677) % 2900, y: (s * 431) % 2200, largura: 100 + ((s * 97) % 900), altura: 80 + ((s * 61) % 700) });
    for (const r of areas) {
      const v = arvoresVisiveis(m, grade, r);
      expect(v, JSON.stringify(r)).toEqual(todas(r));
      for (let i = 1; i < v.length; i++) expect(m.arvores[v[i]!]!.y >= m.arvores[v[i - 1]!]!.y).toBe(true);
    }
  });

  it('nas câmeras do jogo só uma parte das 1583 entra no quadro', () => {
    const area = areaDoMapa();
    for (const [vp, zoom, max] of [[{ largura: 1440, altura: 900 }, 1, 700], [{ largura: 876, altura: 712 }, 2, 300], [{ largura: 390, altura: 380 }, 2, 140]] as const) {
      let maior = 0;
      for (let x = 0; x <= m.largura; x += 192) {
        for (let y = 0; y <= m.altura; y += 192) {
          const cam = limitarCamera({ x, y, zoom }, area, vp);
          const d = deslocamento(cam, vp);
          maior = Math.max(maior, arvoresVisiveis(m, grade, { x: -d.x / zoom, y: -d.y / zoom, largura: vp.largura / zoom, altura: vp.altura / zoom }).length);
        }
      }
      expect(maior, `${vp.largura}x${vp.altura} em ${zoom}x`).toBeLessThan(max);
      expect(maior).toBeLessThan(m.arvores.length);
    }
  });
});

describe('árvores no plano da L4', () => {
  const todosSlots = Object.fromEntries(SLOT_IDS.map((id) => [id, { nivel: 1 }])) as Record<SlotId, { nivel: number }>;
  const itens = camadaObjetos(m, todosSlots, OFICIOS.map((oficio) => ({ oficio })));
  const pe = (c: ComandoL4) => (c.tipo === 'arvore' ? c.arvore.y : c.tipo === 'objeto' ? c.item.peY : -1);

  for (const zoom of [1, 2, 3, 4]) {
    it(`${zoom}x: sombras primeiro, depois árvores e objetos numa só ordem de pé; só as visíveis; pixel inteiro`, () => {
      const v: Vista = { dx: -1200 * zoom, dy: -800 * zoom, zoom, largura: 1440, altura: 900 };
      const plano = planoL4(itens, v, { t: 12_345, animado: true }, () => ({ largura: 50, altura: 50 }), [], false, { mapa: m, grade });
      const corpo = plano.filter((c) => c.tipo !== 'sombra');
      expect(plano.findIndex((c) => c.tipo !== 'sombra')).toBe(plano.filter((c) => c.tipo === 'sombra').length);
      for (let i = 1; i < corpo.length; i++) expect(pe(corpo[i]!) >= pe(corpo[i - 1]!), `${i}`).toBe(true);
      const arvs = corpo.filter((c) => c.tipo === 'arvore');
      expect(arvs.map((c) => c.arvore.id)).toEqual(todas({ x: 1200, y: 800, largura: 1440 / zoom, altura: 900 / zoom }).map((i) => m.arvores[i]!.id));
      for (const c of arvs) {
        expect(c.ret).toEqual({ x: c.arvore.ox * zoom + v.dx, y: c.arvore.oy * zoom + v.dy, largura: 48 * zoom, altura: 48 * zoom });
        expect(c.sprite).toMatch(/^arvores\/[a-z_]+_[01]_[1-4]$/);
      }
    });
  }

  it('sem árvores no plano (preview e testes antigos), nada muda', () => {
    const v: Vista = { dx: 0, dy: 0, zoom: 4, largura: 99_999, altura: 99_999 };
    const sem = planoL4(itens, v, QUADRO_1, () => undefined);
    expect(sem.some((c) => c.tipo === 'arvore')).toBe(false);
    expect(sem).toHaveLength(itens.length);
  });

  it('nenhuma árvore cruza o núcleo nem as construções (a regra do núcleo sem vegetação vale)', () => {
    const n = m.nucleo;
    for (const a of m.arvores) expect(cruza(a, n), a.id).toBe(false);
    expect(estadoInicial({ semente: 1, agora: 0 }).mundo.versaoMapa).toBe(2);
  });
});

describe('balanço', () => {
  const D = m.balanco.duracoesMs;
  it('parado (preferência ou movimento reduzido): o quadro de repouso, o desenho pintado', () => {
    for (const a of m.arvores.slice(0, 50)) for (const t of [0, 123, 99_999]) expect(quadroDaArvore(a, D, { t, animado: false })).toBe(QUADRO_REPOUSO);
  });

  it('com vento: quadro 1..4 pelo relógio, com a fase da árvore; a floresta não balança em sincronia', () => {
    const ks = new Set<number>();
    for (let t = 0; t < 1400; t += 10) ks.add(quadroDaArvore(m.arvores[100]!, D, { t, animado: true }));
    expect([...ks].sort()).toEqual([1, 2, 3, 4]);
    // Num instante qualquer, as 1583 se espalham pelos 4 quadros (nenhum com mais de 40%).
    for (const t of [0, 777, 5_000]) {
      const conta = [0, 0, 0, 0];
      for (const a of m.arvores) conta[quadroDaArvore(a, D, { t, animado: true }) - 1]!++;
      for (const n of conta) expect(n / m.arvores.length, `t=${t}`).toBeLessThan(0.4);
    }
  });

  it('64 sprites de 48 x 48: pé e tronco fixos (da linha 24 para baixo), k = 2 e 4 iguais (repouso), só a copa anda', () => {
    const nomes = spritesDasArvores(m);
    expect(nomes).toHaveLength(64);
    for (const nome of nomes) expect(existsSync(join(PASTA_MAPA, `${nome}.png`)), nome).toBe(true);
    for (const v of new Set(m.arvores.map((a) => `${a.variante}_${a.quadro}`))) {
      const [, variante, q] = v.match(/^(.+)_([01])$/)!;
      const ks = [1, 2, 3, 4].map((k) => lerPng(spriteDaArvore({ variante: variante!, quadro: Number(q) as 0 | 1 }, k)));
      for (const s of ks) expect({ largura: s.largura, altura: s.altura }).toEqual({ largura: 48, altura: 48 });
      expect(Buffer.from(ks[1]!.dados).equals(Buffer.from(ks[3]!.dados)), v).toBe(true);
      const tronco = (s: (typeof ks)[number]) => Buffer.from(s.dados.subarray(24 * 48 * 4));
      for (const s of ks) expect(tronco(s).equals(tronco(ks[0]!)), v).toBe(true);
    }
  });
});

describe('arte parada = arte original', () => {
  it('mapa sem árvores + árvores em repouso (ordem do meta) + camada de frente = mapa_base_v1.png, pixel a pixel', () => {
    const base = decodificarPng(readFileSync(join(PASTA_MAPA, 'mapa_base.png')));
    const frente = decodificarPng(readFileSync(join(PASTA_MAPA, 'mapa_frente.png')));
    const original = decodificarPng(readFileSync(join(__dirname, '..', '..', '..', 'docs', 'referencia', 'mapa_base_v1.png')));
    const W = base.largura;
    expect([base.largura, base.altura, frente.largura, original.largura]).toEqual([3072, 2304, 3072, 3072]);
    for (let i = 3; i < base.dados.length; i += 4) if (base.dados[i] !== 255) throw new Error('mapa_base.png com pixel não opaco');
    const o = new Uint8ClampedArray(base.dados);
    const sprites = new Map<string, ReturnType<typeof lerPng>>();
    const pintar = (s: ReturnType<typeof lerPng>, ox: number, oy: number) => {
      for (let y = 0; y < s.altura; y++) {
        for (let x = 0; x < s.largura; x++) {
          const si = (y * s.largura + x) * 4;
          const al = s.dados[si + 3]!;
          if (!al) continue;
          const di = ((oy + y) * W + ox + x) * 4;
          for (let c = 0; c < 3; c++) o[di + c] = Math.round((s.dados[si + c]! * al + o[di + c]! * (255 - al)) / 255);
        }
      }
    };
    for (const a of m.arvores) {
      const nome = spriteDaArvore(a, QUADRO_REPOUSO);
      if (!sprites.has(nome)) sprites.set(nome, lerPng(nome));
      pintar(sprites.get(nome)!, a.ox, a.oy);
    }
    pintar(frente, 0, 0);
    let diferentes = 0;
    for (let p = 0; p < W * base.altura; p++) {
      const i = p * 4;
      if (o[i] !== original.dados[i] || o[i + 1] !== original.dados[i + 1] || o[i + 2] !== original.dados[i + 2]) diferentes++;
    }
    expect(diferentes).toBe(0);
  }, 60_000);
});

describe('camada de frente em ladrilhos', () => {
  const frente = decodificarPng(readFileSync(join(PASTA_MAPA, 'mapa_frente.png')));
  const ls = ladrilhosDaFrente(frente);

  it('os ladrilhos cobrem todos os pixels da camada, sem sair do ladrilho de 64', () => {
    const coberto = new Uint8Array(frente.largura * frente.altura);
    for (const l of ls) {
      expect(Math.floor(l.x / LADO_LADRILHO_FRENTE)).toBe(Math.floor((l.x + l.largura - 1) / LADO_LADRILHO_FRENTE));
      for (let y = l.y; y < l.y + l.altura; y++) for (let x = l.x; x < l.x + l.largura; x++) coberto[y * frente.largura + x] = 1;
    }
    let fora = 0;
    for (let p = 0; p < coberto.length; p++) if (frente.dados[p * 4 + 3] && !coberto[p]) fora++;
    expect(fora).toBe(0);
    // Só os ladrilhos com algum pixel: bem menos que os 1728 do mapa.
    expect(ls.length).toBeGreaterThan(0);
    expect(ls.length).toBeLessThan(1728);
  });

  it('só os visíveis são desenhados', () => {
    const area = { x: 1200, y: 800, largura: 195, altura: 190 };
    const v = ladrilhosVisiveis(ls, area);
    expect(v.length).toBeLessThan(ls.length / 10);
    for (const l of ls) expect(v.includes(l)).toBe(l.x < 1395 && l.x + l.largura > 1200 && l.y < 990 && l.y + l.altura > 800);
  });
});
