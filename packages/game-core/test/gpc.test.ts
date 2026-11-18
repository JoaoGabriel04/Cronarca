// Progressão do clique (esquema 12): ganho por clique de madeira e pedra sobe com a linha "Ofício do coletor";
// ferro e ouro ficam em 1; Mãos Calejadas é aditiva; o teto da Era I é GPC 3 (antes das relíquias).
import { describe, expect, it } from 'vitest';
import { FORMULAS } from '../data/formulas.ts';
import { PESQUISAS, type PesquisaId } from '../data/pesquisas.ts';
import { aplicarAcao, type Acao } from '../src/acoes.ts';
import { carregarEstado, validarEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { custoPesquisa, duracaoPesquisaMs, ganhoCliqueMicro, melhoriasDeGpc, tetoGpc } from '../src/formulas.ts';
import { estadoInicial } from '../src/inicial.ts';
import { micro } from '../src/inteiros.ts';
import { liquidar } from '../src/liquidar.ts';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const visao = (concluidas: PesquisaId[], maos = 0, era = 1) => ({
  era,
  pesquisas: { concluidas, atual: null },
  reliquias: { total: 0, gastas: 0, niveis: maos ? { maos_calejadas: maos } : {} },
});
const u = (n: number) => micro(n);

function novo(concluidas: PesquisaId[] = [], maos = 0): EstadoJogo {
  const e = estadoInicial({ semente: 5, agora: T0, reliquias: { total: 0, gastas: 0, niveis: maos ? { maos_calejadas: maos } : {} } });
  e.segredo.proximoEventoEm = T0 + 10 ** 9;
  e.pesquisas.concluidas = concluidas;
  return e;
}

describe('ganho por clique (GPC)', () => {
  it('sem pesquisa nem relíquia: 1 em qualquer recurso', () => {
    for (const r of ['madeira', 'pedra', 'ferro', 'ouro'] as const) expect(ganhoCliqueMicro(visao([]), r)).toBe(u(1));
  });

  it('coletor I leva madeira e pedra a 2, coletor II a 3; ferro e ouro ficam em 1', () => {
    expect(ganhoCliqueMicro(visao(['coletor_1']), 'madeira')).toBe(u(2));
    expect(ganhoCliqueMicro(visao(['coletor_1']), 'pedra')).toBe(u(2));
    expect(ganhoCliqueMicro(visao(['coletor_1', 'coletor_2']), 'madeira')).toBe(u(3));
    expect(ganhoCliqueMicro(visao(['coletor_1', 'coletor_2']), 'pedra')).toBe(u(3));
    expect(ganhoCliqueMicro(visao(['coletor_1', 'coletor_2']), 'ferro')).toBe(u(1));
    expect(ganhoCliqueMicro(visao(['coletor_1', 'coletor_2']), 'ouro')).toBe(u(1));
  });

  it('Mãos Calejadas é aditiva (0,25 por nível) em madeira e pedra, e não vale em ferro e ouro', () => {
    expect(ganhoCliqueMicro(visao([], 4), 'madeira')).toBe(u(2));
    expect(ganhoCliqueMicro(visao([], 10), 'pedra')).toBe(u(3.5));
    // Aditiva: 3 de pesquisa + 1 de relíquia = 4 (multiplicativa daria 6).
    expect(ganhoCliqueMicro(visao(['coletor_1', 'coletor_2'], 4), 'madeira')).toBe(u(4));
    expect(ganhoCliqueMicro(visao([], 10), 'ferro')).toBe(u(1));
    expect(ganhoCliqueMicro(visao([], 10), 'ouro')).toBe(u(1));
  });

  it('o teto da Era I é GPC 3 antes das relíquias, e as pesquisas somam exatamente isso', () => {
    expect(tetoGpc(1)).toBe(3);
    expect(tetoGpc(2)).toBe(3); // eras sem entrada usam a última definida
    const total = Object.values(PESQUISAS).reduce((s, p) => s + (p.gpc ?? 0), 0);
    expect(FORMULAS.clique.ganhoBase + total).toBe(tetoGpc(1));
    expect(melhoriasDeGpc(visao(['coletor_1', 'coletor_2']))).toBe(2);
  });
});

describe('pesquisa Ofício do coletor', () => {
  const pesquisar = (e: EstadoJogo, id: PesquisaId, t: number) => aplicarAcao(e, { tipo: 'pesquisar', pesquisa: id }, t);

  it('valores aprovados: I = 80 de saber, 90 s; II = 250 de saber e 40 de ouro, 150 s', () => {
    expect(custoPesquisa('coletor_1', 0)).toEqual({ saber: u(80) });
    expect(duracaoPesquisaMs('coletor_1', 0)).toBe(90_000);
    expect(custoPesquisa('coletor_2', 0)).toEqual({ saber: u(250), ouro: u(40) });
    expect(duracaoPesquisaMs('coletor_2', 0)).toBe(150_000);
  });

  it('o nível II exige o I', () => {
    const e = novo();
    e.recursos.saber = u(1000);
    e.recursos.ouro = u(1000);
    const r = pesquisar(e, 'coletor_2', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe('requisito_pendente');
  });

  it('pesquisar I e II seguidas muda o ganho do clique no servidor (aplicarAcao)', () => {
    let e = novo();
    e.recursos.saber = u(1000);
    e.recursos.ouro = u(1000);
    let t = T0;
    for (const id of ['coletor_1', 'coletor_2'] as const) {
      const r = pesquisar(e, id, t);
      if (!r.ok) throw new Error(r.erro);
      t += duracaoPesquisaMs(id, 0) + 1;
      e = liquidar(r.estado, t);
    }
    expect(e.pesquisas.concluidas).toEqual(expect.arrayContaining(['coletor_1', 'coletor_2']));
    e.recursos.madeira = 0; // longe do teto do Armazém
    const antes = e.recursos.madeira;
    const c = aplicarAcao(e, { tipo: 'clicar', objeto: 'serraria_1', quantidade: 2 } as Acao, t);
    if (!c.ok) throw new Error(c.erro);
    expect(c.cliquesAceitos).toBe(2);
    expect(c.estado.recursos.madeira - antes).toBe(2 * u(3));
  });

  it('o clique na Forja (ferro) segue rendendo 1, mesmo com as duas pesquisas', () => {
    const e = novo(['coletor_1', 'coletor_2'], 10);
    e.slots.forja_1.nivel = 1;
    const antes = e.recursos.ferro;
    const c = aplicarAcao(e, { tipo: 'clicar', objeto: 'forja_1', quantidade: 1 } as Acao, T0);
    if (!c.ok) throw new Error(c.erro);
    expect(c.estado.recursos.ferro - antes).toBe(u(1));
  });

  it('as pesquisas somem na ascensão (GPC volta a 1 no ciclo novo), as relíquias ficam', () => {
    const e = novo(['coletor_1', 'coletor_2'], 3);
    const nova = estadoInicial({ semente: 6, agora: T0 + 1, ciclo: 2, reliquias: e.reliquias });
    expect(nova.pesquisas.concluidas).toEqual([]);
    expect(ganhoCliqueMicro(nova, 'madeira')).toBe(u(1.75));
  });
});

describe('esquema 12', () => {
  it('versão 12; um save do 11 migra só mudando a versão e é idempotente', () => {
    expect(VERSAO_ESQUEMA).toBe(12);
    const atual = liquidar(novo(['hospitalidade']), T0 + 60_000);
    const v11 = JSON.parse(JSON.stringify({ ...atual, versao: 11 }));
    const c = carregarEstado(JSON.parse(JSON.stringify(v11)), 11);
    expect(c).toEqual({ ...atual, versao: 12 });
    expect(carregarEstado(JSON.parse(JSON.stringify(c)), 12)).toEqual(c);
  });

  it('aceita os ids novos nas concluídas e recusa id desconhecido', () => {
    const e = novo(['coletor_1']);
    expect(() => validarEstado(JSON.parse(JSON.stringify(e)))).not.toThrow();
    const ruim = JSON.parse(JSON.stringify(e));
    ruim.pesquisas.concluidas = ['coletor_3'];
    expect(() => validarEstado(ruim)).toThrow();
  });
});
