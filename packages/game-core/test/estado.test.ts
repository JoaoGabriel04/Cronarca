import { describe, expect, it } from 'vitest';
import { SLOT_IDS } from '../data/slots.ts';
import { esquemaEstado, validarEstado, VERSAO_ESQUEMA, visaoDoCliente } from '../src/estado.ts';
import { estadoInicial } from '../src/inicial.ts';
import { liquidar } from '../src/liquidar.ts';
import { MIN, T0, u } from './ajuda.ts';

describe('estado inicial do ciclo', () => {
  const e = estadoInicial({ semente: 1, agora: T0 });

  it('segue a Economia v0', () => {
    expect(e.recursos).toEqual({ madeira: u(100), pedra: u(50), comida: u(80), ferro: u(15), ouro: u(40), saber: 0 });
    const prontos = SLOT_IDS.filter((id) => e.slots[id].nivel === 1);
    expect(prontos.sort()).toEqual(['armazem_1', 'casa_1', 'celeiro_1', 'serraria_1']);
    expect(e.aldeoes.map((a) => a.oficio)).toEqual(['fazendeiro', 'lenhador']);
    expect(e.aventureiros).toHaveLength(1);
    expect(e.aventureiros[0]).toMatchObject({ classe: 'guerreiro', nivel: 1, arma: 0, armadura: 0, estado: 'na_vila' });
    expect(e.versao).toBe(VERSAO_ESQUEMA);
    expect(e.ciclo).toBe(1);
  });

  it('Legado acima do teto é cortado, como todo recurso que entra', () => {
    const l = estadoInicial({ semente: 1, agora: T0, reliquias: { total: 30, gastas: 30, niveis: { legado: 4 } } });
    expect(l.recursos.madeira).toBe(u(300)); // 100 + 240 -> teto 300
    expect(l.recursos.pedra).toBe(u(170));
  });
});

describe('esquema', () => {
  it('aceita o estado inicial e o estado depois de horas de jogo', () => {
    const e = estadoInicial({ semente: 3, agora: T0 });
    expect(esquemaEstado.parse(e)).toEqual(e);
    expect(() => esquemaEstado.parse(liquidar(e, T0 + 6 * 60 * MIN))).not.toThrow();
  });

  it('sobrevive à ida e volta em JSON (jsonb)', () => {
    const e = liquidar(estadoInicial({ semente: 3, agora: T0 }), T0 + 90 * MIN);
    expect(validarEstado(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('A11: recusa estado.versao diferente de versaoEsquema', () => {
    const e = estadoInicial({ semente: 3, agora: T0 });
    expect(() => validarEstado(e, VERSAO_ESQUEMA + 1)).toThrow(/diverge/);
  });

  it('recusa estados impossíveis', () => {
    const e = estadoInicial({ semente: 3, agora: T0 });
    const ruim = (f: (x: typeof e) => void) => {
      const x = structuredClone(e) as typeof e;
      f(x);
      return esquemaEstado.safeParse(x).success;
    };
    expect(ruim((x) => (x.recursos.madeira = -1))).toBe(false);
    expect(ruim((x) => (x.recursos.madeira = 0.5))).toBe(false);
    expect(ruim((x) => ((x.slots.casa_1 as { tipo: string }).tipo = 'forja'))).toBe(false);
    expect(ruim((x) => (x.slots.casa_1.nivel = 11))).toBe(false);
    expect(ruim((x) => (x.reliquias.gastas = 1))).toBe(false);
    expect(ruim((x) => ((x as unknown as Record<string, unknown>).trapaca = true))).toBe(false);
  });
});

describe('visão do cliente', () => {
  it('não inclui o gerador, o próximo evento nem resultados sorteados', () => {
    const e = estadoInicial({ semente: 3, agora: T0 });
    const v = visaoDoCliente(e);
    expect(v).not.toHaveProperty('segredo');
    expect(JSON.stringify(v)).not.toContain(String(e.segredo.proximoEventoEm));
  });
});

describe('migração de saves', () => {
  const antigo = async () => {
    const { estadoInicial } = await import('../src/inicial.ts');
    const atual = estadoInicial({ semente: 1, agora: Date.UTC(2026, 5, 1) });
    // Esquema 3: mundo por semente (Portão 7b, cancelado pela A13).
    const v3 = { ...atual, versao: 3, mundo: { semente: 123456, versaoGerador: 1 } };
    return { atual, v3 };
  };

  it('esquema 2 migra até o atual: relatórios vazios e mapa fixo', async () => {
    const { carregarEstado, migrarEstado } = await import('../src/estado.ts');
    const { atual, v3 } = await antigo();
    const { relatorios: _r, ...semRelatorios } = v3;
    const v2 = { ...semRelatorios, versao: 2 };
    expect(migrarEstado(v2, 2).versao).toBe(VERSAO_ESQUEMA);
    const carregado = carregarEstado(JSON.parse(JSON.stringify(v2)), 2);
    expect(carregado.relatorios).toEqual([]);
    // Save antigo fica na versão 1 do mapa (mesma jogabilidade da 2).
    expect(carregado).toEqual({ ...atual, mundo: { versaoMapa: 1 } });
  });

  it('esquema 3 (mundo por semente) migra para o 4 com { versaoMapa: 1 }', async () => {
    const { carregarEstado } = await import('../src/estado.ts');
    const { atual, v3 } = await antigo();
    const carregado = carregarEstado(JSON.parse(JSON.stringify(v3)), 3);
    expect(carregado.versao).toBe(4);
    expect(carregado.mundo).toEqual({ versaoMapa: 1 });
    expect(carregado).toEqual({ ...atual, mundo: { versaoMapa: 1 } });
    expect(carregarEstado(JSON.parse(JSON.stringify(atual)), 4)).toEqual(atual);
  });

  it('recusa semente e versaoGerador no esquema atual', async () => {
    const { atual } = await antigo();
    expect(() => validarEstado({ ...atual, mundo: { versaoMapa: 1, semente: 1 } })).toThrow();
    expect(() => validarEstado({ ...atual, mundo: { versaoMapa: 3 } })).toThrow();
    // A versão 2 do mapa (árvores com vento) vale no esquema atual, como a 1.
    expect(validarEstado({ ...atual, mundo: { versaoMapa: 2 } }).mundo).toEqual({ versaoMapa: 2 });
  });
});
