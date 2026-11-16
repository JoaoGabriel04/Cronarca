import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { animacao } from '@cronarca/game-core';
import { CENA_INICIO, CENA_LOGIN, ESCALAS_DA_CENA, JANELA_NO_FUNDO, SPRITES_DA_CENA, ladoDaArte } from '../components/cena/dados';
import { lerPng } from './png';
import { ESCALAS_K, SCRIPT_ESCALA, escalaDaTela, pixelsDeTelaPorPixelDeArte } from '../components/cena/escala';

const PUBLIC = join(__dirname, '..', 'public');
const desenhos = (d: typeof CENA_INICIO) => [...d.sprites, ...d.celular.sprites];

// Tabela do Figma (Telas v2, "Início - Desktop"/"Login - Desktop"), 1440x900: [nome, k, x, y].
const FIGMA_INICIO: [string, number, number, number][] = [
  ['pinho1', 3, 250, 470], ['pinho0', 3, 400, 455], ['pinho0', 3, 980, 470], ['castelo', 4, 528, 222],
  ['pinho0', 4, -20, 420], ['pinho1', 4, 1230, 430], ['cavaleiro', 4, 60, 662], ['fogueira', 4, 230, 752],
  ['flores', 4, 1010, 776], ['flores', 4, 1300, 816],
  ['cerca', 4, 1130, 776], ['cerca', 4, 1194, 776], ['cerca', 4, 1258, 776], ['cerca', 4, 1322, 776],
  ['placa', 4, 1280, 632],
];
const FIGMA_LOGIN: [string, number, number, number][] = [
  ['pinho1', 3, 250, 470], ['pinho0', 3, 400, 455], ['castelo', 4, 528, 222], ['pinho0', 4, -20, 420],
  ['cavaleiro', 4, 60, 662], ['fogueira', 4, 230, 752],
];
const tabela = (d: typeof CENA_INICIO) => d.sprites.map((s) => [s.nome, s.k, s.x, s.y]);

describe('cena: lista fechada e arquivos', () => {
  it('só renderiza sprites da lista fechada, nunca SVG', () => {
    for (const d of [CENA_INICIO, CENA_LOGIN]) for (const s of desenhos(d)) expect(SPRITES_DA_CENA).toContain(s.nome);
    expect([...SPRITES_DA_CENA].sort()).toEqual(['castelo', 'cavaleiro', 'cerca', 'flores', 'fogueira', 'pinho0', 'pinho1', 'placa']);
    for (const nome of SPRITES_DA_CENA) {
      const a = animacao('cena', nome);
      for (const url of a.quadros) {
        expect(url).not.toMatch(/\.svg$/);
        expect(existsSync(join(PUBLIC, url)), url).toBe(true);
      }
      expect(a.duracoesMs.length).toBe(a.quadros.length);
    }
    expect(CENA_INICIO.fundo).toBe('/cenas/inicio_largo.png');
    expect(CENA_LOGIN.fundo).toBe('/cenas/inicio_largo.png');
  });
  it('nenhum fundo antigo: o inicio.png e os SVGs de cena não existem nem são referenciados', () => {
    expect(existsSync(join(PUBLIC, 'cenas', 'inicio.png'))).toBe(false);
    for (const nome of ['inicio_largo.png']) expect(existsSync(join(PUBLIC, 'cenas', nome))).toBe(true);
    const fontes = ['components/cena/Cena.tsx', 'components/cena/dados.ts', 'app/globals.css'].map((f) => readFileSync(join(__dirname, '..', f), 'utf8')).join('\n');
    expect(fontes).not.toMatch(/cenas\/inicio\.png|FAIXAS_|gradienteDaBorda/);
  });
});

describe('cena: posições do Figma', () => {
  it('Início desktop e Login desktop batem com a tabela', () => {
    expect(tabela(CENA_INICIO)).toEqual(FIGMA_INICIO);
    expect(tabela(CENA_LOGIN)).toEqual(FIGMA_LOGIN);
  });
  it('sem pinhos de longe: a fileira já faz parte do fundo', () => {
    expect(CENA_INICIO.sprites.filter((s) => s.nome.startsWith('pinho')).length).toBe(5);
  });
  it('celular (390x844): posições e escala 3x de personagens e objetos', () => {
    const c = CENA_INICIO.celular.sprites.map((s) => [s.nome, s.k, s.ancora, s.dx, s.y]);
    expect(c).toEqual([
      ['pinho0', 3, 'esq', -50, 270], ['pinho1', 3, 'dir', -50, 280], ['castelo', 4, 'centro', 0, 0],
      ['cavaleiro', 3, 'esq', 10, 406], ['fogueira', 3, 'esq', 118, 414], ['flores', 3, 'dir', 52, 454], ['flores', 3, 'dir', 12, 470],
    ]);
    expect(CENA_LOGIN.celular.sprites.map((s) => s.nome)).toEqual(['castelo']);
  });
  it('só as escalas 3 e 4 no desktop', () => {
    expect([...ESCALAS_DA_CENA]).toEqual([3, 4]);
    expect([...ESCALAS_K]).toEqual([3, 4]);
    for (const s of CENA_INICIO.sprites) expect([3, 4]).toContain(s.k);
  });
  it('castelo 96 de arte, 8 quadros', () => {
    expect(ladoDaArte('castelo')).toBe(96);
    expect(animacao('cena', 'castelo').quadros.length).toBe(8);
  });
});

describe('cena: pixel inteiro em toda escala', () => {
  it('n é inteiro para u de 3 a 8 e k em {3,4}', () => {
    for (let u = 3; u <= 8; u++) for (const k of ESCALAS_K) expect(Number.isInteger(pixelsDeTelaPorPixelDeArte(k, u))).toBe(true);
    expect([3, 4].map((k) => pixelsDeTelaPorPixelDeArte(k, 6))).toEqual([3, 4]);
  });
  it('o script do <head> calcula o mesmo que as funções puras', () => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [900, 500]]) {
      const props: Record<string, string> = {};
      const doc = { documentElement: { style: { setProperty: (k: string, v: string) => (props[k] = v) } } };
      new Function('document', 'innerWidth', 'innerHeight', 'addEventListener', SCRIPT_ESCALA)(doc, w, h, () => {});
      const u = escalaDaTela(w!, h!);
      expect(props['--u']).toBe(`${u}px`);
      for (const k of ESCALAS_K) expect(Number(props[`--e${k}`]) * u).toBeCloseTo(pixelsDeTelaPorPixelDeArte(k, u) * 6, 9);
    }
  });
  it('registra em quais u o 4x e o 3x arredondam para o mesmo valor', () => {
    const iguais = [3, 4, 5, 6, 7, 8].filter((u) => pixelsDeTelaPorPixelDeArte(3, u) === pixelsDeTelaPorPixelDeArte(4, u));
    expect(iguais).toEqual([3, 5]);
  });
});

describe('cena: fundo largo', () => {
  const png = lerPng('/cenas/inicio_largo.png');
  it('420x210 de arte; a janela central de 240x150 está em (90,30)', () => {
    expect([png.largura, png.altura]).toEqual([420, 210]);
    expect(JANELA_NO_FUNDO).toEqual({ x: 90, y: 30, largura: 420, altura: 210 });
    expect(JANELA_NO_FUNDO.x * 6).toBe(540); // left -540 no palco
    expect(JANELA_NO_FUNDO.y * 6).toBe(180); // top -180 no palco
  });
  it('sem emenda entre a janela central e a sangria (colunas 89/90 e 329/330; linhas 29/30 e 179/180)', () => {
    const px = (x: number, y: number) => [0, 1, 2].map((c) => png.dados[(y * png.largura + x) * 4 + c]!);
    const dif = (a: number[], b: number[]) => a.reduce((t, v, i) => t + Math.abs(v - b[i]!), 0);
    const media = (pares: [number, number, number, number][]) => pares.reduce((t, [x1, y1, x2, y2]) => t + dif(px(x1, y1), px(x2, y2)), 0) / pares.length;
    const vizinhas: [number, number, number, number][] = [];
    for (let y = 0; y < 210; y++) for (let x = 20; x < 400; x += 7) vizinhas.push([x, y, x + 1, y]);
    const base = media(vizinhas);
    for (const colunaDaEmenda of [89, 329]) {
      const pares: [number, number, number, number][] = [];
      for (let y = 0; y < 210; y++) pares.push([colunaDaEmenda, y, colunaDaEmenda + 1, y]);
      expect(media(pares), `coluna ${colunaDaEmenda}`).toBeLessThan(base * 2 + 6);
    }
    for (const linhaDaEmenda of [29, 179]) {
      const pares: [number, number, number, number][] = [];
      for (let x = 0; x < 420; x++) pares.push([x, linhaDaEmenda, x, linhaDaEmenda + 1]);
      expect(media(pares), `linha ${linhaDaEmenda}`).toBeLessThan(base * 2 + 6);
    }
  });
  it('cobre janelas de ~1,15:1 a ~2,8:1 com u = floor(min(W/240, H/150))', () => {
    for (const [w, h] of [[1864, 935], [1920, 1080], [1440, 900], [1280, 720], [2560, 1080], [1024, 768]]) {
      const u = escalaDaTela(w!, h!);
      expect(420 * u, `${w}x${h} largura`).toBeGreaterThanOrEqual(w!);
      expect(210 * u, `${w}x${h} altura`).toBeGreaterThanOrEqual(h!);
    }
  });
});
