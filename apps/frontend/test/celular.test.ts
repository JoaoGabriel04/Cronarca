// Portão 14: o limite do celular, as câmeras de 2x, a gaveta de Destinos e a
// exceção dos aldeões a 32 px de tela.
import { MAPA, OFICIOS, TEXTOS_GAVETA_DESTINOS } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { ehCelular, LARGURA_MAXIMA_CELULAR } from '../lib/casca/celular';
import { ARRASTO_GAVETA_PX, gestoDaGaveta } from '../lib/casca/gaveta';
import { camadaObjetos, planoL4, QUADRO_1 } from '../lib/mapa/objetos';
import { VISOES, VISOES_CELULAR, visoesDe } from '../lib/mapa/visoes';

describe('limite do celular', () => {
  it('até 600 px é celular; 601 já não é (360, 390 e 600 sim)', () => {
    expect(LARGURA_MAXIMA_CELULAR).toBe(600);
    for (const l of [360, 390, 600]) expect(ehCelular(l), `${l}`).toBe(true);
    for (const l of [601, 768, 1023, 1440]) expect(ehCelular(l), `${l}`).toBe(false);
  });
});

describe('câmeras do celular (spec 4c)', () => {
  it('Vila e Reino em 2x, cada um com a sua câmera; no desktop a Vila fica em 3x', () => {
    expect(VISOES_CELULAR.vila.zoom).toBe(2);
    expect(VISOES_CELULAR.mapa.zoom).toBe(2);
    expect({ x: VISOES_CELULAR.vila.x, y: VISOES_CELULAR.vila.y }).toEqual({ x: VISOES.vila.x, y: VISOES.vila.y });
    expect({ x: VISOES_CELULAR.mapa.x, y: VISOES_CELULAR.mapa.y }).toEqual({ x: VISOES.mapa.x, y: VISOES.mapa.y });
    expect(VISOES_CELULAR.vila).not.toEqual(VISOES_CELULAR.mapa);
    expect(visoesDe(true)).toBe(VISOES_CELULAR);
    expect(visoesDe(false)).toBe(VISOES);
    expect(VISOES.vila.zoom).toBe(3);
  });
});

describe('gaveta de Destinos', () => {
  it('toque alterna; arrastar para cima abre, para baixo fecha', () => {
    expect(gestoDaGaveta(false, 0)).toBe(true);
    expect(gestoDaGaveta(true, 5)).toBe(false);
    expect(gestoDaGaveta(false, -ARRASTO_GAVETA_PX)).toBe(true);
    expect(gestoDaGaveta(true, ARRASTO_GAVETA_PX)).toBe(false);
    // Arrastar no sentido em que ela já está não muda nada.
    expect(gestoDaGaveta(true, -80)).toBe(true);
    expect(gestoDaGaveta(false, 80)).toBe(false);
  });

  it('fechada mostra 2 destinos; a nota dos bloqueios vem dos dados', () => {
    expect(TEXTOS_GAVETA_DESTINOS.fechadaMostra).toBe(2);
    expect(TEXTOS_GAVETA_DESTINOS.nota).toBe('Mina e Pântano: Cartografia. Cripta: Estradas Reais.');
  });
});

describe('aldeões em qualquer visão e largura (A6)', () => {
  const itens = camadaObjetos(MAPA, {}, OFICIOS.map((oficio) => ({ oficio })));
  const aldeoes = itens.filter((it) => it.id.startsWith('aldeao_'));
  const tamanhos = () => ({ largura: 40, altura: 20 });
  const v = { dx: -2000, dy: -1500, zoom: 2, largura: 99_999, altura: 99_999 };

  it('em 2x (Vila e Reino do celular, Reino do desktop): escala de mundo, 48 px (24 × 2), metade da construção; sombra junto', () => {
    const plano = planoL4(itens, v, QUADRO_1, tamanhos, []);
    for (const a of aldeoes) {
      const obj = plano.find((c) => c.tipo === 'objeto' && c.item.id === a.id);
      expect(obj, a.id).toBeDefined();
      if (obj?.tipo !== 'objeto') continue;
      expect(obj.ret).toEqual({ x: a.x * 2 + v.dx, y: a.y * 2 + v.dy, largura: 48, altura: 48 });
    }
    const sombras = plano.filter((c) => c.tipo === 'sombra' && c.sprite.includes('aldeao'));
    expect(sombras).toHaveLength(aldeoes.length);
    for (const s of sombras) expect({ l: s.ret.largura, a: s.ret.altura }).toEqual({ l: 60, a: 30 }); // 40 x 20 da arte de 32, × 2 × 24/32
    const poco = plano.find((c) => c.tipo === 'objeto' && c.item.id === 'poco_1');
    expect(poco?.tipo === 'objeto' && poco.ret.largura).toBe(64);
  });
});
