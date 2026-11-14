// Portão 7c, teste 1 (CRONARCA_MAPA_GRANDE.md, seção 7): o meta valida com
// Zod, e o mapa do jogo sai dele (núcleo, slots, destinos, clicáveis).

import { describe, expect, it } from 'vitest';
import { OFICIOS } from '../data/aventureiros.ts';
import { DESTINOS_IDS } from '../data/expedicoes.ts';
import { ESCALA, POSICOES_ALDEOES, VERSAO_MAPA_ATUAL } from '../data/mapa.ts';
import { SLOT_IDS, SLOTS } from '../data/slots.ts';
import bruto from '../data/mapa_meta.json' with { type: 'json' };
import { recursoDoObjeto } from '../src/acoes.ts';
import { esquemaMetaMapa, MAPA, mapaDaVersao, META_MAPA, objetosDoMapa } from '../src/mapa/meta.ts';
import { novo } from './ajuda.ts';

const copia = () => structuredClone(bruto) as Record<string, unknown> & typeof bruto;

describe('mapa_meta.json', () => {
  it('valida: 3072 x 2304, destinos na área jogável, os 5 de expedição presentes', () => {
    const r = esquemaMetaMapa.safeParse(bruto);
    expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true);
    expect(META_MAPA.largura).toBe(3072);
    expect(META_MAPA.altura).toBe(2304);
    const J = META_MAPA.jogavel;
    for (const id of DESTINOS_IDS) {
      const d = META_MAPA.destinos[id]!;
      expect(d.tipo).toBe('expedicao');
      expect(d.x >= J.x0 && d.x < J.x1 && d.y >= J.y0 && d.y < J.y1, id).toBe(true);
    }
  });

  it('recusa tamanho errado', () => {
    expect(esquemaMetaMapa.safeParse({ ...copia(), largura: 3000 }).success).toBe(false);
    expect(esquemaMetaMapa.safeParse({ ...copia(), altura: 2300 }).success).toBe(false);
  });

  it('recusa destino de expedição ausente ou fora da área jogável', () => {
    const sem = copia();
    delete (sem.destinos as Record<string, unknown>).cripta;
    expect(esquemaMetaMapa.safeParse(sem).success).toBe(false);

    const fora = copia();
    fora.destinos.mina = { ...fora.destinos.mina, x: 100, y: 100 };
    const r = esquemaMetaMapa.safeParse(fora);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain('destino mina fora da área jogável');

    const poi = copia();
    poi.destinos.ruinas = { ...poi.destinos.ruinas, tipo: 'poi' };
    expect(esquemaMetaMapa.safeParse(poi).success).toBe(false);
  });

  it('recusa clicável repetido ou com prefixo errado', () => {
    const rep = copia();
    rep.clicaveis = [...rep.clicaveis, rep.clicaveis[0]!];
    expect(esquemaMetaMapa.safeParse(rep).success).toBe(false);
    const pref = copia();
    pref.clicaveis = [{ ...pref.clicaveis[0]!, id: 'p9999', tipo: 'arvore' }];
    expect(esquemaMetaMapa.safeParse(pref).success).toBe(false);
  });

  it('ignora campos que o jogo não usa (semente da ferramenta)', () => {
    expect('semente' in META_MAPA).toBe(false);
  });
});

describe('mapa do jogo', () => {
  it('slots = spec do mapa (seção 5) + origemNucleo, todos dentro do núcleo', () => {
    const O = META_MAPA.origemNucleo;
    const N = MAPA.nucleo;
    expect(MAPA.slots.map((s) => s.id)).toEqual(SLOT_IDS);
    for (const s of MAPA.slots) {
      expect(s).toEqual({ id: s.id, tipo: SLOTS[s.id].tipo, x: SLOTS[s.id].x + O.x, y: SLOTS[s.id].y + O.y });
      expect(s.x >= N.x && s.y >= N.y && s.x + 48 <= N.x + N.largura && s.y + 48 <= N.y + N.altura, s.id).toBe(true);
    }
  });

  it('5 destinos de expedição e 4 pontos decorativos', () => {
    expect(MAPA.destinos.map((d) => d.id)).toEqual(DESTINOS_IDS);
    expect(MAPA.pois.map((p) => p.id).sort()).toEqual(['acampamento', 'aldeia', 'menires', 'torre_velha']);
  });

  it('clicáveis: 1206 árvores (madeira) e 249 pedras (pedra, minério incluso)', () => {
    const arvores = MAPA.clicaveis.filter((c) => c.tipo === 'arvore');
    const pedras = MAPA.clicaveis.filter((c) => c.tipo === 'pedra');
    expect(arvores).toHaveLength(1206);
    expect(pedras).toHaveLength(249);
    expect(arvores.every((c) => c.recurso === 'madeira')).toBe(true);
    expect(pedras.every((c) => c.recurso === 'pedra')).toBe(true);
    expect(pedras.filter((c) => c.variante === 'pedra_minerio')).toHaveLength(3);
  });

  it('caixa do clicável: centrada no pé, base no pé, w x h do meta', () => {
    const c = MAPA.clicaveis.find((x) => x.id === 'a0000')!;
    const m = META_MAPA.clicaveis.find((x) => x.id === 'a0000')!;
    expect(c.caixa).toEqual({ x: m.x - Math.floor(m.w / 2), y: m.y - m.h, largura: m.w, altura: m.h });
  });

  it('contorno do hover: <variante>_<quadro> no canto (cx, cy) do meta, envolvendo a caixa', () => {
    for (const m of META_MAPA.clicaveis) {
      const c = MAPA.clicaveis.find((x) => x.id === m.id)!;
      expect(c.contorno).toEqual({ nome: `${m.variante}_${m.quadro}`, x: m.cx, y: m.cy });
      expect(c.contorno.x <= c.caixa.x && c.contorno.y <= c.caixa.y, m.id).toBe(true);
    }
  });

  it('recusa quadro fora de 0 e 1, e contorno que não envolve a caixa', () => {
    const q = copia();
    q.clicaveis = [{ ...q.clicaveis[0]!, quadro: 2 }];
    expect(esquemaMetaMapa.safeParse(q).success).toBe(false);
    const fora = copia();
    const c0 = fora.clicaveis[0]!;
    fora.clicaveis = [{ ...c0, cx: c0.x }];
    const r = esquemaMetaMapa.safeParse(fora);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain(`contorno não envolve a caixa: ${c0.id}`);
    const sem = copia();
    const { cx: _cx, ...semCx } = sem.clicaveis[0]!;
    sem.clicaveis = [semCx as typeof c0];
    expect(esquemaMetaMapa.safeParse(sem).success).toBe(false);
  });

  it('props do núcleo continuam como sprites, com os ids de antes', () => {
    expect(MAPA.props.map((p) => p.id)).toEqual(['poco_1', 'fogueira_1', 'cerca_1', 'flores_1', 'flores_2', 'flores_3', 'flores_4', 'flores_5']);
  });

  it('aldeões: um lugar por ofício (sem "Sem função"), posição do Figma + origem do núcleo, dentro do núcleo', () => {
    const O = META_MAPA.origemNucleo;
    const N = MAPA.nucleo;
    expect(MAPA.aldeoes.map((a) => a.oficio)).toEqual(OFICIOS);
    expect(OFICIOS).toHaveLength(5);
    for (const a of MAPA.aldeoes) {
      const p = POSICOES_ALDEOES[a.oficio];
      expect(a).toEqual({ oficio: a.oficio, x: p.x + O.x + ESCALA.aldeao / 2, y: p.y + O.y + 28 });
      expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
      expect(p.x + O.x >= N.x && p.y + O.y >= N.y && p.x + O.x + 32 <= N.x + N.largura && p.y + O.y + 32 <= N.y + N.altura, a.oficio).toBe(true);
    }
  });

  it('tabela de escala única: multiplicador 1, só os lados da spec (seção 2)', () => {
    expect(ESCALA).toEqual({ construcao: 48, poco: 32, fogueira: 32, aldeao: 32, aventureiro: 32, flores: 16, cerca: 16, arvore: 48 });
  });

  it('o clique confere o objeto contra a lista do meta', () => {
    const e = novo();
    const objetos = objetosDoMapa();
    expect(Object.keys(objetos)).toHaveLength(1455);
    expect(recursoDoObjeto(e, 'a0000', { objetosDoMapa: objetos })).toBe('madeira');
    expect(recursoDoObjeto(e, 'p1454', { objetosDoMapa: objetos })).toBe('pedra');
    expect(recursoDoObjeto(e, 'a9999', { objetosDoMapa: objetos })).toBeNull();
  });

  it('versões do mapa: a 1 (saves antigos) e a 2 abrem o mesmo mapa; o jogo novo começa na 2', () => {
    expect(META_MAPA.versaoMapa).toBe(2);
    expect(VERSAO_MAPA_ATUAL).toBe(2);
    expect(mapaDaVersao(1)).toBe(MAPA);
    expect(mapaDaVersao(2)).toBe(MAPA);
    expect(() => mapaDaVersao(3 as 1)).toThrow(/desconhecida/);
    expect(novo().mundo).toEqual({ versaoMapa: 2 });
  });
});

describe('árvores com vento (versão 2 do meta)', () => {
  it('1583 árvores, ids únicos, em ordem de pé', () => {
    expect(MAPA.arvores).toHaveLength(1583);
    expect(new Set(MAPA.arvores.map((a) => a.id)).size).toBe(1583);
    for (let i = 1; i < MAPA.arvores.length; i++) expect(MAPA.arvores[i]!.y >= MAPA.arvores[i - 1]!.y).toBe(true);
  });

  it('clicavel aponta para árvores existentes de clicaveis, cada uma uma vez, no mesmo pé e desenho; 377 decorativas', () => {
    const porId = new Map(MAPA.clicaveis.map((c) => [c.id, c]));
    const ligadas = MAPA.arvores.filter((a) => a.clicavel !== null);
    expect(ligadas).toHaveLength(1206);
    expect(MAPA.arvores.filter((a) => a.clicavel === null)).toHaveLength(377);
    expect(new Set(ligadas.map((a) => a.clicavel)).size).toBe(1206);
    for (const a of ligadas) {
      const c = porId.get(a.clicavel!)!;
      expect(c, a.id).toBeDefined();
      expect([c.tipo, c.x, c.y, c.variante, c.contorno.nome], a.id).toEqual(['arvore', a.x, a.y, a.variante, `${a.variante}_${a.quadro}`]);
    }
    expect(MAPA.clicaveis.filter((c) => c.tipo === 'arvore')).toHaveLength(1206);
  });

  it('o sprite de 48 apoia o pé dentro dele (ox, oy é o canto)', () => {
    for (const a of MAPA.arvores) {
      expect(a.x - a.ox, a.id).toBe(24);
      expect(a.y - a.oy >= 40 && a.y - a.oy < 48, a.id).toBe(true);
    }
  });

  it('balanço: durações por quadro, e o esquema recusa árvore órfã, repetida ou fora de ordem', () => {
    expect(MAPA.balanco.duracoesMs).toEqual([300, 400, 300, 400]);
    const parse = (f: (m: typeof bruto) => void) => { const m = copia(); f(m); return esquemaMetaMapa.safeParse(m).success; };
    expect(parse(() => {})).toBe(true);
    expect(parse((m) => { m.arvores[5]!.clicavel = 'a9999'; })).toBe(false);
    expect(parse((m) => { m.arvores[6]!.id = m.arvores[5]!.id; })).toBe(false);
    expect(parse((m) => { m.arvores.reverse(); })).toBe(false);
    expect(parse((m) => { m.arvores = m.arvores.filter((a) => a.clicavel !== 'a0000'); })).toBe(false);
    expect(parse((m) => { m.balanco.duracoesMs = [300]; })).toBe(false);
  });
});
