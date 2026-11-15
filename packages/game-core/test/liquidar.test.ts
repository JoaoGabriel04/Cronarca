import { describe, expect, it } from 'vitest';
import { OFICIOS } from '../data/aventureiros.ts';
import { EVENTOS_IDS } from '../data/eventos.ts';
import { DESTINOS_IDS } from '../data/expedicoes.ts';
import { PESQUISAS_IDS } from '../data/pesquisas.ts';
import { SLOT_IDS } from '../data/slots.ts';
import { aplicarAcao, type Acao } from '../src/acoes.ts';
import type { EstadoJogo } from '../src/estado.ts';
import { esquemaEstado } from '../src/estado.ts';
import { estadoInicial } from '../src/inicial.ts';
import { formatarInteiro } from '../src/cronica.ts';
import { aplicarEvento, liquidar } from '../src/liquidar.ts';
import { abrirMercador } from '../src/mercador.ts';
import { calcularTaxas, tetos } from '../src/regras.ts';
import { criarSorteador } from '../src/rng.ts';
import { comRecursos, fazer, MIN, novo, SEG, T0, u } from './ajuda.ts';

describe('taxas', () => {
  it('estado inicial: serraria 1 com 1 lenhador (+5%), fazendeiro menos consumo', () => {
    const { producao, consumoComida, saldo } = calcularTaxas(novo());
    expect(producao.madeira).toBe(1050);
    expect(producao.comida).toBe(350);
    expect(consumoComida).toBe(2 * 50 + 80);
    expect(saldo.comida).toBe(170);
    expect(saldo.pedra).toBe(0);
  });

  it('bônus da mesma categoria somam, de categorias diferentes multiplicam', () => {
    const e = novo();
    e.reliquias.niveis.sabedoria_ancestral = 2; // +30% saber
    e.reliquias.niveis.bencao_colheita = 1; // +10% geral
    e.slots.scriptorium_1.nivel = 5; // 0,12 × 5 = 0,6/s
    e.aldeoes.push({ oficio: 'sabio' }, { oficio: 'sabio' }); // +10% ofício
    // 600 × 1,1 = 660; × 1,3 = 858; × 1,1 = 943,8 -> 944
    expect(calcularTaxas(e).producao.saber).toBe(944);
  });
});

describe('liquidação', () => {
  it('produz linearmente no tempo', () => {
    const e = liquidar(novo(), T0 + 10 * SEG);
    expect(e.recursos.madeira).toBe(u(100) + 1050 * 10_000);
    expect(e.t).toBe(T0 + 10 * SEG);
  });

  it('não volta no tempo e não altera o estado recebido', () => {
    const e = novo();
    const copia = structuredClone(e);
    expect(liquidar(e, T0 - 5000)).toEqual(e);
    liquidar(e, T0 + 60 * MIN);
    expect(e).toEqual(copia);
  });

  it('descarta a produção acima do teto', () => {
    const e = liquidar(novo(), T0 + 2 * 60 * MIN);
    expect(e.recursos.madeira).toBe(tetos(e).madeira);
    expect(e.recursos.madeira).toBe(u(300));
  });

  it('aldeões chegam a cada 20 s até as vagas, com ofícios em rodízio', () => {
    const e = liquidar(novo(), T0 + 39_999);
    expect(e.aldeoes).toHaveLength(3);
    const cheio = liquidar(novo(), T0 + 10 * MIN);
    expect(cheio.aldeoes.map((a) => a.oficio)).toEqual(['fazendeiro', 'lenhador', 'mineiro', 'sabio']);
    // Casa nível 2: 8 vagas, o rodízio continua (ferreiro, fazendeiro...).
    cheio.slots.casa_1.nivel = 2;
    const mais = liquidar(cheio, cheio.t + 80 * SEG);
    expect(mais.aldeoes.map((a) => a.oficio).slice(4)).toEqual(['ferreiro', 'fazendeiro', 'lenhador', 'mineiro']);
  });

  it('comida zerada: ninguém morre, os bônus de ofício param e o próximo aldeão (Fazendeiro) segue a caminho', () => {
    const e = comRecursos(novo(), { comida: 1 });
    e.aldeoes = [{ oficio: 'lenhador' }, { oficio: 'lenhador' }]; // sem fazendeiro: só consumo
    // consumo 180 milésimos/s: 1 unidade acaba em ceil(1_000_000 / 180) = 5556 ms
    const d = liquidar(e, T0 + 10 * SEG);
    expect(d.recursos.comida).toBe(0);
    expect(d.aldeoes).toHaveLength(2);
    // 5556 ms a 1100 (2 lenhadores) + 4444 ms a 1000 (sem bônus)
    expect(d.recursos.madeira).toBe(u(100) + 1100 * 5556 + 1000 * 4444);
    // Com vaga, a chegada continua contando mesmo sem comida (quem chegar será Fazendeiro).
    expect(d.progressoAldeaoMs).toBe(10_000);
    expect(liquidar(e, T0 + 20 * SEG).aldeoes.at(-1)).toEqual({ oficio: 'fazendeiro' });
  });

  it('comida voltando religa os bônus e a chegada de aldeões', () => {
    const e = comRecursos(novo(), { comida: 0 });
    // saldo positivo (fazendeiro 350 − consumo 180): sai do zero no ms seguinte
    const d = liquidar(e, T0 + 20 * SEG + 1);
    expect(d.recursos.comida).toBeGreaterThan(0);
    expect(d.aldeoes).toHaveLength(3);
  });

  it('obra termina e comida zera no mesmo intervalo (caso do handoff): um passo = muitos passos', () => {
    const e = comRecursos(novo(), { comida: 1 });
    e.aldeoes = [{ oficio: 'lenhador' }, { oficio: 'lenhador' }];
    e.slots.serraria_2 = { tipo: 'serraria', nivel: 0, obraAte: T0 + 3000 }; // termina antes da comida zerar
    e.slots.armazem_1 = { tipo: 'armazem', nivel: 1, obraAte: T0 + 5556 }; // termina no mesmo ms em que zera
    const umPasso = liquidar(e, T0 + 20 * SEG);
    let passos = e;
    for (let t = T0 + 1; t <= T0 + 20 * SEG; t += 997) passos = liquidar(passos, t);
    passos = liquidar(passos, T0 + 20 * SEG);
    expect(passos).toEqual(umPasso);

    expect(umPasso.slots.serraria_2.nivel).toBe(1);
    expect(umPasso.slots.armazem_1.nivel).toBe(2);
    expect(umPasso.recursos.comida).toBe(0);
    // 0–3000: 1 serraria a 1100; 3000–5556: 2 serrarias a 2200; depois 2000 sem bônus.
    expect(umPasso.recursos.madeira).toBe(u(100) + 1100 * 3000 + 2200 * 2556 + 2000 * (20_000 - 5556));
  });
});

describe('eventos', () => {
  it('um evento a cada 10 a 20 minutos, sorteado e aplicado também offline', () => {
    const e = estadoInicial({ semente: 5, agora: T0 });
    const primeiro = e.segredo.proximoEventoEm - T0;
    expect(primeiro).toBeGreaterThanOrEqual(10 * MIN);
    expect(primeiro).toBeLessThanOrEqual(20 * MIN);
    const d = liquidar(e, T0 + 10 * 60 * MIN);
    const eventos = d.cronica.filter((l) => l.icone === 'Evento' || l.icone === 'Alerta');
    expect(eventos.length).toBeGreaterThanOrEqual(30);
    expect(eventos.length).toBeLessThanOrEqual(62); // inclui "seguiu viagem" do Mercador
    expect(d.segredo.proximoEventoEm).toBeGreaterThan(d.t);
  });

  it('o mesmo estado sorteia os mesmos eventos', () => {
    const a = liquidar(estadoInicial({ semente: 77, agora: T0 }), T0 + 5 * 60 * MIN);
    const b = liquidar(estadoInicial({ semente: 77, agora: T0 }), T0 + 5 * 60 * MIN);
    expect(a).toEqual(b);
    const c = liquidar(estadoInicial({ semente: 78, agora: T0 }), T0 + 5 * 60 * MIN);
    expect(c.cronica).not.toEqual(a.cronica);
  });

  it('cada evento tem o efeito do handoff', () => {
    const base = comRecursos(novo(), { madeira: 200, comida: 100, ouro: 40, saber: 0 });
    const ev = (id: (typeof EVENTOS_IDS)[number], ajuste?: (e: EstadoJogo) => void) => {
      const e = structuredClone(base);
      ajuste?.(e);
      aplicarEvento(e, id, T0);
      return e;
    };
    expect(ev('tempestade').recursos.madeira).toBe(u(230));
    expect(ev('festival_colheita').recursos.comida).toBe(u(140));
    expect(ev('cometa').recursos.saber).toBe(u(20));
    expect(ev('incendio').recursos.madeira).toBe(u(180));
    const roubado = ev('bandidos');
    expect(roubado.recursos.ouro).toBe(u(34));
    expect(roubado.recursos.comida).toBe(u(85));
    const protegido = ev('bandidos', (e) => (e.slots.muralha_1.nivel = 1));
    expect(protegido.recursos.ouro).toBe(u(40));
    // Os termos vão no evento: a tela mostra e a resposta cobra exatamente isto.
    const m = ev('mercador_viajante');
    expect(m.mercador).toEqual({ expiraEm: T0 + 120 * SEG, paga: { madeira: u(100) }, recebe: { ouro: u(15) } });
    expect(m.cronica.at(-1)?.texto).toBe('Mercador Viajante: troca 100 madeira por 15 ouro.');
    // Ganho de evento também é cortado no teto.
    expect(ev('tempestade', (e) => (e.recursos.madeira = u(290))).recursos.madeira).toBe(u(300));
  });

  it('a Crônica mostra quantidades inteiras, arredondadas, com ponto de milhar', () => {
    expect(formatarInteiro(7_702_000)).toBe('8');
    expect(formatarInteiro(7_499_999)).toBe('7');
    expect(formatarInteiro(1_284_400_000)).toBe('1.284');
    expect(formatarInteiro(1_234_567_000_000)).toBe('1.234.567');
    expect(formatarInteiro(0)).toBe('0');
    // Bandidos levam 15%: com 51,34 de ouro e 51,34 de comida o roubo é fracionado.
    const e = comRecursos(novo(), { ouro: 51.34, comida: 51.34 });
    aplicarEvento(e, 'bandidos', T0);
    const linha = e.cronica.at(-1)!.texto;
    expect(linha).toMatch(/levaram 8 ouro e 8 comida\.$/);
    expect(linha).not.toMatch(/\d,\d/);
  });

  it('Mercador sem resposta em 120 s vale Ignorar', () => {
    const e = novo();
    abrirMercador(e, T0);
    const d = liquidar(e, T0 + 121 * SEG);
    expect(d.mercador).toBeNull();
    expect(d.cronica.at(-1)?.texto).toMatch(/seguiu viagem/);
    expect(d.recursos.ouro).toBe(u(40));
  });
});

// ---------------------------------------------------------------------------
// Propriedade: liquidar em um passo ou em muitos dá exatamente o mesmo estado.

function acaoAleatoria(e: EstadoJogo, s: ReturnType<typeof criarSorteador>): Acao {
  const naVila = e.aventureiros.filter((a) => a.estado === 'na_vila').map((a) => a.id);
  const opcoes: Acao[] = [
    { tipo: 'construir', slot: s.escolher(SLOT_IDS) },
    { tipo: 'melhorar', slot: s.escolher(SLOT_IDS) },
    { tipo: 'pesquisar', pesquisa: s.escolher(PESQUISAS_IDS) },
    { tipo: 'contratar' },
    { tipo: 'partir_expedicao', destino: s.escolher(DESTINOS_IDS), grupo: naVila.slice(0, s.inteiro(1, 3)) },
    { tipo: 'clicar', objeto: s.escolher(['serraria_1', 'serraria_2', 'pedreira_1']), quantidade: s.inteiro(1, 8) },
    { tipo: 'responder_mercador', aceitar: s.chance(5000) },
  ];
  return s.escolher(opcoes);
}

function estadoAleatorio(semente: number): EstadoJogo {
  const s = criarSorteador(semente);
  let e = estadoInicial({ semente, agora: T0 });
  // Recursos fartos para as ações passarem com frequência.
  for (const r of ['madeira', 'pedra', 'ferro', 'ouro', 'saber'] as const) e.recursos[r] = s.inteiro(0, u(300));
  e.recursos.comida = s.inteiro(0, u(60));
  e.slots.armazem_1.nivel = s.inteiro(1, 4);
  e.slots.casa_1.nivel = s.inteiro(1, 3);
  for (let i = s.inteiro(0, 6); i > 0; i--) e.aldeoes.push({ oficio: s.escolher(OFICIOS) });
  let t = T0;
  for (let i = 0; i < 25; i++) {
    t += s.inteiro(0, 90 * SEG);
    const acao = acaoAleatoria(e, s);
    if (acao.tipo === 'partir_expedicao' && acao.grupo.length === 0) continue;
    e = aplicarAcao(e, acao, t).estado;
  }
  // No ponto de partida, comida zerada com frequência: é onde as taxas mudam de regime.
  if (s.chance(4000)) e.recursos.comida = 0;
  return e;
}

describe('propriedade: um passo = muitos passos', () => {
  it('vale para 300 estados aleatórios com cortes aleatórios (inclui obras, pesquisas, expedições e eventos)', () => {
    for (let semente = 1; semente <= 300; semente++) {
      const e = estadoAleatorio(semente);
      const s = criarSorteador(semente * 7919);
      const alvo = e.t + s.inteiro(1, 3 * 60 * MIN);
      const umPasso = liquidar(e, alvo);
      let passos = e;
      let t = e.t;
      while (t < alvo) {
        // Cortes de 1 ms a 5 min: cortes minúsculos caem dentro das transições.
        t = Math.min(alvo, t + (s.chance(3000) ? s.inteiro(1, 50) : s.inteiro(1, 5 * MIN)));
        passos = liquidar(passos, t);
      }
      expect(passos, `semente ${semente}`).toEqual(umPasso);
      expect(() => esquemaEstado.parse(umPasso)).not.toThrow();
    }
  }, 30_000); // pesado
});

describe('chegada de aldeões na Crônica', () => {
  it('cada aldeão que chega escreve uma linha com o ofício, no instante da chegada', () => {
    const e = novo();
    const d = liquidar(e, T0 + 45 * SEG);
    const linhas = d.cronica.filter((l) => l.icone === 'Aldeao');
    expect(d.aldeoes.map((a) => a.oficio)).toEqual(['fazendeiro', 'lenhador', 'mineiro', 'sabio']);
    expect(linhas.map((l) => l.texto)).toEqual(['Um mineiro chegou à vila.', 'Um sábio chegou à vila.']);
    expect(linhas.map((l) => l.em)).toEqual([T0 + 20 * SEG, T0 + 40 * SEG]);
  });
});

describe('fome não trava a vila', () => {
  it('com a comida em 0 e vaga nas Casas, o aldeão chega como Fazendeiro e a comida volta a subir', () => {
    const e = novo();
    // Casa 1 cheia (4 aldeões) e 2 aventureiros: saldo de −0,01/s, comida parada em 0.
    e.aldeoes = [{ oficio: 'fazendeiro' }, { oficio: 'lenhador' }, { oficio: 'mineiro' }, { oficio: 'sabio' }];
    e.aventureiros.push({ ...e.aventureiros[0]!, id: 'a99', nome: 'Violante' });
    e.recursos.comida = 0;
    e.slots.casa_1.nivel = 2; // melhorou a Casa: 4 vagas novas
    const d = liquidar(e, T0 + 25 * SEG);
    expect(d.aldeoes.at(-1)).toEqual({ oficio: 'fazendeiro' });
    expect(d.cronica.at(-1)?.texto).toBe('Um fazendeiro chegou à vila.');
    expect(d.recursos.comida).toBeGreaterThan(0);
  });

  it('com comida, o rodízio segue igual', () => {
    const e = novo();
    e.aldeoes = [{ oficio: 'fazendeiro' }, { oficio: 'lenhador' }, { oficio: 'mineiro' }, { oficio: 'sabio' }];
    e.slots.casa_1.nivel = 2;
    expect(liquidar(e, T0 + 21 * SEG).aldeoes.at(-1)).toEqual({ oficio: 'ferreiro' });
  });
});
