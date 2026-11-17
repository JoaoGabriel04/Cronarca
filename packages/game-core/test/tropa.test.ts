// Portão 22: contratar com classe, Alojamento no QG (atravessa a ascensão), curva de comida dos aventureiros.
import { describe, expect, it } from 'vitest';
import { CLASSES, NOMES_CLASSES } from '../data/aventureiros.ts';
import { FORMULAS } from '../data/formulas.ts';
import { capacidadeDoAlojamento, QG, TEXTOS_QG } from '../data/qg.ts';
import { aplicarAcao, esquemaAcao, type Acao } from '../src/acoes.ts';
import { validarEstado, type EstadoJogo } from '../src/estado.ts';
import { poderAventureiro } from '../src/formulas.ts';
import { estadoInicial } from '../src/inicial.ts';
import { micro } from '../src/inteiros.ts';
import { aventureirosNaTaverna, calcularTaxas, capacidadeAlojamento, consumoComidaAventureiros, ordemDeAtravessar, vagasGuilda } from '../src/regras.ts';
import { comRecursos, MIN, novo, T0 } from './ajuda.ts';

const rico = (e: EstadoJogo) => comRecursos(e, { ouro: 5000, comida: 250, madeira: 300, pedra: 300 });
const contratar = (e: EstadoJogo, classe: (typeof CLASSES)[number]): EstadoJogo => {
  const r = aplicarAcao(rico(e), { tipo: 'contratar', classe }, e.t);
  if (!r.ok) throw new Error(`recusada: ${r.erro}`);
  return r.estado;
};
const heroi = (id: string, nivel: number, extra: Partial<EstadoJogo['aventureiros'][number]> = {}): EstadoJogo['aventureiros'][number] => ({
  id, nome: `Heroi ${id}`, classe: 'lanceiro', nivel, xp: 3, arma: 1, armadura: 2, estado: 'na_vila', feridoAte: null, alojado: false, ...extra,
});
/** Reino pronto para ascender com o QG no nível pedido (0 = ainda em ruinas). */
function prontoParaAscender(nivelQg: 0 | 1, herois: EstadoJogo['aventureiros']): EstadoJogo {
  const e = novo();
  e.qg = nivelQg === 1 ? { estado: 'reerguido', desde: T0, nivel: 1 } : { estado: 'ruinas', desde: T0, nivel: 0 };
  e.pesquisas.concluidas.push('carta_real');
  e.objetivos.criptaVencida = true;
  e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
  e.aventureiros = herois;
  e.proximoId = 20;
  return e;
}

describe('contratar com a classe escolhida', () => {
  it('a ação exige a classe, uma das quatro, e não aceita campo a mais', () => {
    expect(esquemaAcao.safeParse({ tipo: 'contratar' }).success).toBe(false);
    expect(esquemaAcao.safeParse({ tipo: 'contratar', classe: 'ladino' }).success).toBe(false);
    expect(esquemaAcao.safeParse({ tipo: 'contratar', classe: 'lanceiro', nivel: 20 }).success).toBe(false);
    for (const classe of CLASSES) expect(esquemaAcao.safeParse({ tipo: 'contratar', classe }).success, classe).toBe(true);
  });

  it('cada classe entra com a classe pedida, nível 1, sem equipamento, na vila e fora do Alojamento; custo e contador de sempre', () => {
    for (const classe of CLASSES) {
      const e = rico(novo());
      const custo = FORMULAS.contratar;
      const r = aplicarAcao(e, { tipo: 'contratar', classe }, e.t);
      expect(r.ok, classe).toBe(true);
      const h = r.estado.aventureiros.at(-1)!;
      expect(h).toMatchObject({ classe, nivel: 1, xp: 0, arma: 0, armadura: 0, estado: 'na_vila', feridoAte: null, alojado: false });
      expect(r.estado.contratacoes).toBe(1);
      expect(r.estado.recursos.ouro).toBe(e.recursos.ouro - micro(custo.ouroBase));
      expect(r.estado.recursos.comida).toBe(e.recursos.comida - micro(custo.comida));
      expect(r.estado.cronica.at(-1)!.texto).toContain(h.nome);
    }
  });

  it('sem recurso: recursos_insuficientes; sem vaga: guilda_cheia; nada é cobrado', () => {
    const pobre = comRecursos(novo(), { ouro: 1 });
    const a = aplicarAcao(pobre, { tipo: 'contratar', classe: 'arqueiro' }, pobre.t);
    expect(a.ok ? 'ok' : a.erro).toBe('recursos_insuficientes');
    expect(a.estado.aventureiros).toHaveLength(1);
    let e = novo();
    for (let i = 0; i < vagasGuilda(e) - 1; i++) e = contratar(e, CLASSES[i % 4]!);
    expect(e.aventureiros).toHaveLength(vagasGuilda(e));
    const cheia = aplicarAcao(rico(e), { tipo: 'contratar', classe: 'mago_do_tempo' }, e.t);
    expect(cheia.ok ? 'ok' : cheia.erro).toBe('guilda_cheia');
    expect(cheia.estado.recursos.ouro).toBe(rico(e).recursos.ouro);
  });

  it('o nome não repete e o sorteio de classe acabou: a mesma semente dá a classe pedida', () => {
    const e = rico(novo());
    const nomes = new Set<string>();
    let x = e;
    for (const classe of ['cavaleiro', 'cavaleiro', 'cavaleiro']) {
      x = contratar(x, classe as 'cavaleiro');
      nomes.add(x.aventureiros.at(-1)!.nome);
    }
    expect(nomes.size).toBe(3);
    expect(x.aventureiros.slice(1).map((a) => a.classe)).toEqual(['cavaleiro', 'cavaleiro', 'cavaleiro']);
    for (const c of CLASSES) expect(NOMES_CLASSES[c]).toBeTruthy();
  });
});

describe('Alojamento: vagas da Taverna e capacidade do QG', () => {
  it('a tabela aprovada: [0, 3, 4, 5, 6, 7]; nível 1 = 3; fora da tabela = 0', () => {
    expect(QG.alojamentoPorNivel).toEqual([0, 3, 4, 5, 6, 7]);
    expect(QG.nivelAoReerguer).toBe(1);
    expect(capacidadeDoAlojamento(1)).toBe(3);
    expect(capacidadeDoAlojamento(5)).toBe(7);
    expect(capacidadeDoAlojamento(6)).toBe(0);
  });

  it('a capacidade vale 0 até o QG ser reerguido, e 3 depois', () => {
    const e = novo();
    expect(capacidadeAlojamento(e)).toBe(0);
    e.qg = { estado: 'ruinas', desde: T0, nivel: 0 };
    expect(capacidadeAlojamento(e)).toBe(0);
    const pago = aplicarAcao(comRecursos(e, { madeira: 200, pedra: 100 }), { tipo: 'reerguer_qg' }, e.t);
    expect(pago.ok).toBe(true);
    expect(pago.estado.qg.nivel).toBe(1);
    expect(capacidadeAlojamento(pago.estado)).toBe(3);
  });

  it('quem mora no QG não ocupa vaga da Taverna: com 3 alojados ainda cabem as 4 vagas da Taverna', () => {
    const e = novo();
    e.aventureiros = [heroi('a1', 5, { alojado: true }), heroi('a2', 4, { alojado: true }), heroi('a3', 3, { alojado: true })];
    expect(aventureirosNaTaverna(e)).toBe(0);
    let x = e;
    for (let i = 0; i < vagasGuilda(e); i++) x = contratar(x, 'lanceiro');
    expect(x.aventureiros).toHaveLength(3 + vagasGuilda(e));
    expect(aventureirosNaTaverna(x)).toBe(vagasGuilda(x));
    const r = aplicarAcao(rico(x), { tipo: 'contratar', classe: 'lanceiro' }, x.t);
    expect(r.ok ? 'ok' : r.erro).toBe('guilda_cheia');
  });

  it('o estado com alojado e nível do QG é válido, e o campo é obrigatório', () => {
    const e = novo();
    e.qg = { estado: 'reerguido', desde: T0, nivel: 1 };
    e.aventureiros[0]!.alojado = true;
    expect(() => validarEstado(JSON.parse(JSON.stringify(e)))).not.toThrow();
    const sem = JSON.parse(JSON.stringify(e));
    delete sem.aventureiros[0].alojado;
    expect(() => validarEstado(sem)).toThrow();
  });
});

describe('a ascensão leva os mais fortes, até a capacidade do Alojamento', () => {
  const ascender = (e: EstadoJogo) => {
    const r = aplicarAcao(e, { tipo: 'ascender' } as Acao, e.t + 5 * MIN);
    if (!r.ok) throw new Error(`recusada: ${r.erro}`);
    return r.estado;
  };
  const cinco = () => [heroi('a1', 2), heroi('a2', 9, { classe: 'cavaleiro' }), heroi('a3', 6, { classe: 'arqueiro' }), heroi('a4', 12, { classe: 'mago_do_tempo' }), heroi('a5', 4)];

  it('QG reerguido: os 3 mais fortes atravessam como alojados, com tudo (nome, classe, nível, XP, arma e armadura) e na vila', () => {
    const e = prontoParaAscender(1, cinco());
    const antes = Object.fromEntries(e.aventureiros.map((a) => [a.id, a]));
    const n = ascender(e);
    expect(n.ciclo).toBe(2);
    expect(n.aventureiros.map((a) => a.id).sort()).toEqual(['a2', 'a3', 'a4']);
    for (const a of n.aventureiros) {
      expect(a.alojado).toBe(true);
      expect(a).toEqual({ ...antes[a.id]!, alojado: true });
    }
    expect(n.qg).toEqual({ estado: 'reerguido', desde: T0, nivel: 1 });
    // O soldado inicial não nasce quando alguém atravessa; as contratações do ciclo recomeçam.
    expect(n.aventureiros).toHaveLength(3);
    expect(n.contratacoes).toBe(0);
    expect(aventureirosNaTaverna(n)).toBe(0);
  });

  it('quem não cabe sai da guilda, com uma linha na Crônica por pessoa', () => {
    const n = ascender(prontoParaAscender(1, cinco()));
    const saiu = n.cronica.filter((l) => l.texto === TEXTOS_QG.saiuDaGuilda('Heroi a1') || l.texto === TEXTOS_QG.saiuDaGuilda('Heroi a5'));
    expect(saiu).toHaveLength(2);
    expect(n.aventureiros.some((a) => a.nome === 'Heroi a1' || a.nome === 'Heroi a5')).toBe(false);
  });

  it('os ids continuam do ciclo anterior (sem repetir) e quem atravessa volta curado, fora de expedição', () => {
    const feridos = cinco().map((h) => (h.id === 'a4' ? { ...h, estado: 'ferido' as const, feridoAte: T0 + 9 * MIN } : h.id === 'a2' ? { ...h, estado: 'em_expedicao' as const } : h));
    const n = ascender(prontoParaAscender(1, feridos));
    expect(n.proximoId).toBe(20);
    for (const a of n.aventureiros) expect(a).toMatchObject({ estado: 'na_vila', feridoAte: null });
    const c = contratar(n, 'arqueiro');
    expect(c.aventureiros.at(-1)!.id).toBe('a20');
    expect(new Set(c.aventureiros.map((a) => a.id)).size).toBe(c.aventureiros.length);
  });

  it('QG ainda em ruínas: ninguém atravessa e o soldado inicial nasce, como antes', () => {
    const n = ascender(prontoParaAscender(0, cinco()));
    expect(n.aventureiros).toHaveLength(1);
    expect(n.aventureiros[0]).toMatchObject({ classe: 'lanceiro', nivel: 1, alojado: false });
  });

  it('pouca tropa: todos atravessam (a capacidade é um teto, não uma cota)', () => {
    const n = ascender(prontoParaAscender(1, [heroi('a1', 3), heroi('a2', 4)]));
    expect(n.aventureiros.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('a nova guilda soma ao Alojamento: no segundo recomeço, os mais fortes de todos (alojados e da Taverna) atravessam', () => {
    let e = ascender(prontoParaAscender(1, cinco()));
    for (const classe of ['lanceiro', 'arqueiro'] as const) e = contratar(e, classe);
    // Um recém-contratado fica muito forte no ciclo.
    e.aventureiros.at(-1)!.nivel = 20;
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    const n = ascender(e);
    expect(n.ciclo).toBe(3);
    expect(n.aventureiros).toHaveLength(3);
    expect(n.aventureiros.some((a) => a.nivel === 20)).toBe(true);
    expect(n.aventureiros.every((a) => a.alojado)).toBe(true);
  });

  it('a ordem é por poder, depois nível e id; é determinística', () => {
    const lista = [heroi('a3', 5), heroi('a1', 5), heroi('a2', 7)];
    expect(ordemDeAtravessar(lista).map((a) => a.id)).toEqual(['a2', 'a1', 'a3']);
    const p = poderAventureiro(heroi('x', 5));
    expect(p).toBeGreaterThan(0);
  });

  it('estadoInicial com aventureiros alojados não cria o soldado e respeita o contador de ids', () => {
    const e = estadoInicial({ semente: 1, agora: T0, aventureiros: [heroi('a7', 3, { alojado: true })], proximoId: 9 });
    expect(e.aventureiros.map((a) => a.id)).toEqual(['a7']);
    expect(e.proximoId).toBe(9);
    expect(estadoInicial({ semente: 1, agora: T0 }).aventureiros).toHaveLength(1);
  });
});

describe('manutenção de comida (curva C)', () => {
  it('parâmetros dos dados: 0,03 de base e 0,006 a mais por herói; cada um come base + crescimento × (n − 1)', () => {
    expect(FORMULAS.consumo.comidaBaseAventureiro).toBe(0.03);
    expect(FORMULAS.consumo.comidaCrescimentoAventureiro).toBe(0.006);
  });

  it('consumo total em milésimos por tamanho da guilda (inteiros, crescente)', () => {
    const esperado: [number, number][] = [[0, 0], [1, 30], [2, 72], [3, 126], [4, 192], [5, 270], [6, 360], [8, 576], [10, 840], [15, 1710]];
    for (const [n, total] of esperado) expect(consumoComidaAventureiros(n), `n=${n}`).toBe(total);
    let anterior = -1;
    for (let n = 0; n <= 20; n++) {
      const t = consumoComidaAventureiros(n);
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThan(anterior);
      anterior = t;
    }
  });

  it('mais barato que os 0,08 fixos de antes até 9 heróis (o tamanho típico) e mais caro a partir de 10', () => {
    for (let n = 1; n <= 9; n++) expect(consumoComidaAventureiros(n), `n=${n}`).toBeLessThan(80 * n);
    for (let n = 10; n <= 15; n++) expect(consumoComidaAventureiros(n), `n=${n}`).toBeGreaterThan(80 * n);
  });

  it('alojados também comem: o consumo da vila soma todos os aventureiros', () => {
    const e = novo();
    e.aventureiros = [heroi('a1', 1), heroi('a2', 1, { alojado: true }), heroi('a3', 1, { alojado: true })];
    expect(calcularTaxas(e).consumoComida).toBe(e.aldeoes.length * 50 + 126);
  });

  it('nos primeiros minutos a comida não fica negativa por causa dos aventureiros: com até 3 heróis o saldo segue positivo', () => {
    const e = novo();
    e.aldeoes = [{ oficio: 'fazendeiro' }, { oficio: 'lenhador' }, { oficio: 'fazendeiro' }, { oficio: 'lenhador' }];
    for (const n of [1, 2, 3]) {
      e.aventureiros = Array.from({ length: n }, (_, i) => heroi(`a${i + 1}`, 1));
      expect(calcularTaxas(e).saldo.comida, `n=${n}`).toBeGreaterThan(0);
    }
  });
});
