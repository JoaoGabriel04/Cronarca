import { describe, expect, it } from 'vitest';
import { NOMES_AVENTUREIROS } from '../data/aventureiros.ts';
import { aplicarAcao, esquemaAcao, type Acao } from '../src/acoes.ts';
import type { EstadoJogo } from '../src/estado.ts';
import { esquemaEstado, visaoDoCliente } from '../src/estado.ts';
import { chanceExitoBp } from '../src/formulas.ts';
import { liquidar } from '../src/liquidar.ts';
import { abrirMercador } from '../src/mercador.ts';
import { calcularTaxas, vagasGuilda } from '../src/regras.ts';
import { comRecursos, fazer, novo, recusar, SEG, T0, u } from './ajuda.ts';

describe('construir e melhorar', () => {
  it('construir paga o nível 1, ocupa o slot e conclui depois do tempo de obra', () => {
    const e = comRecursos(novo(), { madeira: 250, pedra: 50, ferro: 15 });
    const d = fazer(e, { tipo: 'construir', slot: 'serraria_2' });
    expect(d.recursos.madeira).toBe(u(40));
    expect(d.recursos.ferro).toBe(u(3));
    expect(d.slots.serraria_2).toEqual({ tipo: 'serraria', nivel: 0, obraAte: T0 + 30 * SEG });
    expect(liquidar(d, T0 + 30 * SEG).slots.serraria_2).toEqual({ tipo: 'serraria', nivel: 1, obraAte: null });
  });

  it('recusas não mudam nada além da liquidação', () => {
    const e = comRecursos(novo(), { madeira: 50 });
    recusar(e, { tipo: 'construir', slot: 'casa_1' }, 'slot_ja_construido');
    recusar(e, { tipo: 'melhorar', slot: 'forja_1' }, 'slot_vazio');
    const pobre = recusar(e, { tipo: 'construir', slot: 'forja_1' }, 'recursos_insuficientes');
    expect(pobre.recursos.madeira).toBe(u(50));
    expect(pobre.slots.forja_1.obraAte).toBeNull();

    const rico = novo();
    rico.slots.armazem_1.nivel = 3; // teto 721
    comRecursos(rico, { madeira: 600, pedra: 600, ferro: 300 });
    const ocupado = fazer(rico, { tipo: 'melhorar', slot: 'casa_1' });
    recusar(ocupado, { tipo: 'melhorar', slot: 'casa_1' }, 'slot_ocupado');
    // Outro slot pode ter obra ao mesmo tempo (sem limite global).
    fazer(ocupado, { tipo: 'construir', slot: 'pedreira_1' });

    const maximo = novo();
    maximo.slots.casa_1.nivel = 10;
    recusar(maximo, { tipo: 'melhorar', slot: 'casa_1' }, 'nivel_maximo');
  });
});

describe('melhorar: efeito antigo vale durante a obra', () => {
  it('a serraria segue produzindo no nível 1 até concluir o nível 2', () => {
    const e = novo();
    e.slots.armazem_1.nivel = 2; // teto 465: a Serraria 2 (326 madeira) não cabe no teto inicial de 300
    comRecursos(e, { madeira: 400, ferro: 30 });
    const d = fazer(e, { tipo: 'melhorar', slot: 'serraria_1' });
    expect(d.recursos.madeira).toBe(u(74));
    expect(d.slots.serraria_1.obraAte).toBe(T0 + 42 * SEG);
    // Durante a obra: nível 1 (1050/s). Depois: nível 2 (2100/s).
    expect(liquidar(d, T0 + 10 * SEG).recursos.madeira).toBe(u(74) + 1050 * 10_000);
    expect(liquidar(d, T0 + 52 * SEG).recursos.madeira).toBe(u(74) + 1050 * 42_000 + 2100 * 10_000);
  });
});

describe('pesquisas', () => {
  it('uma por vez, com requisito, e conclui no tempo', () => {
    const e = comRecursos(novo(), { saber: 250, ouro: 100 });
    recusar(e, { tipo: 'pesquisar', pesquisa: 'estradas_reais' }, 'requisito_pendente');
    const d = fazer(e, { tipo: 'pesquisar', pesquisa: 'cartografia' });
    expect(d.recursos.saber).toBe(u(190));
    recusar(d, { tipo: 'pesquisar', pesquisa: 'hospitalidade' }, 'pesquisa_em_andamento');
    const pronta = liquidar(d, T0 + 90 * SEG);
    expect(pronta.pesquisas).toEqual({ concluidas: ['cartografia'], atual: null });
    recusar(pronta, { tipo: 'pesquisar', pesquisa: 'cartografia' }, 'pesquisa_concluida');
    fazer(pronta, { tipo: 'pesquisar', pesquisa: 'estradas_reais' });
  });

  it('Colheita Farta dá +10% de comida', () => {
    const e = novo();
    e.pesquisas.concluidas.push('colheita_farta');
    expect(calcularTaxas(e).producao.comida).toBe(385);
  });
});

describe('guilda', () => {
  it('vagas: 4 + 1 por nível de Taverna + 1 por Taverna com Hospitalidade', () => {
    const e = novo();
    expect(vagasGuilda(e)).toBe(4);
    e.slots.taverna_1.nivel = 2;
    expect(vagasGuilda(e)).toBe(6);
    e.pesquisas.concluidas.push('hospitalidade');
    expect(vagasGuilda(e)).toBe(7);
  });

  it('contratar cobra 40 × 1,58^contratações, sorteia nome sem repetir e respeita as vagas', () => {
    let e = comRecursos(novo(), { ouro: 300, comida: 200 });
    e = fazer(e, { tipo: 'contratar' });
    expect(e.recursos.ouro).toBe(u(260));
    expect(e.recursos.comida).toBe(u(180));
    e = fazer(e, { tipo: 'contratar' });
    expect(e.recursos.ouro).toBe(u(197)); // 63
    e = fazer(e, { tipo: 'contratar' }); // 100
    expect(e.aventureiros).toHaveLength(4);
    expect(e.contratacoes).toBe(3);
    const nomes = e.aventureiros.map((a) => a.nome);
    expect(new Set(nomes).size).toBe(4);
    for (const n of nomes) expect(NOMES_AVENTUREIROS).toContain(n);
    recusar(e, { tipo: 'contratar' }, 'guilda_cheia');
  });

  it('Linhagem Heroica: novos aventureiros chegam um nível acima por nível', () => {
    const e = comRecursos(novo(), { ouro: 100, comida: 100 });
    e.reliquias = { total: 20, gastas: 16, niveis: { linhagem_heroica: 2 } };
    expect(fazer(e, { tipo: 'contratar' }).aventureiros.at(-1)!.nivel).toBe(3);
  });

  it('melhorar arma e armadura, até 6, fora de expedição', () => {
    let e = comRecursos(novo(), { ferro: 300, ouro: 300 });
    const id = e.aventureiros[0]!.id;
    e = fazer(e, { tipo: 'melhorar_equipamento', aventureiro: id, peca: 'arma' });
    expect(e.recursos.ferro).toBe(u(288));
    expect(e.recursos.ouro).toBe(u(285));
    expect(e.aventureiros[0]!.arma).toBe(1);
    e.aventureiros[0]!.arma = 6;
    recusar(e, { tipo: 'melhorar_equipamento', aventureiro: id, peca: 'arma' }, 'equipamento_maximo');
    recusar(e, { tipo: 'melhorar_equipamento', aventureiro: 'nao-existe', peca: 'arma' }, 'aventureiro_inexistente');
    const fora = fazer(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [id] });
    recusar(fora, { tipo: 'melhorar_equipamento', aventureiro: id, peca: 'armadura' }, 'aventureiro_indisponivel');
  });
});

describe('expedições', () => {
  const idInicial = (e: EstadoJogo) => e.aventureiros[0]!.id;

  it('valida destino, grupo, disponibilidade e comida', () => {
    const e = novo();
    const id = idInicial(e);
    recusar(e, { tipo: 'partir_expedicao', destino: 'mina', grupo: [id] }, 'destino_bloqueado');
    recusar(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [id, id] }, 'grupo_invalido');
    recusar(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['x'] }, 'aventureiro_inexistente');
    recusar(comRecursos(structuredClone(e), { comida: 0 }), { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [id] }, 'sem_comida');
    const fora = fazer(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [id] });
    recusar(fora, { tipo: 'partir_expedicao', destino: 'ruinas', grupo: [id] }, 'aventureiro_indisponivel');
  });

  it('o resultado é sorteado na partida, fica em segredo e é aplicado na volta', () => {
    const e = novo();
    const id = idInicial(e);
    const d = fazer(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [id] });
    const exp = d.expedicoes[0]!;
    expect(exp.fim).toBe(T0 + 30 * SEG);
    expect(d.segredo.resultados[exp.id]).toBeDefined();
    expect(JSON.stringify(visaoDoCliente(d))).not.toContain('vitoria');
    expect(d.aventureiros[0]!.estado).toBe('em_expedicao');

    const r = d.segredo.resultados[exp.id]!;
    const volta = liquidar(d, exp.fim);
    expect(volta.expedicoes).toHaveLength(0);
    expect(volta.segredo.resultados).toEqual({});
    expect(volta.aventureiros[0]!.xp).toBe(r.vitoria ? 2 : 1);
    if (r.vitoria) {
      expect(volta.recursos.madeira).toBeGreaterThanOrEqual(d.recursos.madeira);
    }
    // Esquema 3: a volta vira um relatório com os nomes, o resultado e o que entrou.
    expect(volta.relatorios).toHaveLength(1);
    expect(volta.relatorios[0]).toMatchObject({
      destino: 'floresta_lobos', grupo: [d.aventureiros[0]!.nome], vitoria: r.vitoria, em: exp.fim,
      feridos: r.feridos.map((f) => d.aventureiros.find((a) => a.id === f)!.nome),
    });
    if (!r.vitoria) expect(volta.relatorios[0]!.saque).toEqual({});
  });

  it('mesmo estado e mesma ação sorteiam o mesmo resultado', () => {
    const acao: Acao = { tipo: 'partir_expedicao', destino: 'ruinas', grupo: ['a1'] };
    expect(aplicarAcao(novo(), acao, T0)).toEqual(aplicarAcao(novo(), acao, T0));
  });

  it('a taxa de vitória segue a chance calculada', () => {
    let vitorias = 0;
    const n = 2000;
    for (let semente = 1; semente <= n; semente++) {
      const e = fazer(novo({ semente }), { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['a1'] });
      if (Object.values(e.segredo.resultados)[0]!.vitoria) vitorias += 1;
    }
    const esperado = chanceExitoBp(9, 9) / 10_000; // 41%
    expect(Math.abs(vitorias / n - esperado)).toBeLessThan(0.04);
  });

  it('saque na faixa do destino, com +10% por aventureiro extra', () => {
    for (let semente = 1; semente <= 200; semente++) {
      const e = comRecursos(novo({ semente }), { ouro: 300, comida: 200 });
      const g = fazer(fazer(e, { tipo: 'contratar' }), { tipo: 'contratar' });
      const d = fazer(g, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: g.aventureiros.map((a) => a.id) });
      const r = Object.values(d.segredo.resultados)[0]!;
      if (!r.vitoria) continue;
      expect(r.saque.madeira!).toBeGreaterThanOrEqual(u(25 * 1.2));
      expect(r.saque.madeira!).toBeLessThanOrEqual(u(45 * 1.2));
      expect(r.saque.ouro!).toBeGreaterThanOrEqual(u(0.4 * 1.2));
      expect(r.saque.ouro!).toBeLessThanOrEqual(u(1 * 1.2));
      expect(r.saque.pedra).toBeUndefined();
    }
  });

  it('derrota: recua sem saque; feridos ficam 60 s fora; vitória na Cripta marca o objetivo', () => {
    const e = novo();
    e.pesquisas.concluidas.push('cartografia', 'estradas_reais');
    // Procura sementes com cada desfecho na Cripta (5% de chance de vitória).
    let derrotaComFerido: EstadoJogo | undefined;
    let vitoria: EstadoJogo | undefined;
    for (let semente = 1; semente < 5000 && (!derrotaComFerido || !vitoria); semente++) {
      const x = structuredClone(e);
      x.segredo.rng = semente;
      const d = fazer(x, { tipo: 'partir_expedicao', destino: 'cripta', grupo: ['a1'] });
      const r = Object.values(d.segredo.resultados)[0]!;
      if (r.vitoria) vitoria ??= d;
      else if (r.feridos.length === 1) derrotaComFerido ??= d;
    }
    const fim = T0 + 300 * SEG;
    const ferido = liquidar(derrotaComFerido!, fim);
    expect(ferido.aventureiros[0]).toMatchObject({ estado: 'ferido', feridoAte: fim + 60 * SEG, xp: 1 });
    expect(ferido.recursos.ouro).toBe(u(40));
    expect(liquidar(derrotaComFerido!, fim + 60 * SEG).aventureiros[0]!.estado).toBe('na_vila');

    const venceu = liquidar(vitoria!, fim);
    expect(venceu.objetivos.criptaVencida).toBe(true);
    expect(venceu.recursos.ouro).toBeGreaterThan(u(40));
  });

  it('XP sobe de nível: de n para n+1 custa 4 × n', () => {
    const e = novo();
    e.aventureiros[0]!.xp = 3;
    const d = fazer(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['a1'] });
    const volta = liquidar(d, T0 + 30 * SEG);
    expect(volta.aventureiros[0]!.nivel).toBe(2);
    expect(volta.aventureiros[0]!.xp).toBeLessThan(4);
  });
});

describe('Mercador Viajante', () => {
  it('Aceitar troca 100 madeira por 15 ouro; Recusar dispensa', () => {
    const e = comRecursos(novo(), { madeira: 150, ouro: 10 });
    recusar(e, { tipo: 'responder_mercador', aceitar: true }, 'sem_mercador');
    abrirMercador(e, T0);
    const feito = fazer(e, { tipo: 'responder_mercador', aceitar: true });
    expect(feito.recursos.madeira).toBe(u(50));
    expect(feito.recursos.ouro).toBe(u(25));
    expect(feito.mercador).toBeNull();
    expect(fazer(e, { tipo: 'responder_mercador', aceitar: false }).recursos.madeira).toBe(u(150));
    recusar(comRecursos(structuredClone(e), { madeira: 99 }), { tipo: 'responder_mercador', aceitar: true }, 'recursos_insuficientes');
  });

  it('cobra e paga os termos gravados no evento (o que a tela mostrou), não a constante', () => {
    const e = comRecursos(novo(), { madeira: 50, pedra: 200, ouro: 10, saber: 0 });
    e.mercador = { expiraEm: T0 + 120 * SEG, paga: { pedra: u(80) }, recebe: { saber: u(7), ouro: u(3) } };
    const feito = fazer(e, { tipo: 'responder_mercador', aceitar: true });
    expect(feito.recursos).toMatchObject({ madeira: u(50), pedra: u(120), ouro: u(13), saber: u(7) });
    expect(feito.cronica.at(-1)?.texto).toBe('Negócio feito com o Mercador: 80 pedra por 3 ouro e 7 saber.');
  });
});

describe('relíquias e ascensão', () => {
  it('comprar relíquia: custo base × (n + 1), até o nível máximo', () => {
    const e = novo();
    e.reliquias.total = 10;
    let d = fazer(e, { tipo: 'comprar_reliquia', reliquia: 'bencao_colheita' }); // 5
    expect(d.reliquias).toEqual({ total: 10, gastas: 5, niveis: { bencao_colheita: 1 } });
    expect(calcularTaxas(d).producao.madeira).toBe(1155); // 1000 × 1,1 × 1,05
    recusar(d, { tipo: 'comprar_reliquia', reliquia: 'bencao_colheita' }, 'reliquias_insuficientes'); // 10
    d = fazer(d, { tipo: 'comprar_reliquia', reliquia: 'maos_calejadas' }); // 3
    d.reliquias.niveis.caminhos_eternos = 5;
    recusar(d, { tipo: 'comprar_reliquia', reliquia: 'caminhos_eternos' }, 'reliquia_maxima');
  });

  it('ascender exige os três objetivos', () => {
    const e = novo();
    recusar(e, { tipo: 'ascender' }, 'objetivos_pendentes');
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    recusar(e, { tipo: 'ascender' }, 'objetivos_pendentes'); // faltam 40 aldeões
  });

  it('ascender reinicia o ciclo, mantém relíquias, soma o ganho e aplica o Legado', () => {
    const e = comRecursos(novo(), { madeira: 290, ouro: 200 });
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    e.slots.casa_1.nivel = 10;
    e.reliquias = { total: 6, gastas: 3, niveis: { legado: 1 } };
    const d = fazer(e, { tipo: 'ascender' });
    expect(d.ciclo).toBe(2);
    // A13: o mapa é o mesmo em todos os ciclos.
    expect(d.mundo).toEqual({ versaoMapa: e.mundo.versaoMapa });
    expect(d.era).toBe(1);
    expect(d.reliquias).toEqual({ total: 9, gastas: 3, niveis: { legado: 1 } });
    expect(d.recursos).toEqual({ madeira: u(160), pedra: u(80), comida: u(120), ferro: u(15), ouro: u(40), saber: 0 });
    expect(d.slots.casa_1.nivel).toBe(1);
    expect(d.aldeoes).toHaveLength(2);
    expect(d.aventureiros).toHaveLength(1);
    expect(d.pesquisas.concluidas).toEqual([]);
    expect(d.objetivos.criptaVencida).toBe(false);
    expect(d.cronica.at(-1)?.icone).toBe('Ascensao');
    expect(() => esquemaEstado.parse(d)).not.toThrow();
  });
});

describe('clique', () => {
  it('rende o recurso da construção produtora: 1 × (1 + 0,25 × Mãos Calejadas)', () => {
    const e = novo();
    const r = aplicarAcao(e, { tipo: 'clicar', objeto: 'serraria_1', quantidade: 3 }, T0);
    expect(r.ok && r.cliquesAceitos).toBe(3);
    expect(r.estado.recursos.madeira).toBe(u(103));
    e.reliquias.niveis.maos_calejadas = 2;
    expect(fazer(e, { tipo: 'clicar', objeto: 'serraria_1', quantidade: 2 }).recursos.madeira).toBe(u(103));
  });

  it('só objetos clicáveis: construção vazia ou que não produz é recusada', () => {
    const e = novo();
    recusar(e, { tipo: 'clicar', objeto: 'serraria_2', quantidade: 1 }, 'objeto_invalido');
    recusar(e, { tipo: 'clicar', objeto: 'casa_1', quantidade: 1 }, 'objeto_invalido');
    // O Scriptorium produz saber, mas o clique nele abre a Pesquisa (handoff): não rende.
    e.slots.scriptorium_1.nivel = 2;
    recusar(e, { tipo: 'clicar', objeto: 'scriptorium_1', quantidade: 1 }, 'objeto_invalido');
    recusar(e, { tipo: 'clicar', objeto: 'arvore_1', quantidade: 1 }, 'objeto_invalido');
    const r = aplicarAcao(e, { tipo: 'clicar', objeto: 'arvore_1', quantidade: 1 }, T0, { objetosDoMapa: { arvore_1: 'madeira' } });
    expect(r.ok).toBe(true);
  });

  it('limita 5/s por objeto e 10/s por usuário, e recarrega com o relógio do servidor', () => {
    let e = novo();
    e.slots.serraria_2.nivel = 1;
    e.slots.pedreira_1.nivel = 1;
    const clicar = (objeto: string, quantidade: number, agora: number) =>
      aplicarAcao(e, { tipo: 'clicar', objeto, quantidade }, agora);

    let r = clicar('serraria_1', 12, T0);
    expect(r.ok && r.cliquesAceitos).toBe(5);
    e = r.estado;
    r = clicar('serraria_2', 12, T0);
    expect(r.ok && r.cliquesAceitos).toBe(5);
    e = r.estado;
    r = clicar('pedreira_1', 1, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe('limite_cliques');

    r = clicar('pedreira_1', 50, T0 + 500); // meio segundo: 5 fichas do usuário
    expect(r.ok && r.cliquesAceitos).toBe(5);
    e = r.estado;
    r = clicar('serraria_1', 50, T0 + 1500);
    expect(r.ok && r.cliquesAceitos).toBe(5); // objeto recarregou 5, usuário 10
  });

  it('ganho do clique também é cortado no teto', () => {
    const e = comRecursos(novo(), { madeira: 299.5 });
    expect(fazer(e, { tipo: 'clicar', objeto: 'serraria_1', quantidade: 5 }).recursos.madeira).toBe(u(300));
  });
});

describe('esquema das ações', () => {
  it('o cliente só manda intenção e ids', () => {
    expect(esquemaAcao.safeParse({ tipo: 'construir', slot: 'casa_1' }).success).toBe(true);
    expect(esquemaAcao.safeParse({ tipo: 'construir', slot: 'casa_1', custo: 0 }).success).toBe(false);
    expect(esquemaAcao.safeParse({ tipo: 'clicar', objeto: 'serraria_1', quantidade: 1000 }).success).toBe(false);
    expect(esquemaAcao.safeParse({ tipo: 'partir_expedicao', destino: 'cripta', grupo: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(esquemaAcao.safeParse({ tipo: 'roubar' }).success).toBe(false);
  });
});
