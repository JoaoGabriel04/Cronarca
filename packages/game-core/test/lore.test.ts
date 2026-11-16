// Portão 16: lore, Diário e próximo passo.
import { describe, expect, it } from 'vitest';
import { CAPITULOS, CAPITULOS_IDS, PROLOGO, SABIO } from '../data/lore.ts';
import { PESQUISAS } from '../data/pesquisas.ts';
import { aplicarAcao } from '../src/acoes.ts';
import { CONDICOES } from '../src/diario.ts';
import { carregarEstado, esquemaEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { custoPesquisa } from '../src/formulas.ts';
import { estadoInicial } from '../src/inicial.ts';
import { liquidar } from '../src/liquidar.ts';
import { proximoPasso } from '../src/objetivo.ts';
import { preverAcao } from '../src/previsao.ts';
import { comRecursos, fazer, MIN, novo, SEG, T0, u } from './ajuda.ts';

const frases = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean).length;
const EMOJI = /\p{Extended_Pictographic}/u;

describe('lore.ts', () => {
  it('ids únicos, todos com condição; prólogo com 3 cartões de até 2 frases; capítulos com até 3 frases; sem emoji', () => {
    expect(new Set(CAPITULOS_IDS).size).toBe(CAPITULOS_IDS.length);
    expect(Object.keys(CAPITULOS).sort()).toEqual([...CAPITULOS_IDS].sort());
    expect(Object.keys(CONDICOES).sort()).toEqual([...CAPITULOS_IDS].sort());
    expect(PROLOGO).toHaveLength(3);
    for (const c of PROLOGO) {
      expect(frases(c)).toBeLessThanOrEqual(2);
      expect(c).not.toMatch(EMOJI);
    }
    for (const id of CAPITULOS_IDS) {
      const c = CAPITULOS[id];
      expect(frases(c.texto), id).toBeLessThanOrEqual(3);
      for (const t of [c.titulo, c.texto, c.dica ?? '']) expect(t, id).not.toMatch(EMOJI);
      expect(c.dica === null, id).toBe(id === 'prologo');
    }
    expect(`${SABIO.prefixo} ${SABIO.guardeOuro('40', 'Estradas Reais')}`).not.toMatch(EMOJI);
  });
});

/** Vila pronta para pesquisar: Scriptorium de pé e recursos de sobra no Armazém 3. */
function comScriptorium(): EstadoJogo {
  const e = novo();
  e.slots.scriptorium_1.nivel = 1;
  e.slots.armazem_1.nivel = 3;
  e.diario.push('scriptorium');
  return comRecursos(e, { madeira: 500, pedra: 500, saber: 500, ouro: 500, comida: 300 });
}

describe('proximoPasso', () => {
  it('conta nova: a Pedreira vem antes do Scriptorium (a pedra inicial não chega)', () => {
    const p = proximoPasso(novo());
    expect(p.principal).toBe('Construa a Pedreira: madeira 100 de 180');
    expect(p.ascender).toBe(false);
    expect(p.trilhas.map((t) => t.trilha)).toEqual(['carta_real', 'cripta', 'aldeoes']);
    expect(p.trilhas[0]).toMatchObject({ motivo: 'falta pedra para o Scriptorium', pronto: false });
    expect(p.trilhas[1]).toMatchObject({ motivo: 'falta a pesquisa Estradas Reais' });
    expect(p.sabio).toBe('O Sábio diz: falta pedra para o Scriptorium.');
  });

  it('com a Pedreira e pedra para ele: o Scriptorium', () => {
    const e = comRecursos(novo(), { madeira: 200, pedra: 150 });
    e.slots.pedreira_1.nivel = 1;
    expect(proximoPasso(e).principal).toBe('Construa o Scriptorium');
  });

  it('depois do Scriptorium e de cada pesquisa: a próxima da cadeia', () => {
    const e = comScriptorium();
    expect(proximoPasso(e).principal).toBe('Pesquise Cartografia');
    e.pesquisas.concluidas.push('cartografia');
    expect(proximoPasso(e).principal).toBe('Pesquise Estradas Reais');
    e.pesquisas.concluidas.push('estradas_reais');
    expect(proximoPasso(e).principal).toBe('Pesquise Carta Real');
    e.pesquisas.concluidas.push('carta_real');
    const p = proximoPasso(e);
    expect(p.trilhas[0]).toMatchObject({ cumprida: true, passo: 'Cumprido' });
    // Cripta aberta, Lanceiro inicial fraco: fortalecer a guilda.
    expect(p.principal).toMatch(/^Fortaleça a guilda: \d+% na Cripta$/);
  });

  it('pesquisa em andamento: aguardar, com o tempo que falta', () => {
    const e = fazer(comScriptorium(), { tipo: 'pesquisar', pesquisa: 'cartografia' });
    expect(proximoPasso(e).trilhas[0]).toMatchObject({ passo: 'Aguarde a pesquisa: Cartografia', motivo: 'termina em 1:30' });
  });

  it('falta recurso para a pesquisa: o que falta, do dado; sem Mercado, o Sábio aponta a fonte de ouro', () => {
    const e = comScriptorium();
    e.pesquisas.concluidas.push('cartografia');
    e.recursos.ouro = u(12);
    const p = proximoPasso(e);
    expect(p.trilhas[0]).toMatchObject({ passo: 'Pesquise Estradas Reais: ouro 12 de 40', motivo: 'falta ouro: construa o Mercado ou explore as Ruínas' });
  });

  it('conflito do ouro: o Sábio pede para guardar o ouro das Estradas Reais (valor dos dados)', () => {
    const e = comScriptorium();
    e.pesquisas.concluidas.push('cartografia');
    e.recursos.ouro = u(30);
    const ouro = (custoPesquisa('estradas_reais', e.falha).ouro ?? 0) / 1_000_000;
    expect(proximoPasso(e).sabio).toBe(`O Sábio diz: guarde ${ouro} de ouro para as ${PESQUISAS.estradas_reais.nome}.`);
    // Guilda cheia: não há onde gastar ouro, a dica não aparece.
    e.aventureiros = Array.from({ length: 4 }, (_, i) => ({ ...e.aventureiros[0]!, id: `a${i + 10}` }));
    expect(proximoPasso(e).sabio).not.toMatch(/guarde/);
  });

  it('custo acima do teto (Falha 4, Armazém 1): ampliar o Armazém', () => {
    const e = comScriptorium();
    e.slots.armazem_1.nivel = 1;
    e.falha = 4;
    e.pesquisas.concluidas.push('cartografia', 'estradas_reais');
    expect(proximoPasso(e).trilhas[0]).toMatchObject({ passo: 'Amplie o Armazém para Carta Real', motivo: 'pede 360 de saber; o Armazém guarda 300' });
  });

  it('com fome: mudar aldeões para Fazendeiro', () => {
    const e = novo();
    e.recursos.comida = 0;
    e.aldeoes = [{ oficio: 'lenhador' }, { oficio: 'mineiro' }];
    expect(proximoPasso(e).principal).toBe('Sem comida: mude aldeões para Fazendeiro');
  });

  it('Casas cheias: melhorar a Casa (com o que falta, ou pronto quando cabe)', () => {
    const e = comRecursos(novo(), { madeira: 50 });
    e.aldeoes = Array.from({ length: 4 }, () => ({ oficio: 'fazendeiro' as const }));
    expect(proximoPasso(e).trilhas[2]).toMatchObject({ passo: 'Melhore a Casa: 4 de 4 vagas', pronto: false });
    const rico = comRecursos(e, { madeira: 300, pedra: 300 });
    rico.slots.scriptorium_1.obraAte = rico.t + MIN; // Carta Real esperando
    expect(proximoPasso(rico).principal).toBe('Melhore a Casa: 4 de 4 vagas');
  });

  it('Cripta aberta e grupo forte: enviar, com o perigo do dado', () => {
    const e = comScriptorium();
    e.pesquisas.concluidas.push('cartografia', 'estradas_reais', 'carta_real');
    e.aventureiros = [0, 1, 2].map((i) => ({ ...e.aventureiros[0]!, id: `a${i + 10}`, nivel: 8, arma: 4, armadura: 4 }));
    expect(proximoPasso(e).principal).toBe('Envie um grupo à Cripta (perigo 70)');
  });

  it('tudo cumprido: ascender', () => {
    const e = comScriptorium();
    e.pesquisas.concluidas.push('cartografia', 'estradas_reais', 'carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    e.slots.casa_1.nivel = 10;
    const p = proximoPasso(e);
    expect(p.ascender).toBe(true);
    expect(p.trilhas.every((t) => t.cumprida)).toBe(true);
  });

  it('nunca vazio e sempre curto ao longo de 40 min de conta nova (frases de até 45 caracteres)', () => {
    let e = novo();
    for (let t = 0; t <= 40 * MIN; t += 20 * SEG) {
      e = liquidar(e, T0 + t);
      const p = proximoPasso(e);
      expect(p.principal.length).toBeGreaterThan(0);
      expect(p.principal.length, p.principal).toBeLessThanOrEqual(45);
    }
  });
});

describe('Diário', () => {
  it('conta nova: só o prólogo, sem linha na Crônica, ainda não visto', () => {
    const e = estadoInicial({ semente: 1, agora: T0 });
    expect(e.diario).toEqual(['prologo']);
    expect(e.prologoVisto).toBe(false);
    expect(e.cronica.some((l) => l.icone === 'Diario')).toBe(false);
  });

  it('um ciclo inteiro libera os capítulos na ordem, uma linha na Crônica cada, e nada se repete depois de ascender', () => {
    let e = comRecursos(novo(), { madeira: 300, pedra: 300 });
    e = fazer(e, { tipo: 'construir', slot: 'scriptorium_1' });
    e = liquidar(e, e.t + MIN);
    expect(e.diario).toEqual(['prologo', 'scriptorium']);
    const marcos: [string, (x: EstadoJogo) => void][] = [
      ['cartografia', (x) => x.pesquisas.concluidas.push('cartografia')],
      ['estradas_reais', (x) => x.pesquisas.concluidas.push('estradas_reais')],
      ['carta_real', (x) => x.pesquisas.concluidas.push('carta_real')],
      ['cripta_vencida', (x) => { x.objetivos.criptaVencida = true; }],
      ['aldeoes_40', (x) => { x.slots.casa_1.nivel = 10; x.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const })); }],
    ];
    for (const [id, cumprir] of marcos) {
      cumprir(e);
      e = liquidar(e, e.t + SEG);
      expect(e.diario.at(-1)).toBe(id);
      expect(e.cronica.at(-1)!.texto).toBe(`Nova página no Diário: ${CAPITULOS[id as keyof typeof CAPITULOS].titulo}.`);
    }
    const antes = e.cronica.filter((l) => l.icone === 'Diario').length;
    const d = fazer(e, { tipo: 'ascender' });
    expect(d.diario).toEqual(['prologo', 'scriptorium', 'cartografia', 'estradas_reais', 'carta_real', 'cripta_vencida', 'aldeoes_40', 'primeira_ascensao']);
    expect(d.cronica.filter((l) => l.icone === 'Diario')).toHaveLength(antes + 1);
    // O ciclo seguinte refaz os marcos sem liberar de novo.
    d.pesquisas.concluidas.push('cartografia');
    const l = liquidar(d, d.t + SEG);
    expect(l.diario).toEqual(d.diario);
    expect(l.cronica.filter((x) => x.icone === 'Diario')).toHaveLength(antes + 1);
    expect(() => esquemaEstado.parse(l)).not.toThrow();
  });

  it('Falha 3 libera "Rachaduras"', () => {
    const e = novo();
    e.falha = 3;
    expect(liquidar(e, e.t + SEG).diario).toContain('falha_3');
  });

  it('fechar_prologo marca visto; previsto no cliente igual ao servidor; atravessa a ascensão', () => {
    const e = novo();
    const servidor = aplicarAcao(e, { tipo: 'fechar_prologo' }, e.t + SEG);
    const { segredo: _s, ...visao } = e;
    const cliente = preverAcao(visao, { tipo: 'fechar_prologo' }, e.t + SEG);
    expect(servidor.ok && cliente.ok).toBe(true);
    expect(servidor.estado.prologoVisto).toBe(true);
    const { segredo: _s2, ...esperado } = servidor.estado;
    expect(cliente.estado).toEqual(esperado);
  });
});

describe('esquema 8', () => {
  const v7 = (e: EstadoJogo) => {
    const { diario: _d, prologoVisto: _p, ...resto } = { ...e, versao: 7 };
    return JSON.parse(JSON.stringify(resto));
  };

  it('conta no ciclo 1: o que já vale hoje; o prólogo não abre de novo', () => {
    const e = novo();
    e.slots.scriptorium_1.nivel = 1;
    e.pesquisas.concluidas.push('cartografia');
    const c = carregarEstado(v7(e), 7);
    expect(VERSAO_ESQUEMA).toBeGreaterThanOrEqual(8);
    expect(c.diario).toEqual(['prologo', 'scriptorium', 'cartografia']);
    expect(c.prologoVisto).toBe(true);
    expect(c.cronica).toEqual(e.cronica); // a migração não escreve na Crônica
  });

  it('quem já ascendeu (ciclo 3, Falha 3): a Era I inteira, a primeira ascensão e Rachaduras', () => {
    const e = novo();
    e.ciclo = 3;
    e.falha = 3;
    expect(carregarEstado(v7(e), 7).diario).toEqual([...CAPITULOS_IDS]);
  });
});
