// Portão 21: descoberta do Quartel General por uma expedição, custo de reerguer, estado persistente.
import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL_CICLO } from '../data/eras.ts';
import { DESTINOS, DESTINOS_IDS, FAIXAS_PERIGO, TAMANHO_MAXIMO_GRUPO } from '../data/expedicoes.ts';
import { DESTINO_QG, PONTO_QG, QG, TEXTOS_QG } from '../data/qg.ts';
import { aplicarAcao, type Acao } from '../src/acoes.ts';
import { CAPITULOS, CAPITULOS_IDS } from '../data/lore.ts';
import { carregarEstado, migrarEstado, validarEstado, VERSAO_ESQUEMA, type EstadoJogo } from '../src/estado.ts';
import { estadoInicial } from '../src/inicial.ts';
import { micro } from '../src/inteiros.ts';
import { liquidar } from '../src/liquidar.ts';
import { esquemaMetaMapa, META_MAPA, MAPA } from '../src/mapa/meta.ts';
import { proximoPasso } from '../src/objetivo.ts';
import { destinoAberto, destinoVisivel, qgReerguido } from '../src/regras.ts';
import { visaoDoCliente } from '../src/estado.ts';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const MIN = 60_000;

function novo(): EstadoJogo {
  const e = estadoInicial({ semente: 42, agora: T0 });
  e.segredo.proximoEventoEm = T0 + 10 ** 9; // sem eventos aleatórios no teste
  return e;
}
const ok = (e: EstadoJogo, a: Acao, t: number) => {
  const r = aplicarAcao(e, a, t);
  if (!r.ok) throw new Error(`recusada: ${r.erro}`);
  return r.estado;
};
const partir = (e: EstadoJogo, t = e.t) => ok(e, { tipo: 'partir_expedicao', destino: DESTINO_QG, grupo: [e.aventureiros[0]!.id] }, t);
/** Faz o resultado sorteado da expedição ser o pedido (vitória ou recuo), para testar os dois caminhos. */
function forcar(e: EstadoJogo, vitoria: boolean) {
  const exp = e.expedicoes[0]!;
  e.segredo.resultados[exp.id] = { vitoria, saque: vitoria ? { pedra: micro(15), madeira: micro(20), ouro: micro(4) } : {}, feridos: [] };
}
const textos = (e: EstadoJogo) => e.cronica.map((l) => l.texto);

describe('o destino das Ruínas do Quartel General (dados)', () => {
  it('vem primeiro, com perigo baixo e 40 s, sem exigir pesquisa, e o saque aprovado', () => {
    expect(DESTINOS_IDS[0]).toBe(DESTINO_QG);
    const d = DESTINOS[DESTINO_QG];
    expect(d.nome).toBe('Ruínas do Quartel General');
    expect(d.perigo).toBe(6);
    expect(FAIXAS_PERIGO.find((f) => d.perigo <= f.ate)!.nome).toBe('baixo');
    expect(d.segundos).toBe(40);
    expect(d.segundos).toBeGreaterThanOrEqual(30);
    expect(d.segundos).toBeLessThanOrEqual(60);
    expect(d.requer).toBeNull();
    expect(d.saque).toEqual({ pedra: [12, 20], madeira: [15, 25], ouro: [3, 6] });
    expect(TAMANHO_MAXIMO_GRUPO).toBeGreaterThanOrEqual(1); // o soldado inicial basta (grupo de até 3)
  });
  it('o custo de reerguer (madeira 80, pedra 20) cabe no que o jogador tem ao começar', () => {
    expect(QG.custoReerguer).toEqual({ madeira: 80, pedra: 20 });
    for (const [r, v] of Object.entries(QG.custoReerguer)) expect(v).toBeLessThanOrEqual((ESTADO_INICIAL_CICLO.recursos as Record<string, number>)[r]!);
    expect(QG.dicaDoSabioAposMs).toBe(8 * MIN);
  });
});

describe('descoberta: concluir a expedição sempre revela as Ruínas', () => {
  it('começa oculto e o destino está aberto', () => {
    const e = novo();
    expect(e.qg).toEqual({ estado: 'oculto', desde: T0 });
    expect(destinoAberto(e, DESTINO_QG)).toBe(true);
    expect(destinoVisivel(e, DESTINO_QG)).toBe(true);
  });

  for (const vitoria of [true, false]) {
    it(`${vitoria ? 'vitória' : 'recuo'}: as Ruínas aparecem, o destino some e o saque só vale na vitória`, () => {
      let e = partir(novo());
      expect(e.qg.estado).toBe('oculto');
      forcar(e, vitoria);
      const fim = e.expedicoes[0]!.fim;
      const antes = liquidar(e, fim - 1);
      expect(antes.qg.estado).toBe('oculto'); // ainda a caminho
      expect(destinoVisivel(antes, DESTINO_QG)).toBe(true);
      e = liquidar(e, fim + 1);
      expect(e.qg).toEqual({ estado: 'ruinas', desde: fim });
      expect(destinoVisivel(e, DESTINO_QG)).toBe(false);
      expect(destinoAberto(e, DESTINO_QG)).toBe(false);
      if (vitoria) {
        expect(textos(e)).toContain(TEXTOS_QG.descobertaCronica);
        expect(e.relatorios.at(-1)).toMatchObject({ destino: DESTINO_QG, vitoria: true });
        expect(e.recursos.pedra).toBeGreaterThan(micro(ESTADO_INICIAL_CICLO.recursos.pedra));
      } else {
        expect(textos(e)).toContain(TEXTOS_QG.recuoComDescoberta);
        expect(e.relatorios.at(-1)).toMatchObject({ destino: DESTINO_QG, vitoria: false, saque: {} });
        expect(e.recursos.pedra).toBe(micro(ESTADO_INICIAL_CICLO.recursos.pedra));
      }
    });
  }

  it('o sorteio real (sem forçar) também revela, qualquer que seja o resultado', () => {
    for (let semente = 1; semente <= 40; semente++) {
      const e0 = estadoInicial({ semente, agora: T0 });
      e0.segredo.proximoEventoEm = T0 + 10 ** 9;
      const e = liquidar(partir(e0), T0 + 41_000);
      expect(e.qg.estado, `semente ${semente}`).toBe('ruinas');
    }
  });

  it('dois grupos ao mesmo tempo: o segundo é recusado, e depois de descoberto ninguém mais parte para lá', () => {
    let e = novo();
    e = ok(e, { tipo: 'contratar' }, T0);
    const [a, b] = e.aventureiros.map((x) => x.id) as [string, string];
    e = ok(e, { tipo: 'partir_expedicao', destino: DESTINO_QG, grupo: [a] }, T0);
    const segundo = aplicarAcao(e, { tipo: 'partir_expedicao', destino: DESTINO_QG, grupo: [b] }, T0);
    expect(segundo.ok ? 'ok' : segundo.erro).toBe('destino_bloqueado');
    e = liquidar(e, T0 + 41_000);
    const terceiro = aplicarAcao(e, { tipo: 'partir_expedicao', destino: DESTINO_QG, grupo: [b] }, e.t);
    expect(terceiro.ok ? 'ok' : terceiro.erro).toBe('destino_bloqueado');
  });
});

describe('reerguer o Quartel General', () => {
  const descoberto = () => liquidar(partir(novo()), T0 + 41_000);
  const reerguer: Acao = { tipo: 'reerguer_qg' };

  it('antes de descobrir não dá: qg_indisponivel, sem cobrar', () => {
    const e = novo();
    const r = aplicarAcao(e, reerguer, T0);
    expect(r.ok ? 'ok' : r.erro).toBe('qg_indisponivel');
    expect(r.estado.recursos.madeira).toBe(e.recursos.madeira);
  });

  it('sem recursos: recursos_insuficientes, nada é cobrado e o estado segue em ruinas', () => {
    const e = descoberto();
    e.recursos.madeira = micro(79);
    const antes = structuredClone(e.recursos);
    const r = aplicarAcao(e, reerguer, e.t);
    expect(r.ok ? 'ok' : r.erro).toBe('recursos_insuficientes');
    expect(r.estado.qg.estado).toBe('ruinas');
    expect(r.estado.recursos.pedra).toBe(antes.pedra);
    e.recursos.madeira = micro(500);
    e.recursos.pedra = micro(19);
    expect(aplicarAcao(e, reerguer, e.t).ok).toBe(false);
  });

  it('com recursos: cobra madeira 80 e pedra 20, passa a reerguido e escreve na Crônica', () => {
    const e = descoberto();
    e.recursos.madeira = micro(200);
    e.recursos.pedra = micro(60);
    const r = aplicarAcao(e, reerguer, e.t);
    expect(r.ok).toBe(true);
    expect(r.estado.qg).toEqual({ estado: 'reerguido', desde: e.t });
    expect(r.estado.recursos.madeira).toBe(micro(120));
    expect(r.estado.recursos.pedra).toBe(micro(40));
    expect(textos(r.estado)).toContain(TEXTOS_QG.reerguidoCronica);
    expect(qgReerguido(r.estado)).toBe(true);
  });

  it('reerguer duas vezes não cobra duas', () => {
    const e = descoberto();
    e.recursos.madeira = micro(300);
    e.recursos.pedra = micro(100);
    const um = ok(e, reerguer, e.t);
    const dois = aplicarAcao(um, reerguer, um.t);
    expect(dois.ok ? 'ok' : dois.erro).toBe('qg_indisponivel');
    expect(dois.estado.recursos.madeira).toBe(um.recursos.madeira);
    expect(dois.estado.recursos.pedra).toBe(um.recursos.pedra);
  });
});

describe('estado persistente (esquema 10)', () => {
  it('versão 10 e o campo qg é estrito', () => {
    expect(VERSAO_ESQUEMA).toBe(10);
    const e = novo();
    expect(() => validarEstado({ ...e, qg: { estado: 'oculto', desde: T0, extra: 1 } })).toThrow();
    expect(() => validarEstado({ ...e, qg: { estado: 'destruido', desde: T0 } })).toThrow();
    const sem: Record<string, unknown> = { ...e };
    delete sem.qg;
    expect(() => validarEstado(sem)).toThrow();
  });

  it('migração 9 para 10: o save antigo ganha qg oculto, desde o instante do save, e nada mais muda', () => {
    const atual = liquidar(novo(), T0 + 5 * MIN);
    const { qg: _qg, ...v9 } = { ...atual, versao: 9 };
    const m = migrarEstado(JSON.parse(JSON.stringify(v9)), 9);
    expect(m.versao).toBe(10);
    const c = carregarEstado(JSON.parse(JSON.stringify(v9)), 9);
    expect(c).toEqual({ ...atual, versao: 10, qg: { estado: 'oculto', desde: atual.t } });
    // Idempotente: ler o que já está no 10 não muda nada.
    expect(carregarEstado(JSON.parse(JSON.stringify(c)), 10)).toEqual(c);
  });

  it('um save de qualquer esquema antigo chega ao 10 com o QG oculto', () => {
    const atual = novo();
    const { qg: _q, diario: _d, prologoVisto: _p, falha: _f, ...v6 } = { ...atual, versao: 6 };
    const c = carregarEstado(JSON.parse(JSON.stringify(v6)), 6);
    expect(c.versao).toBe(10);
    expect(c.qg.estado).toBe('oculto');
  });

  it('o QG atravessa a ascensão (reerguido continua reerguido, com o mesmo desde)', () => {
    const e = novo();
    e.qg = { estado: 'reerguido', desde: T0 + 3 * MIN };
    e.pesquisas.concluidas.push('carta_real');
    e.objetivos.criptaVencida = true;
    e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' as const }));
    const r = aplicarAcao(e, { tipo: 'ascender' }, T0 + 5 * MIN);
    expect(r.ok).toBe(true);
    expect(r.estado.ciclo).toBe(2);
    expect(r.estado.qg).toEqual({ estado: 'reerguido', desde: T0 + 3 * MIN });
    // Ruínas descobertas também passam.
    const f = { ...e, qg: { estado: 'ruinas' as const, desde: T0 + MIN } };
    expect(aplicarAcao(f, { tipo: 'ascender' }, T0 + 5 * MIN).estado.qg.estado).toBe('ruinas');
  });

  it('o cliente vê o qg (nada de secreto nele)', () => {
    expect(visaoDoCliente(novo()).qg).toEqual({ estado: 'oculto', desde: T0 });
  });
});

describe('Diário e dica do Sábio', () => {
  it('o capítulo "O que o exército deixou" abre ao descobrir, depois de "Os livros do Sábio", com o texto aprovado', () => {
    expect(CAPITULOS_IDS.indexOf('quartel_general')).toBe(CAPITULOS_IDS.indexOf('scriptorium') + 1);
    expect(CAPITULOS.quartel_general.titulo).toBe('O que o exército deixou');
    expect(CAPITULOS.quartel_general.texto).toBe(
      'Entre as pedras caídas, o Cronarca achou brasões de um exército que ninguém lembra de ter visto marchar. Um canto das ruínas ainda tem teto. Talvez dê para reerguer o que foi deixado.',
    );
    expect(CAPITULOS.quartel_general.dica).toBe('Explore as pedras do norte.');
    const antes = liquidar(partir(novo()), T0 + 39_000);
    expect(antes.diario).not.toContain('quartel_general');
    const depois = liquidar(antes, T0 + 41_000);
    expect(depois.diario).toContain('quartel_general');
    expect(textos(depois)).toContain('Nova página no Diário: O que o exército deixou.');
    // Só uma vez.
    expect(liquidar(depois, T0 + 60_000).diario.filter((c) => c === 'quartel_general')).toHaveLength(1);
  });

  it('o Sábio fala depois de 8 minutos com o QG oculto, e para quando as Ruínas são descobertas', () => {
    const e = novo();
    const dica = `O Sábio diz: ${TEXTOS_QG.dicaDoSabio.charAt(0).toLowerCase()}${TEXTOS_QG.dicaDoSabio.slice(1)}`;
    expect(proximoPasso({ ...visaoDoCliente(e), t: T0 + 7 * MIN + 59_000 }).sabio).not.toBe(dica);
    expect(proximoPasso({ ...visaoDoCliente(e), t: T0 + 8 * MIN }).sabio).toBe(dica);
    const descoberto = { ...visaoDoCliente(e), t: T0 + 20 * MIN, qg: { estado: 'ruinas' as const, desde: T0 + 10 * MIN } };
    expect(proximoPasso(descoberto).sabio).not.toBe(dica);
  });
});

describe('mapa: o ponto de interesse do Quartel General', () => {
  const ponto = META_MAPA.pontosDeInteresse[0]!;
  it('está no tile 65,28, coincide com o destino e tem a caixa livre de clicáveis, núcleo e outros destinos', () => {
    expect(ponto).toEqual({ id: PONTO_QG, destino: DESTINO_QG, tile: [65, 28], x: 2096, y: 912 });
    expect(META_MAPA.destinos[DESTINO_QG]).toEqual({ tipo: 'expedicao', tile: [65, 28], x: 2096, y: 912 });
    expect(MAPA.pontosDeInteresse).toEqual([{ id: PONTO_QG, destino: DESTINO_QG, x: 2096, y: 912 }]);
    expect(MAPA.destinos.map((d) => d.id)).toEqual(DESTINOS_IDS);
  });

  it('o esquema recusa um ponto que não coincide com o destino, que cai sobre uma árvore ou que está no núcleo', () => {
    const base = JSON.parse(JSON.stringify(META_MAPA));
    const tenta = (mexer: (m: any) => void) => {
      const m = JSON.parse(JSON.stringify(base));
      mexer(m);
      return esquemaMetaMapa.safeParse(m);
    };
    expect(tenta(() => {}).success).toBe(true);
    expect(tenta((m) => { m.pontosDeInteresse[0].x += 32; }).success).toBe(false); // não coincide com o destino
    const arvore = base.clicaveis.find((c: any) => c.tipo === 'arvore');
    expect(
      tenta((m) => {
        for (const o of [m.pontosDeInteresse[0], m.destinos[DESTINO_QG]]) { o.x = arvore.x; o.y = arvore.y - Math.floor(arvore.h / 2); }
      }).success,
    ).toBe(false); // em cima de uma árvore clicável
    expect(
      tenta((m) => {
        const { x0, y0 } = m.nucleo;
        for (const o of [m.pontosDeInteresse[0], m.destinos[DESTINO_QG]]) { o.x = x0 + 64; o.y = y0 + 64; }
      }).success,
    ).toBe(false); // dentro do núcleo
    expect(tenta((m) => { m.pontosDeInteresse = []; }).success).toBe(false);
  });
});
