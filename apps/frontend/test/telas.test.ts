import { estadoInicial, MICRO, visaoDoCliente, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import {
  caminhoDoTempo, cartasHerois, chipsGrupo, emAndamento, eraAtual, guilda, juntarNomes, linhasDestinos, relatorios, reliquias,
} from '../lib/casca/telas';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
function novo(): VisaoCliente {
  return visaoDoCliente(estadoInicial({ semente: 42, agora: T0 }));
}
function comHerois(): VisaoCliente {
  const e = novo();
  const base = e.aventureiros[0]!;
  e.aventureiros.push(
    { ...base, id: 'a2', nome: 'Dara', classe: 'arqueiro', nivel: 1, arma: 0, armadura: 0, estado: 'em_expedicao', feridoAte: null },
    { ...base, id: 'a3', nome: 'Cael', classe: 'mago_do_tempo', nivel: 3, arma: 6, armadura: 0, estado: 'ferido', feridoAte: T0 + 32_000 },
  );
  return e;
}

describe('telas: Heróis', () => {
  it('estado de cada herói, peças com custo e quando dá para melhorar', () => {
    const e = comHerois();
    e.recursos.ferro = 1_000 * MICRO;
    e.recursos.ouro = 1_000 * MICRO;
    const [a, d, c] = cartasHerois(e, T0);
    expect(a!.estado).toEqual({ tipo: 'na_vila', texto: 'Na vila' });
    expect(d!.estado.tipo).toBe('em_expedicao');
    expect(c!.estado).toEqual({ tipo: 'ferido', texto: 'Ferido 00:32' });
    expect(a!.arma.pode).toBe(true);
    expect(d!.arma).toMatchObject({ pode: false, motivo: 'Em expedição' }); // a regra recusa quem está fora
    expect(c!.arma).toMatchObject({ nivel: 6, maximo: 6, pode: false, motivo: 'Nível máximo', custo: [] });
    expect(c!.armadura.pode).toBe(true); // ferido pode melhorar (a regra só barra quem está em expedição)
  });

  it('guilda: vagas, contratar barrado sem recursos ou com a guilda cheia, resumo', () => {
    const e = novo();
    const g = guilda(e);
    expect(g.vagas).toBe('1 / 4');
    expect(g.resumo.proximaVaga).toBe('Construir a Taverna');
    expect(g.resumo.consumo).toBe('−0,08/s');
    e.recursos.ouro = 0;
    expect(guilda(e).contratar).toMatchObject({ pode: false, motivo: 'Recursos insuficientes' });
    e.slots.taverna_1.nivel = 2;
    expect(guilda(e).resumo.proximaVaga).toBe('Taverna nível 3');
  });
});

describe('telas: Expedições', () => {
  it('grupo: só quem está na vila, até 3; poder somado', () => {
    const e = comHerois();
    const { chips, poder } = chipsGrupo(e, ['a1', 'a2', 'a3']);
    expect(chips.map((c) => [c.id, c.selecionado, c.disponivel])).toEqual([['a1', true, true], ['a2', false, false], ['a3', false, false]]);
    expect(poder).toBeGreaterThan(0);
    expect(chips[1]!.motivo).toBe('Em expedição');
  });

  it('destinos: chance só com grupo, bloqueados com a pesquisa, faixas de saque', () => {
    const e = novo();
    const sem = linhasDestinos(e, []);
    expect(sem[0]).toMatchObject({ destino: 'ruinas_qg', chance: null, pode: false, motivo: 'Escolha o grupo' }); // o das Ruínas do QG vem primeiro (Portão 21)
    expect(sem.find((d) => d.destino === 'floresta_lobos')).toMatchObject({ chance: null, pode: false, motivo: 'Escolha o grupo' });
    expect(sem.find((d) => d.destino === 'mina')).toMatchObject({ aberto: false, requer: 'Requer a pesquisa Cartografia', pode: false });
    const com = linhasDestinos(e, [e.aventureiros[0]!.id]);
    const floresta = com.find((d) => d.destino === 'floresta_lobos')!;
    expect(floresta.pode).toBe(true);
    expect(floresta.chance!.texto).toMatch(/^\d+%$/);
    expect(floresta.saque[0]).toEqual({ recurso: 'madeira', faixa: '25–45' });
    expect(floresta.saque.find((s) => s.recurso === 'ouro')!.faixa).toBe('0,4–1');
    expect(floresta.perigo).toBe('Perigo 9 · 0:30');
    // Ruínas do Quartel General: perigo 6, 40 s, saque aprovado.
    const qg = com.find((d) => d.destino === 'ruinas_qg')!;
    expect(qg.perigo).toBe('Perigo 6 · 0:40');
    expect(qg.saque).toEqual([{ recurso: 'pedra', faixa: '12–20' }, { recurso: 'madeira', faixa: '15–25' }, { recurso: 'ouro', faixa: '3–6' }]);
  });

  it('em andamento: progresso e tempo restante', () => {
    const e = comHerois();
    e.expedicoes.push({ id: 'x1', destino: 'floresta_lobos', grupo: ['a2'], inicio: T0, fim: T0 + 30_000 });
    expect(emAndamento(e, T0 + 18_000)).toEqual([{ id: 'x1', texto: 'Floresta dos Lobos · Dara', progresso: 0.6, restante: '00:12' }]);
  });

  it('relatórios: o mais novo primeiro, com texto, etiqueta e saque', () => {
    const e = novo();
    e.relatorios = [
      { destino: 'ruinas', grupo: ['Aldric'], vitoria: false, saque: {}, feridos: [], em: T0 },
      { destino: 'floresta_lobos', grupo: ['Aldric', 'Dara'], vitoria: true, saque: { madeira: 34 * MICRO, comida: 28 * MICRO }, feridos: [], em: T0 + 60_000 },
    ];
    const [r1, r2] = relatorios(e);
    expect(r1).toMatchObject({ nome: 'Floresta dos Lobos', vitoria: true, texto: 'Aldric e Dara voltaram sem feridos.', saque: [{ recurso: 'madeira', valor: '34' }, { recurso: 'comida', valor: '28' }] });
    expect(r2).toMatchObject({ nome: 'Ruínas Esquecidas', vitoria: false, texto: 'O grupo recuou antes de achar algo.', saque: [] });
    expect(juntarNomes(['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('telas: Eras', () => {
  it('objetivos da Era I, ascender só com todos cumpridos', () => {
    const e = novo();
    const era = eraAtual(e);
    expect(era.titulo).toBe('Era I · Aldeia');
    expect(era.objetivos.map((o) => o.texto)).toEqual(['Pesquisar a Carta Real', 'Vencer a Cripta do Rei Cinzento', `Reunir 40 aldeões (${e.aldeoes.length} agora)`]);
    expect(era.podeAscender).toBe(false);
  });

  it('Falha (Portão 18b): nível atual, o que o próximo muda (sem a Cripta enquanto o acréscimo for 0) e o teto', () => {
    const e = novo();
    let f = eraAtual(e).falha;
    expect(f).toMatchObject({ nivel: 0, rotulo: 'Falha 0', lore: 'A cada recomeço, o Relógio falha mais.', noMaximo: null });
    expect(f.agora).toBe('Ainda sem efeito: o Relógio corre como sempre.');
    expect(f.proximo).toEqual({
      titulo: 'Ao ascender: Falha 0 → 1',
      efeitos: ['Obras e pesquisas 3% mais lentas', 'Estradas Reais e Carta Real 5% mais caras'],
    });
    e.falha = 3;
    f = eraAtual(e).falha;
    expect(f.agora).toBe('Obras e pesquisas 9% mais lentas. Estradas Reais e Carta Real 15% mais caras.');
    expect(f.proximo!.efeitos).toEqual(['Obras e pesquisas 12% mais lentas', 'Estradas Reais e Carta Real 20% mais caras']);
    expect(f.proximo!.efeitos.join(' ')).not.toMatch(/Cripta/);
    e.falha = 10;
    f = eraAtual(e).falha;
    expect(f.proximo).toBeNull();
    expect(f.noMaximo).toMatch(/máximo/);
  });

  it('Falha no perigo e na chance da Cripta: igual enquanto o acréscimo for 0', () => {
    const e = novo();
    const antes = linhasDestinos(e, []).find((l) => l.destino === 'cripta')!.perigo;
    e.falha = 10;
    expect(linhasDestinos(e, []).find((l) => l.destino === 'cripta')!.perigo).toBe(antes);
  });

  it('relíquias: disponíveis, custo do próximo nível, máximo e saldo', () => {
    const e = novo();
    e.reliquias = { total: 7, gastas: 0, niveis: { maos_calejadas: 1, linhagem_heroica: 5 } };
    const r = reliquias(e);
    expect(r.titulo).toBe('7 disponíveis · 7 no total');
    expect(r.cartas.find((c) => c.id === 'maos_calejadas')).toMatchObject({ nivel: '1 / 10', custo: '6 relíquias', pode: true, efeito: '+25% de força por clique, por nível.' });
    expect(r.cartas.find((c) => c.id === 'linhagem_heroica')).toMatchObject({ pode: false, motivo: 'Nível máximo' });
    e.reliquias.gastas = 7;
    expect(reliquias(e).cartas.every((c) => !c.pode)).toBe(true);
  });

  it('caminho do tempo: as eras depois da atual, com a liberação', () => {
    const c = caminhoDoTempo(novo());
    expect(c.map((x) => [x.titulo, x.sprite, x.liberacao])).toEqual([
      ['Era II · Reino', { grupo: 'futuro', id: 'castelo' }, 'Liberada ao ascender da Era I'],
      ['Era III · Arcana', { grupo: 'futuro', id: 'torre' }, 'Liberada ao ascender da Era II'],
      ['Era IV · Dimensões', { grupo: 'futuro', id: 'portal' }, 'Liberada ao ascender da Era III'],
    ]);
  });
});
