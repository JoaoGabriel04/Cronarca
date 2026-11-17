// Portão 21 no cliente: pin, cartão e linha do destino, objeto das Ruínas na L4, clique, modal de reerguer e relatório.
import { ESCALA, estadoInicial, HITBOX_QG, MAPA, PONTO_QG, QG, TEXTOS_QG, visaoDoCliente, type EstadoQg, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { cartasDestinos } from '../lib/casca/dados';
import { dadosReerguerQg } from '../lib/casca/modais';
import { linhasDestinos, relatorios } from '../lib/casca/telas';
import { textoDaRecusa } from '../lib/jogo/recusas';
import { acertar, clicaveisDoMapa, type Cena } from '../lib/mapa/acerto';
import { marcadores } from '../lib/mapa/marcadores';
import { camadaObjetos } from '../lib/mapa/objetos';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const MICRO = 1_000_000;
const visao = (qg: EstadoQg = 'oculto'): VisaoCliente => {
  const e = estadoInicial({ semente: 1, agora: T0 });
  e.qg = { estado: qg, desde: T0 };
  return visaoDoCliente(e);
};

describe('o destino some depois de descoberto', () => {
  it('oculto: pin, cartão e linha existem (e o pin é de destino aberto)', () => {
    const e = visao('oculto');
    expect(marcadores(MAPA, e, T0).pins.find((p) => p.id === 'ruinas_qg')?.estado).toBe('aberto');
    expect(cartasDestinos(e, T0).cartas.map((c) => c.destino)).toContain('ruinas_qg');
    expect(linhasDestinos(e, []).map((l) => l.destino)).toContain('ruinas_qg');
    expect(cartasDestinos(e, T0).cartas[0]!.destino).toBe('ruinas_qg'); // primeiro na lista
  });
  it('a caminho: continua à vista, como ativo', () => {
    const e = visao('oculto');
    e.expedicoes.push({ id: 'x1', destino: 'ruinas_qg', grupo: [e.aventureiros[0]!.id], inicio: T0, fim: T0 + 40_000 });
    expect(marcadores(MAPA, e, T0).pins.find((p) => p.id === 'ruinas_qg')?.estado).toBe('ativo');
    expect(cartasDestinos(e, T0 + 10_000).cartas[0]).toMatchObject({ destino: 'ruinas_qg', emAndamento: true });
  });
  for (const qg of ['ruinas', 'reerguido'] as const) {
    it(`${qg}: sem pin, sem cartão e sem linha (entra o objeto na L4)`, () => {
      const e = visao(qg);
      expect(marcadores(MAPA, e, T0).pins.map((p) => p.id)).not.toContain('ruinas_qg');
      expect(cartasDestinos(e, T0).cartas.map((c) => c.destino)).not.toContain('ruinas_qg');
      expect(linhasDestinos(e, []).map((l) => l.destino)).not.toContain('ruinas_qg');
    });
  }
});

describe('objeto das Ruínas e do Quartel General na L4', () => {
  const doQg = (qg: EstadoQg) => camadaObjetos(MAPA, {}, [], qg).find((i) => i.id === PONTO_QG);
  it('oculto: não há objeto; ruinas: sprite das Ruínas (2 quadros); reerguido: o Quartel (4 quadros)', () => {
    expect(doQg('oculto')).toBeUndefined();
    expect(doQg('ruinas')!.anim.chave).toBe('construcao/ruinas_qg');
    expect(doQg('ruinas')!.anim.quadros).toHaveLength(2);
    expect(doQg('reerguido')!.anim.chave).toBe('construcao/quartel');
    expect(doQg('reerguido')!.anim.quadros).toHaveLength(4);
  });
  it('48 x 48 centrado no ponto do mapa (tile 65,28), com sombra', () => {
    const it = doQg('ruinas')!;
    expect(it.lado).toBe(ESCALA.construcao);
    expect([it.x, it.y]).toEqual([2096 - 24, 912 - 24]);
    expect(it.peX).toBe(2096);
    expect(it.sombra).not.toBeNull();
  });
});

describe('clique nas Ruínas', () => {
  const cena = (qg: EstadoQg): Cena => ({
    pins: [], vazios: [], zoom: 1, ponteiro: 'mouse', paraMundo: (p) => p,
    clicaveis: clicaveisDoMapa(MAPA, camadaObjetos(MAPA, {}, [], qg)).filter((c) => c.id === PONTO_QG),
  });
  it('acerta pela caixa (sem máscara de pixel) e devolve o alvo qg; fora da caixa não acerta', () => {
    const it = camadaObjetos(MAPA, {}, [], 'ruinas').find((i) => i.id === PONTO_QG)!;
    for (const qg of ['ruinas', 'reerguido'] as const) {
      const c = cena(qg);
      expect(c.clicaveis).toHaveLength(1);
      expect(c.clicaveis[0]!.porPixel).toBe(false);
      expect(acertar(c, { x: it.x + HITBOX_QG.x + 10, y: it.y + HITBOX_QG.y + 10 })).toEqual({ tipo: 'qg' });
      expect(acertar(c, { x: it.x - 40, y: it.y - 40 })).toBeNull();
    }
    expect(cena('oculto').clicaveis).toHaveLength(0);
  });
});

describe('modal de reerguer', () => {
  it('mostra o custo dos dados (madeira 80, pedra 20) e só deixa pagar com recursos e as Ruínas descobertas', () => {
    const e = visao('ruinas');
    e.recursos.madeira = 100 * MICRO;
    e.recursos.pedra = 50 * MICRO;
    const d = dadosReerguerQg(e);
    expect(d.custo.map((c) => [c.recurso, c.valor, c.falta])).toEqual([['madeira', '80', false], ['pedra', '20', false]]);
    expect(Object.keys(QG.custoReerguer)).toEqual(['madeira', 'pedra']);
    expect(d.pode).toBe(true);
    expect(d.motivo).toBeNull();
    expect(d.titulo).toBe('Reerguer o Quartel General');
    expect(d.botao).toBe('Reerguer o Quartel General');

    e.recursos.madeira = 70 * MICRO;
    e.recursos.pedra = 10 * MICRO;
    const falta = dadosReerguerQg(e);
    expect(falta.pode).toBe(false);
    expect(falta.custo.every((c) => c.falta)).toBe(true);
    expect(falta.motivo).toBe('Falta madeira e pedra');
    e.recursos.pedra = 30 * MICRO;
    expect(dadosReerguerQg(e).motivo).toBe('Falta madeira');
  });
  it('fora do estado ruinas (oculto ou já reerguido) não deixa pagar', () => {
    for (const qg of ['oculto', 'reerguido'] as const) {
      const e = visao(qg);
      e.recursos.madeira = 500 * MICRO;
      e.recursos.pedra = 500 * MICRO;
      expect(dadosReerguerQg(e).pode, qg).toBe(false);
    }
  });
  it('a recusa do servidor tem texto', () => {
    expect(textoDaRecusa('qg_indisponivel')).toBe('O Quartel General não está disponível agora.');
  });
});

describe('relatório do recuo nas Ruínas', () => {
  it('não diz "antes de achar algo": as Ruínas foram encontradas', () => {
    const e = visao('ruinas');
    // Do mais velho para o mais novo (a lista da tela inverte).
    e.relatorios = [
      { destino: 'ruinas', grupo: ['Aldric'], vitoria: false, saque: {}, feridos: [], em: T0 - 1 },
      { destino: 'ruinas_qg', grupo: ['Aldric'], vitoria: false, saque: {}, feridos: [], em: T0 },
    ];
    const [qg, outra] = relatorios(e);
    expect(qg!.texto).toBe(TEXTOS_QG.recuoComDescoberta);
    expect(outra!.texto).toBe('O grupo recuou antes de achar algo.');
  });
});
