import { construiveis, custoConstrucao, estadoInicial, HITBOX_CONSTRUCAO, MAPA, MICRO, PESQUISAS, tempoObraMs, visaoDoCliente, type VisaoCliente } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { dadosAscensao, dadosMelhorar, dadosPesquisa, efeitoNoNivel, filtrarCatalogo, formatarDuracao, linhasCatalogoTela, seloConstruir } from '../lib/casca/modais';
import { limitarCamera } from '../lib/mapa/camera';
import { areaDoMapa, cameraDoSlot, VIEWPORT_DESKTOP, VISOES, VISOES_CELULAR } from '../lib/mapa/visoes';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
function novo(): VisaoCliente {
  return visaoDoCliente(estadoInicial({ semente: 42, agora: T0 }));
}
const rico = (e: VisaoCliente) => {
  for (const r of Object.keys(e.recursos) as (keyof typeof e.recursos)[]) e.recursos[r] = 100_000 * MICRO;
  return e;
};

describe('modais: Melhorar', () => {
  it('Melhorar a Casa: hoje e no próximo nível, custo e tempo da regra', () => {
    const e = rico(novo());
    e.slots.casa_1.nivel = 3;
    const d = dadosMelhorar(e, 'casa_1', T0);
    expect(d).toMatchObject({ nome: 'Casa', etiqueta: 'Nv 3 → Nv 4', hoje: '+12 aldeões', depois: '+16 aldeões', situacao: 'pronta', pode: true, motivo: null });
    const custo = custoConstrucao('casa', 4);
    expect(d.custo.map((c) => c.recurso)).toEqual(Object.keys(custo));
    expect(d.custo.every((c) => !c.falta)).toBe(true);
    expect(d.tempo).toBe(formatarDuracao(tempoObraMs(4)));
    expect(d.nota).toBe('A casa fica ocupada durante a obra e o efeito atual continua valendo.');
  });

  it('sem recursos: o que falta fica marcado e o botão trava', () => {
    const e = novo();
    for (const r of Object.keys(e.recursos) as (keyof typeof e.recursos)[]) e.recursos[r] = 0;
    const d = dadosMelhorar(e, 'armazem_1', T0);
    expect(d.custo.every((c) => c.falta)).toBe(true);
    expect(d).toMatchObject({ pode: false, motivo: 'Recursos insuficientes' });
    expect(d.nota).toMatch(/^O armazém fica ocupado/);
  });

  it('em obra e no nível máximo', () => {
    const e = rico(novo());
    e.slots.casa_1.obraAte = T0 + 45_000;
    expect(dadosMelhorar(e, 'casa_1', T0)).toMatchObject({ situacao: 'obra', restante: '00:45', pode: false, motivo: 'Em obra' });
    e.slots.casa_1 = { ...e.slots.casa_1, nivel: 10, obraAte: null };
    expect(dadosMelhorar(e, 'casa_1', T0)).toMatchObject({ situacao: 'maximo', etiqueta: 'Nv 10', custo: [], pode: false, motivo: 'Nível máximo' });
  });

  it('efeito de cada tipo: produção, armazém (soma), celeiro, taverna com Hospitalidade, muralha', () => {
    const e = novo();
    expect(efeitoNoNivel(e, 'serraria_1', 2)).toBe('+2 madeira/s');
    expect(efeitoNoNivel(e, 'scriptorium_1', 1)).toBe('+0,12 saber/s');
    expect(efeitoNoNivel(e, 'armazem_1', 1)).toBe('Guarda 300');
    expect(efeitoNoNivel(e, 'armazem_1', 2)).toBe('Guarda 465');
    expect(efeitoNoNivel(e, 'celeiro_1', 2)).toBe('Guarda 465 de comida');
    expect(efeitoNoNivel(e, 'taverna_1', 2)).toBe('+2 vagas');
    e.pesquisas.concluidas.push('hospitalidade');
    expect(efeitoNoNivel(e, 'taverna_1', 1)).toBe('+2 vagas');
    expect(efeitoNoNivel(e, 'muralha_1', 0)).toBe('Sem defesa');
    expect(efeitoNoNivel(e, 'muralha_1', 1)).toBe('Repele bandidos');
  });

  it('teto efetivo com Legado 8 (Portão 18a): madeira 580 e comida 400 até o Armazém/Celeiro 3', () => {
    const e = novo();
    e.reliquias.niveis.legado = 8;
    expect(efeitoNoNivel(e, 'armazem_1', 1)).toBe('Guarda 300 (madeira 580)');
    expect(efeitoNoNivel(e, 'armazem_1', 2)).toBe('Guarda 465 (madeira 580)');
    expect(efeitoNoNivel(e, 'armazem_1', 3)).toBe('Guarda 721');
    expect(efeitoNoNivel(e, 'celeiro_1', 1)).toBe('Guarda 400 de comida');
    expect(efeitoNoNivel(e, 'celeiro_1', 2)).toBe('Guarda 465 de comida');
    // Sem Legado, nada muda.
    e.reliquias.niveis = {};
    expect(efeitoNoNivel(e, 'armazem_1', 1)).toBe('Guarda 300');
  });

});

describe('catálogo na tela (A12)', () => {
  it('abas Todas | Disponíveis: Todas mostra as 11 linhas na ordem; Disponíveis, só as construíveis agora', () => {
    const e = rico(novo());
    e.recursos.ouro = 0;
    const linhas = linhasCatalogoTela(e, T0);
    expect(filtrarCatalogo(linhas, 'todas')).toEqual(linhas);
    expect(filtrarCatalogo(linhas, 'todas')).toHaveLength(11);
    const disp = filtrarCatalogo(linhas, 'disponiveis');
    expect(disp.length).toBeGreaterThan(0);
    expect(disp.every((l) => l.estado === 'construivel')).toBe(true);
    expect(disp.map((l) => l.slot)).toEqual(linhas.filter((l) => l.estado === 'construivel').map((l) => l.slot));
    // O mesmo critério do selo do botão Construir.
    expect(disp.map((l) => l.slot).sort()).toEqual([...construiveis(e)].sort());
    for (const r of Object.keys(e.recursos) as (keyof typeof e.recursos)[]) e.recursos[r] = 0;
    expect(filtrarCatalogo(linhasCatalogoTela(e, T0), 'disponiveis')).toEqual([]);
  });

  it('cada estado com o que a linha mostra: custo, motivo em texto, nível, obra e o botão', () => {
    const e = rico(novo());
    e.recursos.ouro = 0;
    e.slots.casa_1.nivel = 3;
    e.slots.muralha_1.obraAte = T0 + 32_000;
    const porSlot = Object.fromEntries(linhasCatalogoTela(e, T0).map((l) => [l.slot, l]));
    expect(porSlot.forja_1).toMatchObject({ estado: 'construivel', acao: 'construir', pode: true, motivo: null, sprite: { grupo: 'construcao', id: 'forja' } });
    expect(porSlot.forja_1!.custo.every((c) => !c.falta)).toBe(true);
    expect(porSlot.taverna_1).toMatchObject({ estado: 'sem_recursos', acao: 'construir', pode: false, motivo: 'Falta ouro' });
    expect(porSlot.taverna_1!.custo.find((c) => c.recurso === 'ouro')!.falta).toBe(true);
    // c2: o Mercado nível 1 não pede ouro; sem ouro, continua construível.
    expect(porSlot.mercado_1).toMatchObject({ estado: 'construivel', pode: true });
    expect(porSlot.mercado_1!.custo.map((c) => c.recurso)).toEqual(['madeira']);
    expect(porSlot.muralha_1).toMatchObject({ estado: 'em_obra', acao: null, custo: [], obra: { restante: '00:32' } });
    // Construída: o resumo do próximo nível já na linha (o mesmo cálculo do modal Melhorar).
    expect(porSlot.casa_1).toMatchObject({
      estado: 'construida', acao: 'melhorar', pode: true, nivel: 'Nível 3 → 4', motivo: null,
      efeito: { hoje: '+12 aldeões', depois: '+16 aldeões' }, tempo: '1:22 de obra',
    });
    expect(porSlot.casa_1!.custo.map((c) => `${c.recurso} ${c.valor}`)).toEqual(['madeira 447', 'pedra 223']);
    expect(porSlot.serraria_2!.nome).toBe('Serraria II');
  });

  it('com a ordem guardada ao abrir, as linhas não pulam quando o estado muda', () => {
    const e = rico(novo());
    e.recursos.ouro = 0;
    const ordem = linhasCatalogoTela(e, T0).map((l) => l.slot);
    e.recursos.ouro = 100_000 * MICRO; // Mercado e Taverna passam a ser construíveis
    const depois = linhasCatalogoTela(e, T0, ordem);
    expect(depois.map((l) => l.slot)).toEqual(ordem);
    expect(depois.find((l) => l.slot === 'mercado_1')!.estado).toBe('construivel');
    // Sem a ordem guardada, elas iriam para cima.
    expect(linhasCatalogoTela(e, T0).map((l) => l.slot)).not.toEqual(ordem);
  });

  it('selo: conta os construíveis, some ao abrir e volta com um construível novo', () => {
    const e = rico(novo());
    e.recursos.ouro = 0;
    const antes = construiveis(e);
    expect(seloConstruir(e, new Set())).toBe(antes.length);
    const vistos = new Set(antes);
    expect(seloConstruir(e, vistos)).toBe(0);
    e.recursos.ouro = 100_000 * MICRO;
    expect(seloConstruir(e, vistos)).toBe(construiveis(e).length);
    for (const r of Object.keys(e.recursos) as (keyof typeof e.recursos)[]) e.recursos[r] = 0;
    expect(seloConstruir(e, new Set())).toBe(0);
  });

  it('a câmera vai ao centro da pegada do slot, no zoom da Vila, e cabe no mapa', () => {
    const m = MAPA;
    for (const s of m.slots) {
      const c = cameraDoSlot(m, s.id);
      const hb = HITBOX_CONSTRUCAO[s.tipo];
      expect(c).toEqual({ x: s.x + hb.x + hb.largura / 2, y: s.y + hb.y + hb.altura / 2, zoom: VISOES.vila.zoom });
      const lim = limitarCamera(c, areaDoMapa(), VIEWPORT_DESKTOP);
      expect(Number.isInteger(lim.zoom)).toBe(true);
      // O núcleo fica longe das bordas da imagem: a câmera do slot não é empurrada.
      expect(lim).toEqual(c);
    }
    expect(() => cameraDoSlot(m, 'nao_existe' as never)).toThrow();
    // Celular: a mesma câmera no zoom 2x da Vila do celular.
    expect(cameraDoSlot(m, 'forja_1', true)).toEqual({ ...cameraDoSlot(m, 'forja_1'), zoom: VISOES_CELULAR.vila.zoom });
  });
});

describe('modais: Pesquisa', () => {
  it('os quatro estados: concluída, em andamento, disponível e bloqueada', () => {
    const e = rico(novo());
    e.slots.scriptorium_1.nivel = 1;
    e.pesquisas.concluidas.push('hospitalidade');
    e.pesquisas.atual = { id: 'cartografia', fim: T0 + 42_000 };
    const d = dadosPesquisa(e, T0);
    expect(d.subtitulo).toBe('Scriptorium nível 1 · uma pesquisa por vez');
    expect(d.saber).toBe('100.000 de saber');
    const porId = Object.fromEntries(d.cartas.map((c) => [c.id, c]));
    expect(porId.hospitalidade).toMatchObject({ estado: 'concluida', descricao: PESQUISAS.hospitalidade.descricao });
    expect(porId.cartografia).toMatchObject({ estado: 'andamento', restante: '00:42 restantes' });
    expect(porId.cartografia!.progresso).toBeCloseTo(1 - 42 / PESQUISAS.cartografia.segundos);
    // Uma por vez: com outra em andamento, a disponível trava.
    expect(porId.colheita_farta).toMatchObject({ estado: 'disponivel', pode: false, motivo: 'Outra pesquisa em andamento', tempo: '2:00' });
    expect(porId.estradas_reais).toMatchObject({ estado: 'bloqueada', requer: 'Requer Cartografia' });
    expect(porId.carta_real).toMatchObject({ estado: 'bloqueada', requer: 'Requer Estradas Reais' });
  });

  it('sem pesquisa em andamento: dá para pesquisar se pagar; senão, o custo que falta fica marcado', () => {
    const e = novo();
    e.recursos.saber = 35 * MICRO;
    const porId = Object.fromEntries(dadosPesquisa(e, T0).cartas.map((c) => [c.id, c]));
    expect(porId.colheita_farta).toMatchObject({ estado: 'disponivel', pode: true });
    expect(porId.cartografia).toMatchObject({ pode: false, motivo: 'Recursos insuficientes' });
    expect(porId.cartografia!.custo).toEqual([{ recurso: 'saber', valor: '60', falta: true }]);
  });
});

describe('modais: Ascensão', () => {
  it('o ciclo seguinte da Era I, relíquias da regra e o que reinicia', () => {
    const e = novo();
    const d = dadosAscensao(e);
    expect(d).toMatchObject({ era: 'Era I · Aldeia', de: 'Ciclo 1', para: 'Ciclo 2', pode: false });
    expect(d.ganho).toMatch(/^\+\d+ relíquias? ao ascender$/);
    expect(d.reinicia).toContain('Aventureiros e equipamentos');
    expect(d.leva).toEqual(['Relíquias e seus níveis', 'Registro do ciclo']);
  });

  it('formatarDuracao no formato do Figma', () => {
    expect(formatarDuracao(45_000)).toBe('0:45');
    expect(formatarDuracao(90_000)).toBe('1:30');
    expect(formatarDuracao(3_720_000)).toBe('1:02:00');
  });
});

describe('catálogo: linha de construção já feita', () => {
  it('sem recurso: o motivo diz o que falta e o Melhorar fica apagado', () => {
    const e = novo();
    const casa = linhasCatalogoTela(e, T0).find((l) => l.slot === 'casa_1')!;
    expect(casa).toMatchObject({ acao: 'melhorar', pode: false, nivel: 'Nível 1 → 2' });
    expect(casa.motivo).toMatch(/^Falta /);
  });

  it('no nível máximo: sem botão, sem custo, "Nível 10 · máximo"', () => {
    const e = novo();
    e.slots.casa_1.nivel = 10;
    const casa = linhasCatalogoTela(e, T0).find((l) => l.slot === 'casa_1')!;
    expect(casa).toMatchObject({ acao: null, pode: false, nivel: 'Nível 10 · máximo', efeito: null, tempo: null, custo: [] });
  });
});
