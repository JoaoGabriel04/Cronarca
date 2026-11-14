import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAPA, OFICIOS, TIPOS_PROP, SOMBRA_CONSTRUCAO, SOMBRA_COR, SOMBRA_ELIPSE_16, SOMBRA_OBJETO,
  type SombraSilhueta,
} from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { estadoDeExemplo } from '../lib/mapa/exemplo';
import { pesDosGrupos } from '../lib/mapa/layoutMarcadores';
import { marcadores } from '../lib/mapa/marcadores';
import { camadaObjetos, chaveDaSombra, nomeDoSprite, planoL4, QUADRO_1, sombrasAGerar, type ItemL4, type Vista } from '../lib/mapa/objetos';
import { gerarSombra, peDaSombra, tamanhoDaSombra, type ImagemRgba } from '../lib/mapa/sombras';
import { lerPng, ultimaLinhaOpaca } from './png';

const m = MAPA;
const TODAS = Object.fromEntries(m.slots.map((x) => [x.id, { nivel: 1 }]));

/** Sprite vazio de lado n, com os pixels dados (alfa 255 por padrão). */
function sprite(n: number, pixels: { x: number; y: number; a?: number }[]): ImagemRgba {
  const dados = new Uint8ClampedArray(n * n * 4);
  for (const p of pixels) dados.set([10, 20, 30, p.a ?? 255], (p.y * n + p.x) * 4);
  return { largura: n, altura: n, dados };
}
const alfa = (img: ImagemRgba, x: number, y: number) => img.dados[(y * img.largura + x) * 4 + 3]!;
const pintados = (img: ImagemRgba) => {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < img.altura; y++) for (let x = 0; x < img.largura; x++) if (alfa(img, x, y)) out.push({ x, y });
  return out;
};
const P: SombraSilhueta = { sMil: 500, kMil: 200, alfa: 78 };

/** Tamanho da sombra gerada de cada sprite real (o mesmo cálculo do carregamento). */
const cacheTamanhos = new Map<string, { largura: number; altura: number }>();
function tamanhoReal(chave: string, itens: readonly ItemL4[]) {
  if (!cacheTamanhos.has(chave)) {
    const nome = chave.replace(/^sombra:/, '');
    const it = itens.find((x) => x.anim.quadros.includes(nome))!;
    const img = lerPng(nome);
    // O pé é o do quadro 1 em todos os quadros (o mesmo cálculo do carregamento).
    cacheTamanhos.set(chave, tamanhoDaSombra(img.largura, peDaSombra(lerPng(it.anim.quadros[0]!), it.sombra!.ajuste), it.sombra!.p));
  }
  return cacheTamanhos.get(chave);
}
const tamanhos = (itens: readonly ItemL4[]) => (chave: string) => tamanhoReal(chave, itens);

describe('sombra pela silhueta: gerador', () => {
  it('pixel opaco a d px acima do pé vai para (x + floor(d S), pe + floor(d K)), com a cor e o alfa constantes', () => {
    const pe = 40;
    const s = gerarSombra(sprite(48, [{ x: 3, y: pe - 10 }]), pe, P);
    expect(pintados(s)).toEqual([{ x: 3 + 5, y: pe + 2 }]);
    const i = ((pe + 2) * s.largura + 8) * 4;
    expect([...s.dados.slice(i, i + 4)]).toEqual([SOMBRA_COR.r, SOMBRA_COR.g, SOMBRA_COR.b, 78]);
  });

  it('ignora pixels abaixo do pé (d < 0) e os que não têm alfa 255', () => {
    const pe = 40;
    const s = gerarSombra(sprite(48, [{ x: 1, y: pe + 2 }, { x: 2, y: 10, a: 254 }, { x: 3, y: 10, a: 70 }]), pe, P);
    expect(pintados(s)).toEqual([]);
  });

  it('sobreposição não acumula: alfa sempre A, sem gradiente', () => {
    // Dois pixels que caem no mesmo destino (d = 0 e d = 1 com S = K = 0).
    const s = gerarSombra(sprite(16, [{ x: 4, y: 10 }, { x: 4, y: 9 }]), 10, { sMil: 0, kMil: 0, alfa: 70 });
    expect(pintados(s)).toEqual([{ x: 4, y: 10 }]);
    expect(alfa(s, 4, 10)).toBe(70);
  });

  it('fecha buracos de 1 px na vertical, e só os de 1 px', () => {
    // K = 1: dy = pe + d. Pixels em d = 0, 2 (buraco de 1) e d = 5 (buraco de 2 entre 2 e 5).
    const pe = 10;
    const s = gerarSombra(sprite(16, [{ x: 4, y: pe }, { x: 4, y: pe - 2 }, { x: 4, y: pe - 5 }]), pe, { sMil: 0, kMil: 1000, alfa: 78 });
    expect(pintados(s).map((p) => p.y)).toEqual([pe, pe + 1, pe + 2, pe + 5]);
  });

  it('o tamanho cobre o maior deslocamento: sprite todo opaco cabe e encosta nas bordas', () => {
    for (const [lado, pe, p] of [[48, 43, P], [160, 140, { sMil: 500, kMil: 220, alfa: 100 }], [48, 43, SOMBRA_CONSTRUCAO], [24, 21, { sMil: 400, kMil: 200, alfa: 70 }]] as const) {
      const todos = Array.from({ length: lado * lado }, (_, i) => ({ x: i % lado, y: Math.floor(i / lado) }));
      const s = gerarSombra(sprite(lado, todos), pe, p);
      expect({ largura: s.largura, altura: s.altura }).toEqual(tamanhoDaSombra(lado, pe, p));
      const ps = pintados(s);
      expect(Math.max(...ps.map((q) => q.x))).toBe(s.largura - 1);
      expect(Math.max(...ps.map((q) => q.y))).toBe(s.altura - 1);
      expect(Math.min(...ps.map((q) => q.y))).toBe(pe); // a sombra começa no pé, nunca acima
    }
  });
});

describe('sombra pela silhueta: dados e plano da L3b', () => {
  it('flores e cerca sem sombra; poço e fogueira com parâmetros', () => {
    for (const tipo of TIPOS_PROP) {
      const semSombra = ['flores', 'cerca'].includes(tipo);
      expect(SOMBRA_OBJETO[tipo] === null, tipo).toBe(semSombra);
    }
  });

  it('pé da sombra: em cada sprite real com sombra, é a última linha opaca do quadro 1 - 1, o mesmo em todos os quadros, e a 1ª linha da sombra encosta na base', () => {
    // Todos os tipos com sombra, com todas as construções e os 5 aldeões.
    const nomes = sombrasAGerar(camadaObjetos(m, TODAS, OFICIOS.map((oficio) => ({ oficio }))));
    expect(['/sprites/cenario/poco_1.png', '/sprites/construcao/casa_4.png', '/sprites/aldeao/lenhador_3.png'].every((n) => nomes.has(n))).toBe(true);
    for (const [nome, { ajuste, p, peDe }] of nomes) {
      const img = lerPng(nome);
      const base = ultimaLinhaOpaca(img);
      const pe = peDaSombra(lerPng(peDe), ajuste);
      expect(pe, nome).toBe(ultimaLinhaOpaca(lerPng(peDe)) - 1 + ajuste);
      // Os quadros novos têm o pé no mesmo ponto; o impacto (lenhador e mineiro, quadro 3) desce 1 px e não mexe a sombra.
      expect(base - (pe + 1 - ajuste), nome).toBeLessThanOrEqual(nome.includes('_3.png') && /lenhador|mineiro/.test(nome) ? 1 : 0);
      const sombra = gerarSombra(img, pe, p);
      const linhas = pintados(sombra).map((q) => q.y);
      expect(Math.min(...linhas), nome).toBe(pe); // começa dentro da base: sem faixa de grama
      expect(Math.min(...linhas), nome).toBeLessThanOrEqual(base);
    }
  }, 30_000);

  it('pé da sombra: ajuste manual somado; sprite sem pixel opaco não tem sombra', () => {
    const img = sprite(16, [{ x: 3, y: 12 }, { x: 4, y: 5 }]);
    expect(peDaSombra(img)).toBe(11);
    expect(peDaSombra(img, 2)).toBe(13);
    expect(peDaSombra(sprite(16, [{ x: 1, y: 15, a: 200 }]))).toBe(-1);
    expect(gerarSombra(sprite(16, []), -1, P).largura).toBe(0);
  });

  it('a elipse de 16 (aldeão e aventureiro) bate com o arquivo', () => {
    const b = readFileSync(join(__dirname, '..', 'public', 'mapa', `${SOMBRA_ELIPSE_16.sprite}.png`));
    expect({ largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) }).toEqual({ largura: SOMBRA_ELIPSE_16.largura, altura: SOMBRA_ELIPSE_16.altura });
  });

  it('uma sombra por sprite e por quadro a gerar, só para quem tem sombra', () => {
        const itens = camadaObjetos(m, estadoDeExemplo(0).slots);
    const aGerar = sombrasAGerar(itens);
    for (const it of itens) {
      for (const q of it.anim.quadros) expect(aGerar.has(q), it.id).toBe(it.sombra !== null);
      if (it.sombra) for (const q of it.anim.quadros) expect(aGerar.get(q)!.peDe).toBe(it.anim.quadros[0]);
    }
  });

  for (const zoom of [1, 2, 3]) {
    it(`zoom ${zoom}x: nenhuma sombra é desenhada depois de um objeto de L4 (vários instantes, grupo em marcha incluído)`, () => {
      for (const s of [0]) {
        const itens = camadaObjetos(m, TODAS);
        const v: Vista = { dx: 0, dy: 0, zoom, largura: m.largura * zoom, altura: m.altura * zoom };
        const pes = pesDosGrupos(marcadores(m, estadoDeExemplo(s), 7_000), { dx: 0, dy: 0, zoom });
        for (const relogio of [QUADRO_1, { t: 0, animado: true }, { t: 137, animado: true }, { t: 1451, animado: true }]) {
          const plano = planoL4(itens, v, relogio, tamanhos(itens), pes);
          const primeiroObjeto = plano.findIndex((c) => c.tipo === 'objeto');
          const ultimaSombra = plano.map((c) => c.tipo).lastIndexOf('sombra');
          expect(ultimaSombra, `semente ${s}`).toBeLessThan(primeiroObjeto);
          expect(primeiroObjeto).toBe(itens.filter((it) => it.sombra).length + pes.length);
          expect(plano.length - primeiroObjeto).toBe(itens.length);
          // A sombra de cada item é a do quadro que ele mostra agora (com a fase dele).
          const comSombra = itens.filter((it) => it.sombra);
          comSombra.forEach((it, k) => expect(plano[k]).toMatchObject({ tipo: 'sombra', sprite: chaveDaSombra(nomeDoSprite(it, relogio)) }));
        }
      }
    });

    it(`zoom ${zoom}x: sombra na origem do sprite, escala inteira do zoom, pixel inteiro`, () => {
            const itens = camadaObjetos(m, estadoDeExemplo(0).slots);
      const v: Vista = { dx: 7, dy: -3, zoom, largura: 99_999, altura: 99_999 };
      const plano = planoL4(itens, v, QUADRO_1, tamanhos(itens));
      // As sombras saem na ordem dos itens (vista grande: todos visíveis).
      itens.filter((x) => x.sombra).forEach((it, k) => {
        const c = plano[k]!;
        const t = tamanhoReal(chaveDaSombra(nomeDoSprite(it, QUADRO_1)), itens)!;
        expect(c.ret).toEqual({ x: it.x * zoom + 7, y: it.y * zoom - 3, largura: t.largura * zoom, altura: t.altura * zoom });
        for (const n of Object.values(c.ret)) expect(Number.isInteger(n)).toBe(true);
      });
    });
  }

  it('grupo em marcha: elipse de 16 fixa na tela, presa ao pé (+2 em x); abaixo do zoom 2 (ícone) não tem sombra', () => {
        const mk = marcadores(m, estadoDeExemplo(0), 7_000);
    expect(pesDosGrupos(mk, { dx: 0, dy: 0, zoom: 1 })).toEqual([]);
    for (const zoom of [2, 3, 4]) {
      const [pe] = pesDosGrupos(mk, { dx: 0, dy: 0, zoom });
      const [c] = planoL4([], { dx: 0, dy: 0, zoom, largura: 99_999, altura: 99_999 }, QUADRO_1, () => undefined, [pe!]);
      expect(c).toMatchObject({ tipo: 'sombra', sprite: SOMBRA_ELIPSE_16.sprite });
      expect(c!.ret.largura).toBe(SOMBRA_ELIPSE_16.largura);
      expect(c!.ret.x + c!.ret.largura / 2).toBe(pe!.x + 2);
    }
  });

  it('fora da vista não entra no plano', () => {
        const itens = camadaObjetos(m, estadoDeExemplo(0).slots);
    expect(planoL4(itens, { dx: -100_000, dy: -100_000, zoom: 2, largura: 876, altura: 712 }, QUADRO_1, tamanhos(itens))).toEqual([]);
  });
});
