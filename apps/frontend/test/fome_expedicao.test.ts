import { estadoInicial, MICRO, visaoDoCliente, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { chipsHud } from '../lib/casca/dados';
import { seloPesquisa } from '../lib/casca/modais';
import { avisoExpedicao, chipsGrupo, efeitoNaComida, grupoSugerido } from '../lib/casca/telas';
import { textoDaRecusa } from '../lib/jogo/recusas';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const novo = (): VisaoCliente => visaoDoCliente(estadoInicial({ semente: 42, agora: T0 }));

/** A conta do print: Casa 1 cheia (4 aldeões), 2 aventureiros, comida em 0. */
function comFome(): VisaoCliente {
  const e = novo();
  e.aldeoes = [{ oficio: 'fazendeiro' }, { oficio: 'lenhador' }, { oficio: 'mineiro' }, { oficio: 'sabio' }];
  e.aventureiros.push({ ...e.aventureiros[0]!, id: 'a99', nome: 'Violante', nivel: 3 });
  e.recursos.comida = 0;
  return e;
}

describe('expedição: o motivo aparece em texto', () => {
  it('sem comida, o aviso diz por que e como sair, mesmo com o grupo escolhido', () => {
    const e = comFome();
    const a = avisoExpedicao(e, e.aventureiros.map((x) => x.id));
    expect(a).toMatchObject({ alerta: true });
    expect(a!.texto).toMatch(/^Sem comida: a expedição não parte\. Pesquise Colheita Farta ou melhore a Casa/);
  });

  it('grupo vazio pede para escolher; com o grupo, nada a avisar', () => {
    const e = novo();
    expect(avisoExpedicao(e, [])).toEqual({ texto: 'Toque nos aventureiros do painel Grupo para escolher quem vai.', alerta: false });
    expect(avisoExpedicao(e, [e.aventureiros[0]!.id])).toBeNull();
  });

  it('todos feridos: diz quando o próximo volta, e o retrato mostra o tempo', () => {
    const e = novo();
    e.aventureiros[0] = { ...e.aventureiros[0]!, estado: 'ferido', feridoAte: T0 + 45_000 };
    expect(avisoExpedicao(e, [], T0)!.texto).toBe('Ninguém disponível: o próximo aventureiro volta em 00:45.');
    expect(chipsGrupo(e, [], T0).chips[0]!.motivo).toBe('Ferido · 0:45');
  });

  it('"Enviar" sugere quem está na vila, do mais forte, até 3', () => {
    const e = comFome();
    expect(grupoSugerido(e)).toEqual(['a99', e.aventureiros[0]!.id]);
  });
});

describe('comida: aviso antes de contratar e no topo', () => {
  it('contratar mostra o saldo de agora e o de depois (curva C: cada um come mais com a guilda maior); negativo vira alerta', () => {
    const e = comFome();
    e.recursos.comida = 50 * MICRO;
    e.aventureiros.pop(); // 1 aventureiro: +0,12/s; com o 2º (cada um 0,036), +0,078/s
    const r = efeitoNaComida(e);
    expect(r.alerta).toBe(false);
    expect(r.texto).toBe('Com 2 aventureiros, cada um come 0,04 comida/s. Saldo de comida: +0,12/s → +0,08/s');
    // Com 4 na guilda o 5º faz faltar comida.
    for (const id of ['b1', 'b2', 'b3']) e.aventureiros.push({ ...e.aventureiros[0]!, id, nome: id });
    const apertado = efeitoNaComida(e);
    expect(apertado.alerta).toBe(true);
    expect(apertado.texto).toMatch(/^Com 5 aventureiros, cada um come 0,05 comida\/s\. Saldo de comida: −0,04\/s → −0,12\/s\. Vai faltar comida: melhore a Casa antes\.$/);
    expect(efeitoNaComida(novo()).alerta).toBe(false);
  });

  it('o chip de comida fica em alerta só com a comida em 0 e sem subir', () => {
    const faminta = comFome();
    for (const id of ['b1', 'b2']) faminta.aventureiros.push({ ...faminta.aventureiros[0]!, id, nome: id }); // 4 comem 0,192/s: o saldo fica negativo
    expect(chipsHud(faminta).find((c) => c.recurso === 'comida')!.alerta).toMatch(/^Sem comida/);
    expect(chipsHud(comFome()).find((c) => c.recurso === 'comida')!.alerta).toBeNull();
    expect(chipsHud(novo()).find((c) => c.recurso === 'comida')!.alerta).toBeNull();
  });
});

describe('botão Pesquisa e recusas do servidor', () => {
  it('o selo conta as pesquisas que dá para começar agora', () => {
    const e = novo();
    expect(seloPesquisa(e)).toBe(0); // sem saber
    e.recursos.saber = 60 * MICRO;
    expect(seloPesquisa(e)).toBe(3); // Hospitalidade (40), Cartografia (60) e Colheita Farta (30)
    e.pesquisas.atual = { id: 'cartografia', fim: T0 + 90_000 };
    expect(seloPesquisa(e)).toBe(0); // uma por vez
  });

  it('cada recusa tem o seu texto; desconhecida vira a genérica', () => {
    expect(textoDaRecusa('sem_comida')).toMatch(/^Sem comida: a expedição não parte/);
    expect(textoDaRecusa('aventureiro_indisponivel')).toBe('Um aventureiro do grupo está ferido ou em outra expedição.');
    expect(textoDaRecusa('qualquer_coisa')).toBe('O servidor recusou a ação.');
    expect(textoDaRecusa(undefined)).toBe('O servidor recusou a ação.');
  });
});
