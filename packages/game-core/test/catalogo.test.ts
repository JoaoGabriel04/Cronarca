import { describe, expect, it } from 'vitest';
import { CONSTRUCOES, type DadosConstrucao } from '../data/construcoes.ts';
import { SLOT_IDS } from '../data/slots.ts';
import { construiveis, linhaCatalogo, linhasCatalogo, nomeDoSlot, ORDEM_CATALOGO } from '../src/catalogo.ts';
import { visaoDoCliente } from '../src/estado.ts';
import { custoConstrucao, tempoObraMs } from '../src/formulas.ts';
import { aplicarAcao } from '../src/acoes.ts';
import { comRecursos, novo, T0, u } from './ajuda.ts';

const rico = () => visaoDoCliente(comRecursos(novo(), { madeira: 5000, pedra: 5000, comida: 5000, ferro: 5000, ouro: 5000, saber: 5000 }));

describe('catálogo de construções', () => {
  it('uma linha por slot (11), com o segundo slot do tipo numerado', () => {
    const l = linhasCatalogo(rico(), T0);
    expect(l).toHaveLength(SLOT_IDS.length);
    expect(new Set(l.map((x) => x.slot)).size).toBe(SLOT_IDS.length);
    expect(nomeDoSlot('serraria_1')).toBe('Serraria');
    expect(nomeDoSlot('serraria_2')).toBe('Serraria II');
    expect(nomeDoSlot('casa_1')).toBe('Casa');
  });

  it('Construível: slot vazio com recursos, custo do nível 1 da fórmula', () => {
    const l = linhaCatalogo(rico(), 'forja_1', T0);
    expect(l).toMatchObject({ estado: 'construivel', nivel: 0, falta: [], obra: null, requer: null });
    expect(l.custo).toEqual(custoConstrucao('forja', 1));
  });

  it('Sem recursos: marca só o recurso que falta', () => {
    const e = rico();
    e.recursos.pedra = u(10); // a Forja pede pedra e madeira
    const l = linhaCatalogo(e, 'forja_1', T0);
    expect(l.estado).toBe('sem_recursos');
    expect(l.falta).toEqual(['pedra']);
    // Exatamente o custo também paga.
    e.recursos.pedra = custoConstrucao('forja', 1).pedra!;
    expect(linhaCatalogo(e, 'forja_1', T0).estado).toBe('construivel');
  });

  it('Em obra: primeira construção e melhoria, com o andamento da barra', () => {
    const e = novo();
    comRecursos(e, { madeira: 5000, pedra: 5000, ferro: 5000 });
    const r = aplicarAcao(e, { tipo: 'construir', slot: 'forja_1' }, T0);
    expect(r.ok).toBe(true);
    const v = visaoDoCliente(r.estado);
    const total = tempoObraMs(1, 0);
    const meio = linhaCatalogo(v, 'forja_1', T0 + total / 2);
    expect(meio).toMatchObject({ estado: 'em_obra', nivel: 0, obra: { inicio: T0, fim: T0 + total, fracao: 0.5 } });
    // Melhoria em obra num slot já de pé também é Em obra (não Construída).
    const m = aplicarAcao(r.estado, { tipo: 'melhorar', slot: 'casa_1' }, T0);
    expect(m.ok).toBe(true);
    const casa = linhaCatalogo(visaoDoCliente(m.estado), 'casa_1', T0);
    expect(casa).toMatchObject({ estado: 'em_obra', nivel: 1 });
    expect(casa.obra!.fim - casa.obra!.inicio).toBe(tempoObraMs(2, 0));
  });

  it('Construída: nível atual, sem custo', () => {
    const e = rico();
    e.slots.casa_1.nivel = 3;
    expect(linhaCatalogo(e, 'casa_1', T0)).toMatchObject({ estado: 'construida', nivel: 3, custo: {}, falta: [] });
  });

  it('Bloqueada: só aparece com requisito (nenhum na v0)', () => {
    const e = rico();
    expect(linhasCatalogo(e, T0).some((l) => l.estado === 'bloqueada')).toBe(false);
    const forja = CONSTRUCOES.forja as DadosConstrucao;
    forja.requer = 'cartografia';
    try {
      expect(linhaCatalogo(e, 'forja_1', T0)).toMatchObject({ estado: 'bloqueada', requer: 'cartografia' });
      e.pesquisas.concluidas.push('cartografia');
      expect(linhaCatalogo(e, 'forja_1', T0).estado).toBe('construivel');
    } finally {
      delete forja.requer;
    }
  });

  it('ordem: construíveis, sem recursos, em obra, construídas; dentro do estado, a ordem dos slots', () => {
    const e = rico();
    e.recursos.ouro = 0; // Mercado e Taverna pedem ouro
    e.slots.muralha_1.obraAte = T0 + 10_000;
    const l = linhasCatalogo(e, T0);
    const ordem = l.map((x) => ORDEM_CATALOGO.indexOf(x.estado));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
    const construidas = l.filter((x) => x.estado === 'construida').map((x) => x.slot);
    expect(construidas).toEqual(SLOT_IDS.filter((id) => construidas.includes(id)));
    // Sem ouro, a Taverna não dá; o Mercado nível 1 não pede ouro (c2) e continua construível.
    expect(l.filter((x) => x.estado === 'sem_recursos').map((x) => x.slot)).toEqual(['taverna_1']);
    expect(l.find((x) => x.slot === 'muralha_1')!.estado).toBe('em_obra');
  });

  it('o selo conta os slots vazios que já dá para pagar', () => {
    const e = rico();
    const vazios = SLOT_IDS.filter((id) => e.slots[id].nivel === 0);
    expect(construiveis(e)).toEqual(vazios);
    for (const r of Object.keys(e.recursos) as (keyof typeof e.recursos)[]) e.recursos[r] = 0;
    expect(construiveis(e)).toEqual([]);
  });
});
