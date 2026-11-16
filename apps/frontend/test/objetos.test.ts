import { existsSync } from 'node:fs';
import {
  animacao, ESCALA, estadoInicial, indiceNoTempo, MAPA, OFICIOS, POSICOES_ALDEOES, POSICOES_OCIOSOS, SLOT_IDS, type Oficio, type OficioAldeao, type SlotId,
} from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { camadaObjetos, nomeDoSprite, planoL4, QUADRO_1, spritesDosObjetos, type NiveisSlots } from '../lib/mapa/objetos';
import { arquivoDoSprite, lerPng } from './png';

const m = MAPA;
const inicio = estadoInicial({ semente: 1, agora: 0 }).slots;
const todos = Object.fromEntries(SLOT_IDS.map((id) => [id, { nivel: 1 }])) as Record<SlotId, { nivel: number }>;
const ofx = (...lista: Oficio[]) => lista.map((oficio) => ({ oficio }));
// O mapa só recebe ofícios produtivos (o CanvasMapa tira os ociosos); o início não tem ociosos.
const aldeoesInicio = ofx(...estadoInicial({ semente: 1, agora: 0 }).aldeoes.map((a) => a.oficio as Oficio));
const cincoOficios = OFICIOS.map((oficio) => ({ oficio }));

describe('L4: props do núcleo, construções e aldeões (o resto está na imagem)', () => {
  it('ordenados pelo Y do pé; empate por x e depois por id (aldeões juntos com o resto)', () => {
    for (const [slots, aldeoes] of [[inicio, aldeoesInicio], [todos, cincoOficios]] as const) {
      const itens = camadaObjetos(m, slots, aldeoes);
      for (let k = 1; k < itens.length; k++) {
        const a = itens[k - 1]!;
        const b = itens[k]!;
        const ok = a.peY < b.peY || (a.peY === b.peY && (a.peX < b.peX || (a.peX === b.peX && a.id < b.id)));
        expect(ok, `${a.id} antes de ${b.id}`).toBe(true);
      }
    }
  });

  it('posição e lado inteiros, lado só da tabela de escala, pé a 90% da altura', () => {
    const porId = new Map(m.props.map((o) => [o.id, o]));
    const lados = new Set<number>(Object.values(ESCALA));
    for (const it of camadaObjetos(m, todos, cincoOficios)) {
      expect(Number.isInteger(it.x) && Number.isInteger(it.y) && Number.isInteger(it.lado)).toBe(true);
      expect(lados.has(it.lado), it.id).toBe(true);
      expect(it.peY).toBe(it.y + Math.floor(it.lado * 0.9));
      const o = porId.get(it.id);
      if (o) {
        expect(it.lado).toBe(ESCALA[o.tipo]);
        expect(it.x).toBe(o.x - it.lado / 2);
      } else if (it.id.startsWith('aldeao_')) {
        expect(it.lado).toBe(ESCALA.aldeao);
      } else {
        expect(it.lado).toBe(ESCALA.construcao);
      }
    }
  });

  it('só props do núcleo, construções e aldeões: nenhuma árvore, pedra ou montanha', () => {
    const ids = camadaObjetos(m, todos, cincoOficios).map((it) => it.id).sort();
    expect(ids).toEqual([...m.props.map((p) => p.id), ...SLOT_IDS, ...OFICIOS.map((o) => `aldeao_${o}`)].sort());
  });

  it('aldeões: um por ofício presente, no máximo 5; sem aldeão, nenhum', () => {
    const aldeoes = (lista: readonly { oficio: Oficio }[]) => camadaObjetos(m, {}, lista).filter((it) => it.id.startsWith('aldeao_')).map((it) => it.id).sort();
    // Início do ciclo: um Fazendeiro e um Lenhador.
    expect(aldeoes(aldeoesInicio)).toEqual(['aldeao_fazendeiro', 'aldeao_lenhador']);
    expect(aldeoes([])).toEqual([]);
    // 40 aldeões em rodízio: 5 figuras, uma por ofício.
    const quarenta = Array.from({ length: 40 }, (_, i) => ({ oficio: OFICIOS[i % 5]! }));
    expect(aldeoes(quarenta)).toHaveLength(5);
    // Repetidos não duplicam a figura.
    expect(aldeoes(ofx('mineiro', 'mineiro', 'mineiro'))).toEqual(['aldeao_mineiro']);
  });

  it('aldeão aparece mesmo sem a construção do ofício (Mineiro sem Pedreira)', () => {
    const itens = camadaObjetos(m, {}, ofx('mineiro'));
    expect(itens.some((it) => it.id === 'pedreira_1')).toBe(false);
    const mineiro = itens.find((it) => it.id === 'aldeao_mineiro')!;
    const p = POSICOES_ALDEOES.mineiro;
    // O pé é o do sprite de 32 na posição do Figma; o canto sai do pé com o lado no mundo (ESCALA.aldeao).
    expect({ x: mineiro.peX, y: mineiro.peY }).toEqual({ x: p.x + m.origemNucleo.x + 16, y: p.y + m.origemNucleo.y + 28 });
    expect({ x: mineiro.x, y: mineiro.y }).toEqual({ x: mineiro.peX - ESCALA.aldeao / 2, y: mineiro.peY - Math.floor(ESCALA.aldeao * 0.9) });
    expect(mineiro.anim.chave).toBe('aldeao/mineiro');
  });

  it('aldeões em qualquer zoom (A6), sempre na escala de mundo: 32, 64, 96 e 128 px, proporcionais às construções', () => {
    const itens = camadaObjetos(m, todos, cincoOficios);
    const tamanhos = (chave: string) => ({ largura: chave.includes('aldeao') ? 40 : 60, altura: 30 });
    for (const zoom of [1, 2, 3, 4]) {
      const v = { dx: 0, dy: 0, zoom, largura: 99_999, altura: 99_999 };
      const plano = planoL4(itens, v, QUADRO_1, tamanhos);
      const aldeoes = plano.filter((c) => c.tipo === 'objeto' && c.item.id.startsWith('aldeao_'));
      const sombras = plano.filter((c) => c.tipo === 'sombra' && c.sprite.includes('aldeao'));
      expect(aldeoes.length + sombras.length, `${zoom}x`).toBe(10); // 5 sombras + 5 aldeões
      for (const a of aldeoes) expect(a.tipo === 'objeto' && a.ret.largura, `${zoom}x`).toBe(ESCALA.aldeao * zoom);
      // Mesma proporção aldeão / construção em todos os zooms (32 / 48).
      const casa = plano.find((c) => c.tipo === 'objeto' && c.item.id === 'casa_1');
      const aldeao = aldeoes[0];
      expect(aldeao?.tipo === 'objeto' && casa?.tipo === 'objeto' && aldeao.ret.largura / casa.ret.largura, `${zoom}x`).toBe(ESCALA.aldeao / ESCALA.construcao);
      expect(plano.filter((c) => c.tipo === 'objeto')).toHaveLength(itens.length);
    }
  });

  it('sprites dos aldeões: os 5 ofícios e o Ocioso em 32 x 32, todos os quadros', () => {
    for (const o of [...OFICIOS, 'ocioso'] as const) {
      for (const q of animacao('aldeao', o).quadros) {
        const img = lerPng(q);
        expect({ largura: img.largura, altura: img.altura }).toEqual({ largura: 32, altura: 32 });
      }
    }
  });

  it('props nas posições da spec (seção 5) somadas à origem do núcleo do meta', () => {
    const poco = camadaObjetos(m, {}).find((it) => it.id === 'poco_1')!;
    expect({ x: poco.x, y: poco.y }).toEqual({ x: 203 + m.origemNucleo.x, y: 236 + m.origemNucleo.y });
  });

  it('construção só em slot de nível 1 ou mais', () => {
    const construidos = (slots: NiveisSlots) => camadaObjetos(m, slots).filter((it) => it.anim.chave.startsWith('construcao/')).map((it) => it.id).sort();
    expect(construidos(inicio)).toEqual(['armazem_1', 'casa_1', 'celeiro_1', 'serraria_1']);
    expect(construidos({})).toEqual([]);
    const nivel3 = Object.fromEntries(SLOT_IDS.map((id) => [id, { nivel: 3 }])) as Record<SlotId, { nivel: number }>;
    expect(construidos(nivel3)).toHaveLength(SLOT_IDS.length);
  });

  it('animação do quadros.json: o quadro sai do relógio com a fase do item', () => {
    const itens = camadaObjetos(m, inicio);
    const poco = itens.find((it) => it.id === 'poco_1')!;
    expect(poco.anim).toBe(animacao('cenario', 'poco'));
    for (let t = 0; t < 3000; t += 50) {
      expect(nomeDoSprite(poco, { t, animado: true })).toBe(poco.anim.quadros[indiceNoTempo(poco.anim.duracoesMs, t + poco.fase)]);
    }
    // Desligada (preferência ou movimento reduzido): sempre o quadro 1.
    for (let t = 0; t < 3000; t += 50) expect(nomeDoSprite(poco, { t, animado: false })).toBe(poco.anim.quadros[0]);
  });

  it('cada item tem a sua fase: as duas serrarias não andam juntas, nem o lenhador e o mineiro (mesmas durações)', () => {
    const itens = camadaObjetos(m, todos, cincoOficios);
    const indice = (id: string, t: number) => {
      const it = itens.find((x) => x.id === id)!;
      return it.anim.quadros.indexOf(nomeDoSprite(it, { t, animado: true }));
    };
    for (const [a, b] of [['serraria_1', 'serraria_2'], ['aldeao_lenhador', 'aldeao_mineiro']] as const) {
      const [x, y] = [itens.find((it) => it.id === a)!, itens.find((it) => it.id === b)!];
      expect(x.anim.duracoesMs).toEqual(y.anim.duracoesMs);
      expect(x.fase).not.toBe(y.fase);
      let diferentes = 0;
      for (let t = 0; t < x.anim.cicloMs; t += 5) if (indice(a, t) !== indice(b, t)) diferentes++;
      expect(diferentes, `${a} x ${b}`).toBeGreaterThan(x.anim.cicloMs / 5 / 4);
    }
  });

  it('todo sprite da L4 existe em public (todos os quadros)', () => {
    const nomes = spritesDosObjetos(camadaObjetos(m, todos, cincoOficios));
    expect(nomes.length).toBeGreaterThan(2 * 14);
    for (const nome of nomes) expect(existsSync(arquivoDoSprite(nome)), nome).toBe(true);
  });
});

describe('Ociosos em volta da fogueira (portão de ajustes rápidos)', () => {
  const ociosos = (n: number, outros: readonly OficioAldeao[] = []) =>
    camadaObjetos(m, todos, [...outros.map((oficio) => ({ oficio })), ...Array.from({ length: n }, () => ({ oficio: 'ocioso' as const }))]);
  const deOcioso = <T extends { id: string }>(itens: readonly T[]) => itens.filter((it) => it.id.startsWith('aldeao_ocioso_'));

  it('um por Ocioso presente, até os lugares da praça; o k-ésimo no lugar k, com a origem do núcleo', () => {
    expect(POSICOES_OCIOSOS).toHaveLength(3);
    for (const [n, esperado] of [[0, 0], [1, 1], [2, 2], [3, 3], [10, 3], [40, 3]] as const) expect(deOcioso(ociosos(n)), `${n}`).toHaveLength(esperado);
    const itens = deOcioso(ociosos(3));
    itens.forEach((it, k) => {
      const lugar = POSICOES_OCIOSOS.find((_, i) => it.id === `aldeao_ocioso_${i + 1}`)!;
      expect({ x: it.peX, y: it.peY }, it.id).toEqual({ x: lugar.x + m.origemNucleo.x + 16, y: lugar.y + m.origemNucleo.y + 28 });
      expect(it.anim.chave).toBe('aldeao/ocioso');
      expect(it.lado).toBe(ESCALA.aldeao);
      expect(k).toBeGreaterThanOrEqual(0);
    });
    // Fase própria por id (não andam juntos) e sem sorteio: a mesma lista dá os mesmos itens.
    expect(new Set(itens.map((it) => it.fase)).size).toBe(itens.length);
    expect(deOcioso(ociosos(3))).toEqual(itens);
  });

  it('ordenados pelo pé junto com o resto da L4', () => {
    const itens = ociosos(3, OFICIOS);
    for (let k = 1; k < itens.length; k++) expect(itens[k]!.peY).toBeGreaterThanOrEqual(itens[k - 1]!.peY);
  });

  it('sem Ociosos, a camada é a mesma de antes (mesmos itens dos ofícios)', () => {
    const sem = ociosos(0, OFICIOS);
    expect(deOcioso(sem)).toEqual([]);
    expect(sem.filter((it) => it.id.startsWith('aldeao_')).map((it) => it.id).sort()).toEqual(OFICIOS.map((o) => `aldeao_${o}`).sort());
    expect(sem).toEqual(camadaObjetos(m, todos, cincoOficios));
  });

  it('não cobrem a fogueira nem o poço, nem uns aos outros (pixels opacos do quadro 1)', () => {
    // Caixa dos pixels opacos em mundo, com o sprite desenhado no lado do item (aldeões: arte de 32 em 24).
    const caixaOpaca = (sprite: string, x: number, y: number, lado: number) => {
      const img = lerPng(sprite);
      const f = lado / img.largura;
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let j = 0; j < img.altura; j++) for (let i = 0; i < img.largura; i++) {
        if (img.dados[(j * img.largura + i) * 4 + 3]! > 0) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      }
      return { x0: x + x0 * f, y0: y + y0 * f, x1: x + (x1 + 1) * f - 0.001, y1: y + (y1 + 1) * f - 0.001 };
    };
    const cruza = (a: ReturnType<typeof caixaOpaca>, b: ReturnType<typeof caixaOpaca>) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
    const itens = ociosos(3);
    const fixos = itens.filter((it) => it.id === 'fogueira_1' || it.id === 'poco_1').map((it) => ({ id: it.id, c: caixaOpaca(it.anim.quadros[0]!, it.x, it.y, it.lado) }));
    expect(fixos).toHaveLength(2);
    const caixas = deOcioso(itens).map((it) => ({ id: it.id, c: caixaOpaca(it.anim.quadros[0]!, it.x, it.y, it.lado) }));
    for (const o of caixas) {
      for (const f of fixos) expect(cruza(o.c, f.c), `${o.id} x ${f.id}`).toBe(false);
      for (const p of caixas) if (p !== o) expect(cruza(o.c, p.c), `${o.id} x ${p.id}`).toBe(false);
    }
  });
});
