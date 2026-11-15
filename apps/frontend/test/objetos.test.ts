import { existsSync } from 'node:fs';
import {
  animacao, ESCALA, estadoInicial, indiceNoTempo, MAPA, OFICIOS, POSICOES_ALDEOES, SLOT_IDS, ZOOM_MINIMO_ALDEOES, type Oficio, type SlotId,
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
    expect({ x: mineiro.x, y: mineiro.y }).toEqual({ x: p.x + m.origemNucleo.x, y: p.y + m.origemNucleo.y });
    expect(mineiro.anim.chave).toBe('aldeao/mineiro');
  });

  it('aldeões só a partir do zoom 3x: em 1x e 2x somem (sombra junto); construções e props ficam', () => {
    const itens = camadaObjetos(m, todos, cincoOficios);
    const tamanhos = (chave: string) => ({ largura: chave.includes('aldeao') ? 40 : 60, altura: 30 });
    for (const zoom of [1, 2, 3, 4]) {
      const v = { dx: 0, dy: 0, zoom, largura: 99_999, altura: 99_999 };
      const plano = planoL4(itens, v, QUADRO_1, tamanhos);
      const comAldeao = plano.filter((c) => (c.tipo === 'objeto' ? c.item.id.startsWith('aldeao_') : c.sprite.includes('aldeao')));
      expect(comAldeao.length, `${zoom}x`).toBe(zoom >= ZOOM_MINIMO_ALDEOES ? 10 : 0); // 5 sombras + 5 aldeões
      expect(plano.filter((c) => c.tipo === 'objeto' && !c.item.id.startsWith('aldeao_'))).toHaveLength(itens.length - 5);
    }
    expect(ZOOM_MINIMO_ALDEOES).toBe(3);
  });

  it('sprites dos aldeões: os 5 ofícios em 32 x 32, todos os quadros, sem "Sem função" (o ocioso não vai ao mapa)', () => {
    for (const o of OFICIOS) {
      for (const q of animacao('aldeao', o).quadros) {
        const img = lerPng(q);
        expect({ largura: img.largura, altura: img.altura }).toEqual({ largura: 32, altura: 32 });
      }
    }
    expect(camadaObjetos(m, todos, cincoOficios).some((it) => it.anim.chave === 'aldeao/ocioso')).toBe(false);
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
