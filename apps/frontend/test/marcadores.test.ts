import { existsSync } from 'node:fs';
import { arquivoDoSprite } from './png';
import {
  animacao, aplicarAcao, CLASSES, DESTINOS, DESTINOS_IDS, estadoInicial, MAPA, visaoDoCliente,
  type VisaoCliente,
} from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { estadoDeExemplo } from '../lib/mapa/exemplo';
import {
  amostrar, caminhoAteDestino, formatarRestante, marcadores, PASSO_TRILHA, pontoNoCaminho,
} from '../lib/mapa/marcadores';

const T0 = 1_800_000_000_000;
const m = MAPA;
/** Cruzamento das estradas do núcleo: origem + (240, 240) (spec do mapa, seção 6). */
const CRUZAMENTO = { x: m.origemNucleo.x + 240, y: m.origemNucleo.y + 240 };

describe('pins', () => {
  it('estados pelo estado do jogo: Floresta ativa (expedição), Ruínas do QG e Ruínas abertas, Mina, Pântano e Cripta bloqueados', () => {
    const mk = marcadores(m, estadoDeExemplo(T0), T0);
    const estado = Object.fromEntries(mk.pins.map((p) => [p.id, p.estado]));
    expect(estado).toEqual({ ruinas_qg: 'aberto', floresta_lobos: 'ativo', ruinas: 'aberto', mina: 'bloqueado', pantano: 'bloqueado', cripta: 'bloqueado' });
    for (const p of mk.pins) expect(p.nome).toBe(DESTINOS[p.id].nome);
  });

  it('Cartografia abre Mina e Pântano; Estradas Reais abre a Cripta e tira o aviso da névoa', () => {
    const e = estadoDeExemplo(T0);
    e.pesquisas.concluidas.push('cartografia');
    let estado = Object.fromEntries(marcadores(m, e, T0).pins.map((p) => [p.id, p.estado]));
    expect([estado.mina, estado.pantano, estado.cripta]).toEqual(['aberto', 'aberto', 'bloqueado']);
    expect(marcadores(m, e, T0).avisoNevoa?.texto).toBe('Estradas Reais');
    e.pesquisas.concluidas.push('estradas_reais');
    estado = Object.fromEntries(marcadores(m, e, T0).pins.map((p) => [p.id, p.estado]));
    expect(estado.cripta).toBe('aberto');
    expect(marcadores(m, e, T0).avisoNevoa).toBeNull();
  });

  it('a ponta do pin é o ponto do destino no meta; os decorativos não têm pin', () => {
    const pins = marcadores(m, estadoDeExemplo(T0), T0).pins;
    expect(pins.map((p) => p.id)).toEqual(DESTINOS_IDS);
    for (const p of pins) {
      const d = m.destinos.find((x) => x.id === p.id)!;
      expect(p.ponta).toEqual({ x: d.x, y: d.y });
    }
  });

  it('aviso da névoa no centro da névoa da Cripta (não no pin)', () => {
    expect(marcadores(m, estadoDeExemplo(T0), T0).avisoNevoa).toEqual({ texto: 'Estradas Reais', centro: { x: 2496, y: 1651 } });
  });
});

describe('trilhas e grupos', () => {
  it('trilha: reta do cruzamento do núcleo, origem + (240, 240), até o ponto de cada destino', () => {
    expect(CRUZAMENTO).toEqual({ x: 1552, y: 1168 });
    for (const d of m.destinos) expect(caminhoAteDestino(m, d.id)).toEqual([CRUZAMENTO, { x: d.x, y: d.y }]);
  });

  it('trilha só durante expedição; pontos a cada 10 de mundo, do núcleo até o destino', () => {
    const semExpedicao = visaoDoCliente(estadoInicial({ semente: 1, agora: T0 }));
    expect(marcadores(m, semExpedicao, T0).trilhas).toEqual([]);
    expect(marcadores(m, semExpedicao, T0).grupos).toEqual([]);

    const mk = marcadores(m, estadoDeExemplo(T0), T0);
    expect(mk.trilhas).toHaveLength(1);
    const cam = caminhoAteDestino(m, 'floresta_lobos')!;
    const pts = mk.trilhas[0]!.pontos;
    expect(pts[0]).toEqual(CRUZAMENTO);
    const comprimento = Math.hypot(cam[1]!.x - cam[0]!.x, cam[1]!.y - cam[0]!.y);
    expect(pts).toHaveLength(Math.floor(comprimento / PASSO_TRILHA) + 1);
    for (let k = 1; k < pts.length; k++) expect(Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y)).toBeCloseTo(PASSO_TRILHA, 9);
    expect(amostrar([{ x: 16, y: 16 }, { x: 48, y: 16 }], 10).map((p) => p.x)).toEqual([16, 26, 36, 46]);
    // Linha poligonal: o passo continua de um trecho para o outro.
    expect(amostrar([{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 15 }], 10)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 5 }, { x: 15, y: 15 }]);
  });

  it('grupo: ida na primeira metade, volta na segunda; a caixa mostra o tempo restante', () => {
    const e = estadoDeExemplo(T0);
    const x = e.expedicoes[0]!;
    const cam = caminhoAteDestino(m, x.destino)!;
    const em = (t: number) => marcadores(m, e, t).grupos[0]!;
    const meio = (x.inicio + x.fim) / 2;
    expect(em(x.inicio).pe).toEqual(pontoNoCaminho(cam, 0));
    expect(em(meio).pe).toEqual(pontoNoCaminho(cam, 1));
    expect(em(meio).pe).toEqual({ x: m.destinos.find((d) => d.id === x.destino)!.x, y: m.destinos.find((d) => d.id === x.destino)!.y });
    expect(em(x.fim).pe).toEqual(pontoNoCaminho(cam, 0));
    const quarto = x.inicio + (x.fim - x.inicio) / 4;
    expect(em(quarto).pe).toEqual(em(x.fim - (x.fim - x.inicio) / 4).pe);
    expect(em(quarto).restanteMs).toBe(x.fim - quarto);
    expect(em(x.inicio).classe).toBe('lanceiro');
  });

  it('várias expedições: cada uma com seu grupo e sua trilha', () => {
    let e = estadoInicial({ semente: 1, agora: T0 });
    e.recursos.ouro = 1e12;
    e = aplicarAcao(e, { tipo: 'contratar' }, T0).estado;
    e = aplicarAcao(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['a1'] }, T0).estado;
    e = aplicarAcao(e, { tipo: 'partir_expedicao', destino: 'ruinas', grupo: [e.aventureiros[1]!.id] }, T0).estado;
    const mk = marcadores(m, visaoDoCliente(e) as VisaoCliente, T0 + 5_000);
    expect(mk.grupos).toHaveLength(2);
    expect(mk.trilhas).toHaveLength(2);
    expect(mk.pins.filter((p) => p.estado === 'ativo').map((p) => p.id).sort()).toEqual(['floresta_lobos', 'ruinas']);
  });

  it('obra em andamento gera caixa de tempo; slot vazio não gera nada', () => {
    const mk = marcadores(m, estadoDeExemplo(T0), T0 + 30_000);
    expect(mk.obras).toEqual([{ slot: 'serraria_2', ancora: expect.any(Object), restanteMs: 60_000 }]);
  });
});

describe('formato e sprites', () => {
  it('formato mm:ss e h:mm:ss, arredondando para cima', () => {
    expect(formatarRestante(192_000)).toBe('03:12');
    expect(formatarRestante(1)).toBe('00:01');
    expect(formatarRestante(0)).toBe('00:00');
    expect(formatarRestante(3_725_000)).toBe('1:02:05');
  });

  it('os sprites da L7 existem em public (ícones em /mapa, aventureiros em /sprites/aventureiro, todos os quadros)', () => {
    for (const n of ['icone-expedicao', 'icone-bloqueado', ...CLASSES.flatMap((c) => animacao('aventureiro', c).quadros)]) {
      expect(existsSync(arquivoDoSprite(n)), n).toBe(true);
    }
    expect(DESTINOS_IDS).toHaveLength(6);
  });
});
