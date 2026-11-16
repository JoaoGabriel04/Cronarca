// Portão Animação: relógio (t -> índice), fase por instância e catálogo do quadros.json.

import { describe, expect, it } from 'vitest';
import bruto from '../data/quadros.json' with { type: 'json' };
import { CLASSES, OFICIOS } from '../data/aventureiros.ts';
import { TIPOS_CONSTRUCAO } from '../data/construcoes.ts';
import { DESTINOS_IDS } from '../data/expedicoes.ts';
import { ESCALA, LADO_SPRITE_ALDEAO, TIPOS_PROP } from '../data/mapa.ts';
import {
  ANIMACOES, animacao, esquemaQuadros, faseDe, indiceNoTempo, montarCatalogo, quadroNoTempo, quadrosDaCena, todosOsQuadros, urlDoQuadro,
} from '../src/animacao.ts';

describe('relógio: t -> índice do quadro', () => {
  const desiguais = [200, 80, 170, 150]; // ciclo 600

  it('durações desiguais: cada quadro cobre o seu intervalo [início, fim)', () => {
    const esperado: [number, number][] = [
      [0, 0], [199, 0], [200, 1], [279, 1], [280, 2], [449, 2], [450, 3], [599, 3],
    ];
    for (const [t, i] of esperado) expect(indiceNoTempo(desiguais, t), `t=${t}`).toBe(i);
  });

  it('volta do ciclo: t e t + k * ciclo dão o mesmo quadro, e 600 volta ao 0', () => {
    expect(indiceNoTempo(desiguais, 600)).toBe(0);
    expect(indiceNoTempo(desiguais, 879)).toBe(1);
    for (let t = 0; t < 600; t += 7) {
      for (const k of [1, 2, 1000, 2_900_000]) expect(indiceNoTempo(desiguais, t + k * 600)).toBe(indiceNoTempo(desiguais, t));
    }
  });

  it('t negativo e fracionário caem no ciclo', () => {
    expect(indiceNoTempo(desiguais, -1)).toBe(3);
    expect(indiceNoTempo(desiguais, -600)).toBe(0);
    expect(indiceNoTempo(desiguais, 199.9)).toBe(0);
    expect(indiceNoTempo(desiguais, Date.UTC(2026, 10, 12) + 280)).toBe(indiceNoTempo(desiguais, (Date.UTC(2026, 10, 12) % 600) + 280));
  });

  it('cada quadro aparece pelo tempo da sua duração em um ciclo', () => {
    const tempo = [0, 0, 0, 0];
    for (let t = 0; t < 600; t++) tempo[indiceNoTempo(desiguais, t)]!++;
    expect(tempo).toEqual(desiguais);
  });

  it('2 quadros de 450 ms: a regra antiga é um caso particular', () => {
    for (let t = 0; t < 5000; t += 37) expect(indiceNoTempo([450, 450], t)).toBe(Math.floor(t / 450) % 2);
  });
});

describe('fase por instância', () => {
  it('estável, dentro do ciclo, e diferente entre ids vizinhos', () => {
    const a = animacao('aldeao', 'lenhador');
    expect(faseDe('aldeao_lenhador', a.cicloMs)).toBe(faseDe('aldeao_lenhador', a.cicloMs));
    const fases = ['serraria_1', 'serraria_2', 'casa_1', 'casa_2', 'aldeao_lenhador', 'aldeao_mineiro'].map((id) => faseDe(id, a.cicloMs));
    for (const f of fases) expect(f >= 0 && f < a.cicloMs).toBe(true);
    expect(new Set(fases).size).toBe(fases.length);
  });

  it('dois do mesmo sprite lado a lado não ficam em fase: em boa parte do ciclo mostram quadros diferentes', () => {
    const a = animacao('construcao', 'serraria');
    const [f1, f2] = [faseDe('serraria_1', a.cicloMs), faseDe('serraria_2', a.cicloMs)];
    let diferentes = 0;
    for (let t = 0; t < a.cicloMs; t++) if (quadroNoTempo(a, t, f1) !== quadroNoTempo(a, t, f2)) diferentes++;
    expect(diferentes).toBeGreaterThan(0);
  });

  it('sem animação, sempre o quadro 1', () => {
    const a = animacao('cenario', 'fogueira');
    for (let t = 0; t < 2000; t += 13) expect(quadroNoTempo(a, t, 123, false)).toBe(a.quadros[0]);
  });
});

describe('quadros.json', () => {
  it('valida no esquema: quadros, durações e arquivos do mesmo tamanho', () => {
    const r = esquemaQuadros.safeParse(bruto);
    expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true);
  });

  it('o esquema recusa contagens que não batem', () => {
    const ruim = structuredClone(bruto) as typeof bruto;
    ruim.aldeao.lenhador.duracoesMs = [100, 100, 100];
    expect(esquemaQuadros.safeParse(ruim).success).toBe(false);
  });

  it('arquivos <nome>_<k>.png com k de 1 a quadros, em ordem', () => {
    for (const [grupo, sprites] of Object.entries(bruto)) {
      for (const [nome, s] of Object.entries(sprites)) {
        expect(s.arquivos, `${grupo}/${nome}`).toEqual(s.arquivos.map((_, k) => `${nome}_${k + 1}.png`));
      }
    }
  });

  it('trocar o JSON muda a animação sem código: o catálogo só reflete os dados', () => {
    const outro = montarCatalogo({ teste: { pisca: { quadros: 3, duracoesMs: [10, 20, 30], tamanho: 32, arquivos: ['pisca_1.png', 'pisca_2.png', 'pisca_3.png'] } } });
    const a = outro.get('teste/pisca')!;
    expect(a).toMatchObject({ cicloMs: 60, quadros: ['/sprites/teste/pisca_1.png', '/sprites/teste/pisca_2.png', '/sprites/teste/pisca_3.png'] });
    expect([0, 10, 30, 59, 60].map((t) => quadroNoTempo(a, t))).toEqual([a.quadros[0], a.quadros[1], a.quadros[2], a.quadros[2], a.quadros[0]]);
  });

  it('cobre o que o jogo desenha: construções, aldeões, aventureiros, props, destinos e o Mercador', () => {
    for (const t of TIPOS_CONSTRUCAO) expect(animacao('construcao', t).tamanho).toBe(ESCALA.construcao);
    for (const o of OFICIOS) expect(animacao('aldeao', o).tamanho).toBe(LADO_SPRITE_ALDEAO);
    for (const c of CLASSES) expect(animacao('aventureiro', c).tamanho).toBe(ESCALA.aventureiro);
    for (const p of TIPOS_PROP) expect(animacao('cenario', p).tamanho).toBe(ESCALA[p]);
    for (const d of DESTINOS_IDS) expect(animacao('expedicao', d).tamanho).toBe(64);
    expect(animacao('evento', 'mercador').tamanho).toBe(64);
    expect(animacao('evento', 'festival_colheita').chave).toBe('evento/festival');
    expect(() => animacao('aldeao', 'inexistente')).toThrow();
  });

  it('jogo: 47 sprites, 202 quadros (45 da entrega + cerca e flores); a cena não entra no pré-carregamento do jogo', () => {
    expect(ANIMACOES.size).toBe(47 + 15); // 15 da cena: os 14 de antes e a cerca (Tela inicial v2)
    expect(todosOsQuadros()).toHaveLength(202);
    expect(new Set(todosOsQuadros()).size).toBe(202);
    expect(animacao('cenario', 'cerca').quadros[1]).toBe(urlDoQuadro('cenario', 'cerca_2.png'));
  });
});

describe('cena do Início e do Login (quadros_cena.json)', () => {
  it('15 sprites e 64 quadros no grupo cena (castelo novo de 8 quadros e a cerca), nomes com dígito aceitos', () => {
    const cena = [...ANIMACOES.values()].filter((a) => a.chave.startsWith('cena/'));
    expect(cena).toHaveLength(15);
    expect(cena.flatMap((a) => a.quadros)).toHaveLength(64);
    expect(animacao('cena', 'pinho0').tamanho).toBe(48);
    expect(animacao('cena', 'arbusto7').quadros[3]).toBe(urlDoQuadro('cena', 'arbusto7_4.png'));
    expect(todosOsQuadros().some((q) => q.startsWith('/sprites/cena/'))).toBe(false);
  });

  it('castelo novo: 96 px, 8 quadros com bandeiras balançando (250/200 ms, ciclo de 1,8 s)', () => {
    const c = animacao('cena', 'castelo');
    expect(c).toMatchObject({ tamanho: 96, duracoesMs: [250, 200, 250, 200, 250, 200, 250, 200], cicloMs: 1_800 });
    expect(c.quadros).toHaveLength(8);
    expect(c.quadros[7]).toBe(urlDoQuadro('cena', 'castelo_8.png'));
  });

  it('cerca na fonte única da cena: 16 px, 2 quadros de 450 ms', () => {
    expect(animacao('cena', 'cerca')).toMatchObject({ tamanho: 16, duracoesMs: [450, 450] });
    expect(animacao('cena', 'cerca').quadros).toEqual([urlDoQuadro('cena', 'cerca_1.png'), urlDoQuadro('cena', 'cerca_2.png')]);
  });

  it('a lista fechada da Tela inicial v2: pinho0 e pinho1 (4), castelo (8), cavaleiro (4), fogueira (6), flores (4), placa (4), cerca (2)', () => {
    const quadros = (nome: string) => quadrosDaCena([nome]).map((q) => q.split('/').pop());
    expect(quadros('castelo')).toEqual(Array.from({ length: 8 }, (_, i) => `castelo_${i + 1}.png`));
    expect(quadros('pinho0')).toHaveLength(4);
    expect(quadros('pinho1')).toHaveLength(4);
    expect(quadros('cavaleiro')).toHaveLength(4);
    expect(quadros('fogueira')).toHaveLength(6);
    expect(quadros('flores')).toHaveLength(4);
    expect(quadros('placa')).toHaveLength(4);
    expect(quadros('cerca')).toEqual(['cerca_1.png', 'cerca_2.png']);
  });
});
