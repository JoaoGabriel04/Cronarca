// Portão 17: alocação de ofícios dos aldeões.
import { describe, expect, it } from 'vitest';
import { DESLOCAMENTO_ALDEAO_MS, PESOS_POLITICA, POLITICAS_PRONTAS } from '../data/aldeoes.ts';
import { OFICIOS } from '../data/aventureiros.ts';
import { FORMULAS } from '../data/formulas.ts';
import contaNova from './fixtures/conta_nova_antes_p17.json' with { type: 'json' };
import fomeAntes from './fixtures/fome_antes_p17.json' with { type: 'json' };
import { aplicarAcao } from '../src/acoes.ts';
import { carregarEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { estadoInicial } from '../src/inicial.ts';
import { liquidar } from '../src/liquidar.ts';
import { preverAcao } from '../src/previsao.ts';
import { calcularTaxas, oficioDoProximoAldeao, pesosDaDistribuicao, quantosNoOficio, saldoComidaComMaisUm } from '../src/regras.ts';
import { fazer, MIN, novo, recusar, SEG, T0, u } from './ajuda.ts';

const MS_CHEGADA = FORMULAS.aldeoes.segundosPorChegada * SEG;

/** Vila com Casa no nível dado, sem eventos e com comida de sobra. */
function vila(casa: number, oficios: EstadoJogo['aldeoes'][number]['oficio'][]): EstadoJogo {
  const e = novo();
  e.slots.casa_1.nivel = casa;
  e.aldeoes = oficios.map((oficio) => ({ oficio }));
  e.recursos.comida = u(200);
  return e;
}

/** Simula `n` chegadas com a configuração dada e devolve os ofícios de quem chegou. */
function chegadas(e: EstadoJogo, n: number): string[] {
  const antes = e.aldeoes.length;
  const l = liquidar(e, e.t + n * MS_CHEGADA);
  return l.aldeoes.slice(antes).map((a) => a.oficio);
}

describe('conta nova sem eventos: igual ao rodízio antigo', () => {
  for (const minutos of ['5', '15', '30'] as const) {
    it(`${minutos} min: recursos, aldeões e Crônica idênticos`, () => {
      const e = estadoInicial({ semente: 7, agora: T0 });
      e.segredo.proximoEventoEm = Number.MAX_SAFE_INTEGER;
      const l = liquidar(e, T0 + Number(minutos) * MIN);
      const antes = contaNova.estados[minutos];
      expect(l.t).toBe(antes.t);
      expect(l.recursos).toEqual(antes.recursos);
      expect(l.aldeoes).toEqual(antes.aldeoes);
      expect(l.progressoAldeaoMs).toBe(antes.progressoAldeaoMs);
      expect(l.cronica).toEqual(antes.cronica);
    });
  }
});

describe('regra da comida (comida em 0, abaixo de 20 ou saldo negativo)', () => {
  it('quem chega é Fazendeiro, inclusive com a automática desligada', () => {
    const e = vila(3, ['lenhador']);
    e.recursos.comida = 0;
    e.aldeoesConfig = { automatica: false, politica: 'equilibrada' };
    expect(oficioDoProximoAldeao(e)).toBe('fazendeiro');
    e.aldeoesConfig = { automatica: true, politica: 'ferro' };
    expect(oficioDoProximoAldeao(e)).toBe('fazendeiro');
  });

  it('cenário de fome (Casa 3, 4 aldeões, 3 aventureiros, comida 0, 3 min): antes do 17, no 17 e com a regra do 18a', () => {
    const e = estadoInicial({ semente: 7, agora: T0 });
    e.segredo.proximoEventoEm = Number.MAX_SAFE_INTEGER;
    e.slots.casa_1.nivel = 3;
    e.aldeoes = [{ oficio: 'fazendeiro' }, { oficio: 'lenhador' }, { oficio: 'mineiro' }, { oficio: 'sabio' }];
    e.aventureiros.push({ ...e.aventureiros[0]!, id: 'a8', nome: 'B' }, { ...e.aventureiros[0]!, id: 'a9', nome: 'C' });
    e.recursos.comida = 0;
    const l = liquidar(e, T0 + 3 * MIN);
    const agora = l.aldeoes.map((a) => a.oficio);
    // Antes do Portão 17 (rodízio): 68,6 de comida em 3 min.
    expect(fomeAntes.aldeoes).toEqual([
      'fazendeiro', 'lenhador', 'mineiro', 'sabio',
      'fazendeiro', 'fazendeiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro', 'fazendeiro', 'lenhador',
    ]);
    expect(fomeAntes.comida).toBe(u(68.6));
    // No Portão 17 (só comida em 0): o 6º virava Ferreiro e a comida ficava em 19,6.
    // Portão 18a: abaixo de 20 de comida (ou com saldo que ficaria negativo) quem chega é Fazendeiro.
    // Os três primeiros chegam com a comida abaixo de 20; daí em diante, a Equilibrada.
    expect(agora).toEqual([
      'fazendeiro', 'lenhador', 'mineiro', 'sabio',
      'fazendeiro', 'fazendeiro', 'fazendeiro', 'ferreiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro',
    ]);
    expect(l.aldeoes.length).toBe(fomeAntes.aldeoes.length);
    expect(liquidar(e, T0 + 1 * MIN).recursos.comida).toBe(u(14.4));
    expect(liquidar(e, T0 + 2 * MIN).recursos.comida).toBe(u(60));
    expect(l.recursos.comida).toBe(u(96.6));
  });

  it('saldo que ficaria negativo com quem chega: Fazendeiro, mesmo com comida de sobra e a automática desligada', () => {
    const e = vila(3, ['lenhador', 'mineiro']);
    e.aldeoesConfig = { automatica: false, politica: 'equilibrada' };
    expect(saldoComidaComMaisUm(e)).toBeLessThan(0);
    expect(oficioDoProximoAldeao(e)).toBe('fazendeiro');
    // Com um Fazendeiro, o saldo com mais um fica positivo: volta a valer a configuração (Ocioso).
    e.aldeoes.push({ oficio: 'fazendeiro' });
    expect(saldoComidaComMaisUm(e)).toBeGreaterThanOrEqual(0);
    expect(oficioDoProximoAldeao(e)).toBe('ocioso');
  });

  it('quem está a caminho para Fazendeiro já conta no saldo', () => {
    const e = vila(3, ['lenhador', 'mineiro']);
    e.aldeoes.push({ oficio: 'fazendeiro', ativoEm: e.t + 5 * SEG });
    expect(saldoComidaComMaisUm(e)).toBeGreaterThanOrEqual(0);
    expect(oficioDoProximoAldeao(e)).not.toBe('fazendeiro');
  });

  it('comida abaixo de 20: Fazendeiro; a partir de 20, a política', () => {
    const e = vila(3, ['fazendeiro', 'fazendeiro', 'lenhador']);
    e.recursos.comida = u(20) - 1;
    expect(oficioDoProximoAldeao(e)).toBe('fazendeiro');
    e.recursos.comida = u(20);
    expect(oficioDoProximoAldeao(e)).toBe('mineiro');
  });
});

describe('políticas', () => {
  it('cada política distribui pelos pesos (35 chegadas a partir do zero: parte exata)', () => {
    for (const politica of POLITICAS_PRONTAS) {
      const e = vila(9, []);
      e.aldeoesConfig = { automatica: true, politica };
      const lista = chegadas(e, 35);
      const pesos = PESOS_POLITICA[politica];
      const somaPesos = OFICIOS.reduce((s, o) => s + pesos[o], 0);
      for (const o of OFICIOS) {
        const n = lista.filter((x) => x === o).length;
        if (pesos[o] === 0) expect(n, `${politica}/${o}`).toBe(0);
        else expect(n, `${politica}/${o}`).toBe((35 * pesos[o]) / somaPesos);
      }
    }
  });

  it('Equilibrada numa vila vazia repete a ordem dos ofícios', () => {
    expect(chegadas(vila(3, []), 6)).toEqual(['fazendeiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro', 'fazendeiro']);
  });

  it('automática desligada: chegam ociosos (com comida)', () => {
    const e = vila(2, ['fazendeiro']);
    e.aldeoesConfig = { automatica: false, politica: 'equilibrada' };
    expect(chegadas(e, 2)).toEqual(['ocioso', 'ocioso']);
    const l = liquidar(e, e.t + MS_CHEGADA);
    expect(l.cronica.at(-1)!.texto).toBe('Um ocioso chegou à vila.');
  });

  it('"Manter proporção atual" segue a distribuição montada; toda zerada cai em Equilibrada', () => {
    const e = vila(5, ['fazendeiro', 'fazendeiro', 'lenhador', 'lenhador', 'mineiro', 'sabio']);
    e.aldeoesConfig = { automatica: true, politica: 'manter', proporcao: { fazendeiro: 2, lenhador: 2, mineiro: 1, sabio: 1 } };
    const lista = chegadas(e, 6);
    expect(lista.filter((x) => x === 'ferreiro')).toEqual([]);
    expect(lista.filter((x) => x === 'fazendeiro').length).toBe(2);
    expect(lista.filter((x) => x === 'lenhador').length).toBe(2);

    // Todos no Ocioso: a proporção zerada vale como Equilibrada (as chegadas aqui seriam Fazendeiros
    // pela regra da comida, porque ninguém produz comida; por isso a conferência é nos pesos).
    const z = vila(3, ['ocioso', 'ocioso']);
    z.aldeoesConfig = { automatica: true, politica: 'manter', proporcao: {} };
    expect(pesosDaDistribuicao(z)).toEqual(PESOS_POLITICA.equilibrada);
  });
});

describe('alocar_aldeoes', () => {
  it('muda o ofício, o aldeão leva 10 s para produzir e a política vira "manter"', () => {
    let e = vila(2, ['fazendeiro', 'lenhador', 'mineiro', 'sabio']);
    const antes = calcularTaxas(e).producao.comida;
    e = fazer(e, { tipo: 'alocar_aldeoes', de: 'mineiro', para: 'fazendeiro', quantidade: 1 });
    expect(e.aldeoes.filter((a) => a.oficio === 'fazendeiro').map((a) => a.ativoEm)).toEqual([undefined, e.t + DESLOCAMENTO_ALDEAO_MS]);
    expect(e.aldeoesConfig).toEqual({
      automatica: true, politica: 'manter', proporcao: { fazendeiro: 2, lenhador: 1, mineiro: 0, sabio: 1, ferreiro: 0 },
    });
    // A caminho: ainda não produz no ofício novo.
    expect(calcularTaxas(e).producao.comida).toBe(antes);
    expect(calcularTaxas(liquidar(e, e.t + DESLOCAMENTO_ALDEAO_MS - 1)).producao.comida).toBe(antes);
    // Depois do deslocamento, produz e o ativoEm some.
    const l = liquidar(e, e.t + DESLOCAMENTO_ALDEAO_MS);
    expect(l.aldeoes.every((a) => a.ativoEm === undefined)).toBe(true);
    expect(calcularTaxas(l).producao.comida).toBe(2 * antes);
  });

  it('para Ocioso é na hora e o ocioso continua comendo', () => {
    let e = vila(2, ['fazendeiro', 'lenhador', 'lenhador']);
    const consumo = calcularTaxas(e).consumoComida;
    e = fazer(e, { tipo: 'alocar_aldeoes', de: 'lenhador', para: 'ocioso', quantidade: 2 });
    expect(quantosNoOficio(e, 'ocioso')).toBe(2);
    expect(e.aldeoes.every((a) => a.ativoEm === undefined)).toBe(true);
    expect(calcularTaxas(e).consumoComida).toBe(consumo);
  });

  it('recusa sem aldeões suficientes ou com origem igual ao destino', () => {
    const e = vila(2, ['fazendeiro', 'lenhador']);
    recusar(e, { tipo: 'alocar_aldeoes', de: 'mineiro', para: 'sabio', quantidade: 1 }, 'aldeoes_insuficientes');
    recusar(e, { tipo: 'alocar_aldeoes', de: 'lenhador', para: 'sabio', quantidade: 2 }, 'aldeoes_insuficientes');
    recusar(e, { tipo: 'alocar_aldeoes', de: 'lenhador', para: 'lenhador', quantidade: 1 }, 'alocacao_invalida');
  });

  it('não muda limite de aldeões, consumo nem o total (40 continua alcançável)', () => {
    let e = vila(10, Array.from({ length: 39 }, () => 'lenhador' as const));
    e = fazer(e, { tipo: 'alocar_aldeoes', de: 'lenhador', para: 'ocioso', quantidade: 39 });
    const l = liquidar(e, e.t + 2 * MS_CHEGADA);
    expect(l.aldeoes.length).toBe(40);
  });

  it('a previsão do cliente dá o mesmo que o servidor', () => {
    const e = vila(3, ['fazendeiro', 'lenhador', 'mineiro', 'sabio']);
    const acao = { tipo: 'alocar_aldeoes', de: 'sabio', para: 'ferreiro', quantidade: 1 } as const;
    const agora = e.t + 5 * SEG;
    const servidor = aplicarAcao(e, acao, agora);
    const { segredo: _s, ...visao } = e;
    const cliente = preverAcao(visao, acao, agora);
    expect(cliente.ok && servidor.ok).toBe(true);
    const { segredo: _s2, ...esperado } = servidor.estado;
    expect(cliente.estado).toEqual(esperado);
  });

  it('um passo = muitos passos com aldeões a caminho', () => {
    const e = fazer(vila(4, ['fazendeiro', 'lenhador', 'mineiro', 'sabio']), {
      tipo: 'alocar_aldeoes', de: 'lenhador', para: 'ferreiro', quantidade: 1,
    });
    const alvo = e.t + 3 * MIN;
    const umPasso = liquidar(e, alvo);
    let muitos = e;
    for (let t = e.t + 1700; t < alvo; t += 1700) muitos = liquidar(muitos, t);
    muitos = liquidar(muitos, alvo);
    expect(muitos).toEqual(umPasso);
  });
});

describe('configurar_aldeoes', () => {
  it('escolher uma política pronta substitui "manter" e apaga a proporção', () => {
    let e = vila(2, ['fazendeiro', 'lenhador']);
    e = fazer(e, { tipo: 'alocar_aldeoes', de: 'lenhador', para: 'ocioso', quantidade: 1 });
    expect(e.aldeoesConfig.politica).toBe('manter');
    // Desligar mantendo "manter" guarda a proporção.
    const proporcao = e.aldeoesConfig.proporcao;
    e = fazer(e, { tipo: 'configurar_aldeoes', automatica: false, politica: 'manter' });
    expect(e.aldeoesConfig).toEqual({ automatica: false, politica: 'manter', proporcao });
    e = fazer(e, { tipo: 'configurar_aldeoes', automatica: false, politica: 'pesquisa' });
    expect(e.aldeoesConfig).toEqual({ automatica: false, politica: 'pesquisa' });
    // "manter" não se escolhe a partir de uma política pronta.
    recusar(e, { tipo: 'configurar_aldeoes', automatica: true, politica: 'manter' }, 'alocacao_invalida');
  });

  it('a configuração volta à inicial a cada ciclo', () => {
    const e = estadoInicial({ semente: 1, agora: T0, ciclo: 2 });
    expect(e.aldeoesConfig).toEqual({ automatica: true, politica: 'equilibrada' });
  });
});

describe('save do esquema 5', () => {
  it('migra para o 6 mantendo os ofícios, com a automática ligada na Equilibrada', () => {
    const atual = liquidar(novo(), T0 + 10 * MIN);
    const { aldeoesConfig: _c, ...v5 } = { ...atual, versao: 5 };
    const carregado = carregarEstado(JSON.parse(JSON.stringify(v5)), 5);
    expect(VERSAO_ESQUEMA).toBe(6);
    expect(carregado.versao).toBe(6);
    expect(carregado.aldeoes).toEqual(atual.aldeoes);
    expect(carregado.aldeoesConfig).toEqual({ automatica: true, politica: 'equilibrada' });
  });
});
