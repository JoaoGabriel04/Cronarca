import { estadoInicial, MICRO, visaoDoCliente, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import {
  cartasConstrucoes, cartasDestinos, chipsHud, faixaDePerigo, formatarInteiro, formatarRestante, formatarTaxa, linhasCronica,
  dadosAldeoes, dadosMercador, textoEra, textoSalvo,
} from '../lib/casca/dados';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const novo = (): VisaoCliente => visaoDoCliente(estadoInicial({ semente: 42, agora: T0 }));

describe('casca: formatação PT-BR', () => {
  it('quantidades inteiras com ponto de milhar; taxas com sinal e vírgula', () => {
    expect(formatarInteiro(1284 * MICRO)).toBe('1.284');
    expect(formatarInteiro(1284.9 * MICRO)).toBe('1.284'); // o HUD mostra unidades inteiras
    expect(formatarTaxa(12_000)).toBe('+12/s');
    expect(formatarTaxa(120)).toBe('+0,12/s');
    expect(formatarTaxa(-3_000)).toBe('−3/s');
    expect(formatarTaxa(0)).toBe('+0/s');
  });

  it('tempo restante mm:ss e h:mm:ss; era em romanos', () => {
    expect(formatarRestante(134_000)).toBe('02:14');
    expect(formatarRestante(500)).toBe('00:01');
    expect(formatarRestante(-5)).toBe('00:00');
    expect(formatarRestante(3_725_000)).toBe('1:02:05');
    expect(textoEra(1)).toBe('Era I · Aldeia');
    expect(textoEra(2)).toBe('Era II · Reino');
  });
});

describe('casca: HUD', () => {
  it('um chip por recurso, na ordem dos dados, com a taxa do game-core e o aviso de cheio', () => {
    const e = novo();
    const chips = chipsHud(e);
    expect(chips.map((c) => c.recurso)).toEqual(['madeira', 'pedra', 'comida', 'ferro', 'ouro', 'saber']);
    expect(chips[0]!.taxa).toBe('+1,05/s'); // serraria nível 1 + 5% do lenhador inicial
    e.recursos.madeira = 300 * MICRO;
    expect(chipsHud(e)[0]!.cheio).toBe(true);
  });
});

describe('casca: painéis', () => {
  it('construções: só as de pé e em obra; custo do próximo nível; título N de 11', () => {
    const e = novo();
    const { titulo, cartas } = cartasConstrucoes(e, T0);
    const construidas = Object.values(e.slots).filter((s) => s.nivel >= 1).length;
    expect(titulo).toBe(`${construidas} de 11 construídas`);
    expect(cartas.every((c) => c.nivel >= 1 && c.situacao === 'pronta')).toBe(true);
    const serraria = cartas.find((c) => c.slot === 'serraria_1')!;
    expect(serraria).toMatchObject({ nome: 'Serraria', nivel: 1, efeito: 'Produz 1 madeira/s', sprite: { grupo: 'construcao', id: 'serraria' } });
    expect(serraria.custo.map((c) => c.recurso)).toEqual(['madeira', 'ferro']);

    e.slots.forja_1.obraAte = T0 + 90_000;
    const forja = cartasConstrucoes(e, T0).cartas.find((c) => c.slot === 'forja_1')!;
    expect(forja).toMatchObject({ situacao: 'obra', restante: '01:30', custo: [] });
  });

  it('destinos: enviar, ver (em andamento) e bloqueada com a pesquisa que falta', () => {
    const e = novo();
    e.expedicoes.push({ id: 'x1', destino: 'floresta_lobos', grupo: ['a1'], inicio: T0, fim: T0 + 192_000 });
    const { titulo, cartas } = cartasDestinos(e, T0);
    expect(titulo).toBe('1 grupo em expedição');
    const por = Object.fromEntries(cartas.map((c) => [c.destino, c]));
    expect(por.floresta_lobos).toMatchObject({ botao: 'ver', emAndamento: true, linha: 'Em andamento · 03:12' });
    expect(por.ruinas).toMatchObject({ botao: 'enviar', linha: 'Perigo médio · 00:55' });
    expect(por.mina).toMatchObject({ botao: 'bloqueada', linha: 'Requer Cartografia' });
    expect(por.cripta).toMatchObject({ botao: 'bloqueada', nevoa: true, linha: 'Requer Estradas Reais' });
    expect(faixaDePerigo(9)).toBe('baixo');
    expect(faixaDePerigo(48)).toBe('alto');
  });

  it('crônica: as mais recentes primeiro, com ícone e hora', () => {
    const e = novo();
    e.cronica = [
      { icone: 'Check', texto: 'a', em: T0 },
      { icone: 'Alerta', texto: 'b', em: T0 + 60_000 },
      { icone: 'Expedicao', texto: 'c', em: T0 + 120_000 },
    ];
    const l = linhasCronica(e, 2);
    expect(l.map((x) => x.texto)).toEqual(['c', 'b']);
    expect(l[0]!.icone).toBe('icone-expedicao');
    expect(l[0]!.hora).toMatch(/^\d{2}:\d{2}$/);
  });

  it('mercador: aparece enquanto não expira, com o que se recebe e o que se paga', () => {
    const e = novo();
    expect(dadosMercador(e, T0)).toBeNull();
    e.mercador = { expiraEm: T0 + 134_000, paga: { madeira: 100 * MICRO }, recebe: { ouro: 15 * MICRO } };
    e.recursos.madeira = 300 * MICRO;
    const d = dadosMercador(e, T0)!;
    expect(d.restante).toBe('02:14');
    expect(d.recebe).toEqual([{ recurso: 'ouro', quantidade: '15', falta: false, tem: formatarInteiro(e.recursos.ouro) }]);
    expect(d.paga).toEqual([{ recurso: 'madeira', quantidade: '100', falta: false, tem: '300' }]);
    expect(d).toMatchObject({ pode: true, motivo: null, resumo: '100 madeira por 15 ouro' });
    expect(d.consequencia).toMatch(/segue viagem e nada muda/);
    expect(dadosMercador(e, T0 + 134_000)).toBeNull();
  });

  it('mercador: sem madeira suficiente, marca a falta e não deixa aceitar (o servidor confere de novo)', () => {
    const e = novo();
    e.mercador = { expiraEm: T0 + 60_000, paga: { madeira: 100 * MICRO }, recebe: { ouro: 15 * MICRO } };
    e.recursos.madeira = 62 * MICRO;
    const d = dadosMercador(e, T0)!;
    expect(d.paga[0]).toMatchObject({ falta: true, tem: '62' });
    expect(d.pode).toBe(false);
    expect(d.motivo).toBe('Falta madeira: você tem 62 de 100.');
  });

  it('mercador: mostra os termos que o servidor gravou, quaisquer que sejam', () => {
    const e = novo();
    e.mercador = { expiraEm: T0 + 60_000, paga: { pedra: 80 * MICRO, ferro: 5 * MICRO }, recebe: { saber: 7 * MICRO } };
    const d = dadosMercador(e, T0)!;
    expect(d.paga.map((i) => i.recurso)).toEqual(['pedra', 'ferro']);
    expect(d.resumo).toBe('80 pedra e 5 ferro por 7 saber');
  });
});

describe('casca: "Salvo há"', () => {
  const s = (o: Partial<Parameters<typeof textoSalvo>[0]> = {}) => ({ confirmadoEm: 1_000, pendentes: 0, semConexao: false, ...o });
  it('confirmado, salvando, sem conexão e conectando', () => {
    expect(textoSalvo(s(), 13_500)).toEqual({ texto: 'Salvo há 12s', icone: 'check' });
    expect(textoSalvo(s(), 181_000)).toEqual({ texto: 'Salvo há 3 min', icone: 'check' });
    expect(textoSalvo(s({ pendentes: 2 }), 2_000)).toEqual({ texto: 'Salvando...', icone: 'tempo' });
    expect(textoSalvo(s({ semConexao: true, pendentes: 1 }), 2_000)).toEqual({ texto: 'Sem conexão', icone: 'alerta' });
    expect(textoSalvo(s({ confirmadoEm: null }), 2_000)).toEqual({ texto: 'Conectando...', icone: 'tempo' });
  });
});

describe('cartão dos aldeões', () => {
  it('conta nova: 2 de 4, próximo em 20 s; os cinco ofícios e o Ocioso sempre aparecem', () => {
    const d = dadosAldeoes(novo());
    expect(d).toMatchObject({ total: 2, maximo: 4, situacao: 'Próximo em 20 s', alerta: false, automatica: true, politica: 'equilibrada', aviso: null });
    expect(d.oficios.map((o) => o.oficio)).toEqual(['fazendeiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro', 'ocioso']);
    expect(d.oficios[0]).toEqual({
      oficio: 'fazendeiro', nome: 'Fazendeiro', quantidade: 1, aCaminho: 0, efeito: '+0,35 comida/s', parado: false, podeMais: false, podeMenos: true,
    });
    expect(d.oficios[1]).toMatchObject({ quantidade: 1, efeito: '+5% de madeira', parado: false });
    expect(d.oficios[2]).toMatchObject({ quantidade: 0, parado: true, podeMenos: false });
    expect(d.oficios[5]).toEqual({
      oficio: 'ocioso', nome: 'Ocioso', quantidade: 0, aCaminho: 0, efeito: 'Não produz, mas come', parado: true, podeMais: false, podeMenos: false,
    });
    expect(d.politicas.map((p) => p.nome)).toEqual(['Equilibrada', 'Comida primeiro', 'Construção', 'Pesquisa', 'Ferro']);
  });

  it('comida curta (abaixo de 20 ou saldo que ficaria negativo): avisa que o próximo vem como Fazendeiro', () => {
    const e = novo();
    e.recursos.comida = 10_000_000;
    expect(dadosAldeoes(e).situacao).toBe('Próximo em 20 s, como Fazendeiro (comida curta)');
  });

  it('com ocioso o "+" libera; a caminho não rende; "manter" aparece só quando é a atual; desligada avisa', () => {
    const e = novo();
    e.aldeoes.push({ oficio: 'ocioso' }, { oficio: 'fazendeiro', ativoEm: e.t + 5000 });
    e.aldeoesConfig = { automatica: false, politica: 'manter', proporcao: { fazendeiro: 2, lenhador: 1 } };
    const d = dadosAldeoes(e);
    expect(d.oficios.every((o) => o.oficio === 'ocioso' || o.podeMais)).toBe(true);
    expect(d.oficios[0]).toMatchObject({ quantidade: 2, aCaminho: 1, efeito: '+0,35 comida/s' });
    expect(d.politicas.at(-1)).toEqual({ politica: 'manter', nome: 'Manter proporção atual', escolhivel: false });
    expect(d.aviso).toBe('Aldeões novos chegam ociosos');
  });

  it('ofício sem a construção do recurso fica parado e diz o que falta', () => {
    const e = novo();
    e.aldeoes.push({ oficio: 'mineiro' }, { oficio: 'mineiro' });
    const mineiro = dadosAldeoes(e).oficios.find((o) => o.oficio === 'mineiro')!;
    expect(mineiro).toMatchObject({ quantidade: 2, efeito: '+10% de pedra quando houver Pedreira', parado: true });
  });

  it('Casas cheias e sem comida viram alerta', () => {
    const e = novo();
    e.aldeoes.push({ oficio: 'mineiro' }, { oficio: 'sabio' });
    expect(dadosAldeoes(e)).toMatchObject({ total: 4, situacao: 'Casas cheias: melhore a Casa para chegarem mais', alerta: true });
    e.recursos.comida = 0;
    const d = dadosAldeoes(e);
    expect(d).toMatchObject({ situacao: 'Sem comida e Casas cheias: pesquise Colheita Farta ou melhore a Casa', alerta: true });
    expect(d.oficios.find((o) => o.oficio === 'lenhador')!.efeito).toBe('+5% de madeira (parado sem comida)');
  });
});
