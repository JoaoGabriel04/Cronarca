// Portão 18b: a Falha. Sobe 1 por Ascensão (até 10); tempo de obras e
// pesquisas +3% por nível, Estradas Reais e Carta Real +5% por nível; o
// perigo da Cripta tem o campo pronto, com acréscimo 0 até o Portão 25.
import { describe, expect, it } from 'vitest';
import { NIVEL_MAXIMO_CONSTRUCAO } from '../data/construcoes.ts';
import { DESTINOS, DESTINOS_IDS } from '../data/expedicoes.ts';
import { FALHA } from '../data/falha.ts';
import { PESQUISAS, PESQUISAS_IDS } from '../data/pesquisas.ts';
import type { Recurso } from '../data/recursos.ts';
import { aplicarAcao } from '../src/acoes.ts';
import { carregarEstado, esquemaEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { custoPesquisa, duracaoPesquisaMs, perigoDestino, tempoObraMs, tetoMicro } from '../src/formulas.ts';
import { estadoInicial } from '../src/inicial.ts';
import { micro } from '../src/inteiros.ts';
import { liquidar } from '../src/liquidar.ts';
import { preverAcao } from '../src/previsao.ts';
import { comRecursos, fazer, MIN, novo, SEG, T0, u } from './ajuda.ts';

/** Tempos de obra do código antes do 18b (HEAD 2e7b028), níveis 1 a 10. */
const TEMPOS_ANTES = [30000, 42000, 58800, 82320, 115248, 161347, 225886, 316241, 442737, 619831];

/** Estado pronto para ascender (os três objetivos da Era I). */
function prontoParaAscender(falha: number): EstadoJogo {
  const e = novo();
  e.falha = falha;
  e.pesquisas.concluidas.push('carta_real');
  e.objetivos.criptaVencida = true;
  e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
  e.slots.casa_1.nivel = 10;
  return e;
}

describe('Falha 0 é o jogo de antes', () => {
  it('conta nova começa em 0', () => {
    expect(estadoInicial({ semente: 1, agora: T0 }).falha).toBe(0);
  });

  it('tempos de obra (níveis 1 a 10) e de pesquisa, e custos de pesquisa, idênticos', () => {
    expect(Array.from({ length: NIVEL_MAXIMO_CONSTRUCAO }, (_, i) => tempoObraMs(i + 1, 0))).toEqual(TEMPOS_ANTES);
    for (const id of PESQUISAS_IDS) {
      expect(duracaoPesquisaMs(id, 0)).toBe(PESQUISAS[id].segundos * 1000);
      const esperado = Object.fromEntries(Object.entries(PESQUISAS[id].custo).map(([r, v]) => [r, micro(v)]));
      expect(custoPesquisa(id, 0)).toEqual(esperado);
    }
    for (const d of DESTINOS_IDS) expect(perigoDestino(d, 0)).toBe(DESTINOS[d].perigo);
  });
});

describe('efeitos por nível', () => {
  it('obras e pesquisas +3% por nível (Falha 10: +30%)', () => {
    expect(tempoObraMs(1, 1)).toBe(30_900);
    expect(tempoObraMs(10, 10)).toBe(805_780); // 619.831 × 1,3, arredondado
    expect(duracaoPesquisaMs('carta_real', 1)).toBe(185_400);
    expect(duracaoPesquisaMs('carta_real', 10)).toBe(234_000);
    expect(duracaoPesquisaMs('hospitalidade', 10)).toBe(78_000);
  });

  it('só Estradas Reais e Carta Real encarecem, +5% por nível', () => {
    expect(custoPesquisa('carta_real', 1)).toEqual({ saber: u(315), ouro: u(84) });
    expect(custoPesquisa('carta_real', 10)).toEqual({ saber: u(450), ouro: u(120) });
    expect(custoPesquisa('estradas_reais', 10)).toEqual({ saber: u(225), ouro: u(60) });
    for (const id of ['hospitalidade', 'cartografia', 'colheita_farta'] as const) {
      expect(custoPesquisa(id, 10)).toEqual(custoPesquisa(id, 0));
    }
  });

  it('Cripta: campo pronto, acréscimo 0 por enquanto (liga no Portão 25); nenhum destino muda', () => {
    expect(FALHA.perigoPorNivel).toBe(0);
    for (let f = 0; f <= FALHA.nivelMaximo; f++) {
      for (const d of DESTINOS_IDS) expect(perigoDestino(d, f)).toBe(DESTINOS[d].perigo);
    }
  });

  it('as ações usam a Falha do estado: obra e pesquisa mais lentas, Carta Real mais cara', () => {
    // Carta Real na Falha 4 custa 360 de saber: precisa do Armazém 2 (465).
    const base = novo();
    base.slots.armazem_1.nivel = 2;
    let e = comRecursos(base, { madeira: 300, pedra: 300, saber: 400, ouro: 300 });
    e.falha = 4;
    e = fazer(e, { tipo: 'melhorar', slot: 'casa_1' });
    expect(e.slots.casa_1.obraAte).toBe(e.t + tempoObraMs(2, 4));
    expect(e.slots.casa_1.obraAte! - e.t).toBe(47_040); // 42.000 × 1,12
    e.pesquisas.concluidas.push('cartografia', 'estradas_reais');
    const saber = e.recursos.saber;
    e = fazer(e, { tipo: 'pesquisar', pesquisa: 'carta_real' });
    expect(saber - e.recursos.saber).toBe(u(360)); // 300 × 1,2
    expect(e.pesquisas.atual!.fim - e.t).toBe(201_600); // 180 s × 1,12
  });
});

describe('ascensão', () => {
  it('sobe a Falha em 1 e a mantém no ciclo seguinte', () => {
    const d = fazer(prontoParaAscender(0), { tipo: 'ascender' });
    expect(d.falha).toBe(1);
    expect(d.ciclo).toBe(2);
    expect(() => esquemaEstado.parse(d)).not.toThrow();
    // O ciclo seguinte reflete a Falha.
    const obra = fazer(comRecursos(d, { madeira: 300, pedra: 300 }), { tipo: 'melhorar', slot: 'casa_1' });
    expect(obra.slots.casa_1.obraAte! - obra.t).toBe(tempoObraMs(2, 1));
  });

  it('não passa do teto (10)', () => {
    expect(fazer(prontoParaAscender(9), { tipo: 'ascender' }).falha).toBe(10);
    expect(fazer(prontoParaAscender(10), { tipo: 'ascender' }).falha).toBe(10);
    expect(() => esquemaEstado.parse({ ...novo(), falha: 11 })).toThrow();
  });
});

describe('Era I completável em todos os níveis de Falha', () => {
  it('a cadeia da Carta Real cabe: tudo no Armazém máximo e a Carta Real já no Armazém 2', () => {
    for (let f = 0; f <= FALHA.nivelMaximo; f++) {
      for (const id of PESQUISAS_IDS) {
        for (const [r, v] of Object.entries(custoPesquisa(id, f)) as [Recurso, number][]) {
          expect(v, `${id} ${r} na Falha ${f}`).toBeLessThanOrEqual(tetoMicro(NIVEL_MAXIMO_CONSTRUCAO));
          expect(v, `${id} ${r} na Falha ${f} (Armazém 2)`).toBeLessThanOrEqual(tetoMicro(2));
        }
      }
      // Perigo da Cripta não muda enquanto o acréscimo for 0.
      expect(perigoDestino('cripta', f)).toBe(DESTINOS.cripta.perigo);
    }
  });
});

describe('previsão e liquidação', () => {
  it('previsão do cliente igual ao servidor na Falha 7', () => {
    const e = comRecursos(novo(), { madeira: 300, pedra: 300, saber: 300 });
    e.falha = 7;
    for (const acao of [{ tipo: 'melhorar', slot: 'casa_1' }, { tipo: 'pesquisar', pesquisa: 'cartografia' }] as const) {
      const agora = e.t + 3 * SEG;
      const servidor = aplicarAcao(e, acao, agora);
      const { segredo: _s, ...visao } = e;
      const cliente = preverAcao(visao, acao, agora);
      expect(servidor.ok && cliente.ok).toBe(true);
      const { segredo: _s2, ...esperado } = servidor.estado;
      expect(cliente.estado).toEqual(esperado);
    }
  });

  it('um passo = muitos passos com obra e pesquisa na Falha 5', () => {
    let e = comRecursos(novo(), { madeira: 300, pedra: 300, saber: 300 });
    e.falha = 5;
    e = fazer(e, { tipo: 'melhorar', slot: 'casa_1' });
    e = fazer(e, { tipo: 'pesquisar', pesquisa: 'cartografia' });
    const alvo = e.t + 4 * MIN;
    const umPasso = liquidar(e, alvo);
    let muitos = e;
    for (let t = e.t + 1300; t < alvo; t += 1300) muitos = liquidar(muitos, t);
    expect(liquidar(muitos, alvo)).toEqual(umPasso);
    expect(umPasso.slots.casa_1.nivel).toBe(2);
    expect(umPasso.pesquisas.concluidas).toContain('cartografia');
  });
});

describe('esquema 7 (Falha)', () => {
  it('save do esquema 6 migra com falha 0 (ninguém é afetado retroativamente)', () => {
    const atual = liquidar(novo(), T0 + 10 * MIN);
    const { falha: _f, diario: _d, prologoVisto: _p, ...v6 } = { ...atual, versao: 6 };
    const carregado = carregarEstado(JSON.parse(JSON.stringify(v6)), 6);
    expect(VERSAO_ESQUEMA).toBeGreaterThanOrEqual(7);
    // O Quartel General (esquema 10) entra oculto, desde o instante do save migrado.
    expect(carregado).toEqual({ ...atual, versao: VERSAO_ESQUEMA, falha: 0, prologoVisto: true, qg: { estado: 'oculto', desde: atual.t } });
    // Mesmo quem já ascendeu (ciclo 5) começa na Falha 0.
    const ciclo5 = carregarEstado(JSON.parse(JSON.stringify({ ...v6, ciclo: 5 })), 6);
    expect(ciclo5.falha).toBe(0);
  });
});
