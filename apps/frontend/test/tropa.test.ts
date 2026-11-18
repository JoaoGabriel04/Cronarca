// Portão 22: dados da tela Tropa (Alojamento, contratar com classe) e o texto para cliente antigo.
import { CLASSES, estadoInicial, TEXTOS_QG, visaoDoCliente, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { alojamento, cartasHerois, cliqueDoQg, dadosContratar, guilda, textoDaSubaba, vantagemDaClasse } from '../lib/casca/telas';
import { textoDaRecusa } from '../lib/jogo/recusas';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
function visao(nivelQg: 0 | 1, niveis: number[]): VisaoCliente {
  const e = estadoInicial({ semente: 3, agora: T0 });
  e.qg = nivelQg ? { estado: 'reerguido', desde: T0, nivel: 1 } : { estado: 'ruinas', desde: T0, nivel: 0 };
  e.aventureiros = niveis.map((nivel, i) => ({ ...e.aventureiros[0]!, id: `a${i + 1}`, nome: `Heroi ${i + 1}`, nivel, alojado: false }));
  return visaoDoCliente(e);
}

describe('Alojamento na tela', () => {
  it('QG em ruínas: bloqueado, sem prévia', () => {
    const a = alojamento(visao(0, [1, 2]));
    expect(a).toMatchObject({ disponivel: false, capacidade: 0, linha: TEXTOS_QG.alojamentoBloqueado, atravessam: [], excedente: false });
  });

  it('QG reerguido: capacidade 3 e a prévia lista os mais fortes; com mais gente que vagas, há excedente', () => {
    const e = visao(1, [2, 9, 6, 12, 4]);
    const a = alojamento(e);
    expect(a.capacidade).toBe(3);
    expect(a.atravessam).toEqual(['Heroi 4', 'Heroi 2', 'Heroi 3']);
    expect(a.excedente).toBe(true);
    expect(a.linha).toBe(`${TEXTOS_QG.tituloAlojamento} 0 / 3`);
    expect(alojamento(visao(1, [5, 6])).excedente).toBe(false);
  });

  it('alojado conta no Alojamento, não nas vagas da Taverna, e a carta mostra a etiqueta', () => {
    const e = visao(1, [5, 6]);
    e.aventureiros[0]!.alojado = true;
    expect(alojamento(e).linha).toBe(`${TEXTOS_QG.tituloAlojamento} 1 / 3`);
    expect(guilda(e).vagas).toBe('1 / 4');
    const cartas = cartasHerois(e, T0);
    expect(cartas.map((c) => c.alojado)).toEqual([true, false]);
    expect(cartas[0]!.iconeClasse).toBe('icone-classe-lanceiro');
  });
});

describe('Contratar com classe', () => {
  it('oferece as 4 classes, com a vantagem vinda dos dados do combate', () => {
    const d = dadosContratar(visao(0, [1]));
    expect(d.classes.map((c) => c.classe)).toEqual([...CLASSES]);
    expect(d.classes.every((c) => c.icone === `icone-classe-${c.classe}` && c.sprite.grupo === 'aventureiro')).toBe(true);
    expect(d.pode).toBe(true);
    expect(d.vagas).toBe('1 / 4');
    expect(d.custo.length).toBeGreaterThan(0);
    for (const c of CLASSES) expect(vantagemDaClasse(c).length).toBeGreaterThan(0);
  });

  it('guilda cheia ou sem recursos trava o modal com o motivo', () => {
    expect(dadosContratar(visao(0, [1, 1, 1, 1]))).toMatchObject({ pode: false, motivo: 'Guilda cheia' });
    const pobre = visao(0, [1]);
    pobre.recursos.ouro = 0;
    expect(dadosContratar(pobre)).toMatchObject({ pode: false, motivo: 'Recursos insuficientes' });
  });
});

describe('cliente antigo', () => {
  it('a recusa por ação inválida pede para atualizar a página', () => {
    expect(textoDaRecusa('acao_invalida')).toBe(TEXTOS_QG.atualizePagina);
  });
});

describe('botão do Quartel General no HUD', () => {
  it('oculto: mostra a dica das Ruínas; em ruínas: abre o modal de reerguer; reerguido: leva à Tropa', () => {
    const e = visao(0, [1]);
    e.qg = { estado: 'oculto', desde: T0, nivel: 0 };
    expect(cliqueDoQg(e)).toEqual({ tipo: 'dica', texto: TEXTOS_QG.bloqueado });
    e.qg = { estado: 'ruinas', desde: T0, nivel: 0 };
    expect(cliqueDoQg(e)).toEqual({ tipo: 'reerguer' });
    expect(cliqueDoQg(visao(1, [1]))).toEqual({ tipo: 'tropa' });
  });
});

describe('subabas Mesa de Guerra e Enfermaria conforme o QG', () => {
  const casos = [
    ['oculto', 0, 'Bloqueada', TEXTOS_QG.bloqueado, TEXTOS_QG.bloqueado],
    ['ruinas', 0, 'Bloqueada', 'Reerga o Quartel General para liberar a Mesa de Guerra.', 'Reerga o Quartel General para liberar a Enfermaria.'],
    ['reerguido', 1, 'Em breve', TEXTOS_QG.mesaDeGuerraEmBreve, TEXTOS_QG.enfermariaEmBreve],
  ] as const;
  it.each(casos)('QG %s', (estado, nivel, subtitulo, mesa, enfermaria) => {
    const e = visao(0, [1]);
    e.qg = { estado, desde: T0, nivel };
    expect(textoDaSubaba(e, 'mesa')).toEqual({ subtitulo, texto: mesa });
    expect(textoDaSubaba(e, 'enfermaria')).toEqual({ subtitulo, texto: enfermaria });
  });
});
