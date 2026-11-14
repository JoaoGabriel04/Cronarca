import { aplicarAcao, estadoInicial, tetos, visaoDoCliente, type Acao, type EstadoJogo } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { SINCRONIA } from '../lib/jogo/config';
import { Sincronizador, type CorpoEstado, type RespostaHttp, type Transporte } from '../lib/jogo/sincronia';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const OBJETOS = { arvore_1: 'madeira', pedra_1: 'pedra' } as const;

/** Servidor de mentira: guarda os pedidos e responde quando o teste mandar. */
function cenario(op: { servidorAplica?: boolean } = {}) {
  let local = T0;
  const tarefas: { em: number; fn: () => void; id: number }[] = [];
  let proximoId = 1;
  const pedidos: { corpo: Parameters<Transporte>[0]; sinal: AbortSignal; responder: (r: RespostaHttp) => void; falhar: () => void }[] = [];
  let chaves = 0;
  // Estado "do servidor" (com segredo), para respostas realistas.
  let servidor: EstadoJogo = estadoInicial({ semente: 42, agora: T0 });
  servidor.segredo.proximoEventoEm = T0 + 10 ** 9;
  let rev = 1;
  const corpo = (): CorpoEstado => ({ estado: visaoDoCliente(servidor), rev, agora: local });

  const transporte: Transporte = (c, sinal) =>
    new Promise((responder, falhar) => {
      const p = { corpo: c, sinal, responder, falhar: () => falhar(new Error('rede')) };
      sinal.addEventListener('abort', () => falhar(new Error('abortado')));
      pedidos.push(p);
    });

  const sinc = new Sincronizador({
    transporte,
    agoraLocal: () => local,
    novaChave: () => `chave-${++chaves}`,
    agendar: (fn, ms) => {
      const id = proximoId++;
      tarefas.push({ em: local + ms, fn, id });
      return id;
    },
    cancelar: (id) => {
      const i = tarefas.findIndex((t) => t.id === id);
      if (i >= 0) tarefas.splice(i, 1);
    },
    objetosDoMapa: () => OBJETOS,
  });
  sinc.receberEstado(corpo());

  const microtarefas = () => new Promise((r) => setTimeout(r, 0));
  return {
    sinc,
    pedidos,
    get servidor() {
      return servidor;
    },
    /** Avança o relógio local, rodando os temporizadores vencidos. */
    async avancar(ms: number) {
      const alvo = local + ms;
      for (;;) {
        tarefas.sort((a, b) => a.em - b.em);
        const t = tarefas[0];
        if (!t || t.em > alvo) break;
        tarefas.shift();
        local = t.em;
        t.fn();
        await microtarefas();
      }
      local = alvo;
      await microtarefas();
    },
    /** Responde o pedido k aplicando a ação no estado do servidor (200 ou 422). */
    async aplicar(k: number) {
      const p = pedidos[k]!;
      const acao = { tipo: p.corpo.tipo, ...p.corpo.dados } as Acao;
      const r = aplicarAcao(servidor, acao, local, { objetosDoMapa: OBJETOS });
      if (r.ok && op.servidorAplica !== false) {
        servidor = r.estado;
        rev++;
      }
      p.responder({ status: r.ok ? 200 : 422, corpo: { ...(r.ok ? { ok: true, cliquesAceitos: r.cliquesAceitos } : { ok: false, erro: r.erro }), ...corpo() } });
      await microtarefas();
    },
    async responder(k: number, status: number, extra: Record<string, unknown> = {}) {
      pedidos[k]!.responder({ status, corpo: { ...extra, ...corpo() } });
      await microtarefas();
    },
    /** Muda o estado do servidor por fora (outra aba), sem o cliente saber. */
    mudarPorFora(f: (e: EstadoJogo) => void) {
      f(servidor);
      rev++;
    },
    corpo,
  };
}

const madeira = (s: Sincronizador) => s.estado()!.recursos.madeira;

describe('sincronização: ações previstas', () => {
  it('cliques no mesmo objeto em 250 ms viram um lote só; a tela muda na hora, antes da resposta', async () => {
    const c = cenario();
    const antes = madeira(c.sinc);
    const a = c.sinc.clicar('arvore_1');
    c.sinc.clicar('arvore_1');
    c.sinc.clicar('arvore_1');
    expect(a.ganho).toBeGreaterThan(0);
    expect(madeira(c.sinc)).toBeGreaterThan(antes);
    expect(c.pedidos).toHaveLength(0); // lote ainda aberto
    await c.avancar(SINCRONIA.loteCliquesMs);
    expect(c.pedidos).toHaveLength(1);
    expect(c.pedidos[0]!.corpo).toMatchObject({ tipo: 'clicar', dados: { objeto: 'arvore_1', quantidade: 3 }, revEsperada: 1 });
    await c.aplicar(0);
    expect(await a.desfecho).toEqual({ ok: true, cliquesAceitos: 3 });
    expect(c.sinc.rev).toBe(2);
    expect(c.sinc.estado()).toEqual(visaoDoCliente(c.servidor)); // a base é a do servidor
  });

  it('recurso no teto do armazém: o clique não rende e avisa "cheio" (e vai ao servidor do mesmo jeito)', async () => {
    const c = cenario();
    c.mudarPorFora((e) => (e.recursos.madeira = tetos(e).madeira));
    c.sinc.receberEstado(c.corpo());
    const r = c.sinc.clicar('arvore_1');
    expect(r).toMatchObject({ ganho: 0, cheio: true });
    const p = c.sinc.clicar('pedra_1');
    expect(p.cheio).toBe(false);
    expect(p.ganho).toBeGreaterThan(0);
    await c.avancar(SINCRONIA.loteCliquesMs);
    expect(c.pedidos[0]!.corpo).toMatchObject({ tipo: 'clicar', dados: { objeto: 'arvore_1' } });
  });

  it('construção produtora (serraria) também é clicável: prevê o ganho e vai ao servidor', async () => {
    const c = cenario();
    c.mudarPorFora((e) => (e.recursos.madeira = 0));
    c.sinc.receberEstado(c.corpo());
    const r = c.sinc.clicar('serraria_1');
    expect(r.ganho).toBeGreaterThan(0);
    expect(r.cheio).toBe(false);
    await c.avancar(SINCRONIA.loteCliquesMs);
    expect(c.pedidos[0]!.corpo).toMatchObject({ tipo: 'clicar', dados: { objeto: 'serraria_1', quantidade: 1 } });
    await c.aplicar(0);
    expect(await r.desfecho).toMatchObject({ ok: true, cliquesAceitos: 1 });
  });

  it('uma por vez: a segunda espera a primeira e usa o rev novo', async () => {
    const c = cenario();
    c.sinc.clicar('arvore_1');
    const d2 = c.sinc.clicar('pedra_1').desfecho;
    await c.avancar(SINCRONIA.loteCliquesMs);
    expect(c.pedidos).toHaveLength(1);
    await c.aplicar(0);
    expect(c.pedidos).toHaveLength(2);
    expect(c.pedidos[1]!.corpo).toMatchObject({ dados: { objeto: 'pedra_1' }, revEsperada: 2 });
    await c.aplicar(1);
    expect((await d2).ok).toBe(true);
  });

  it('422: o valor previsto é desfeito e o desfecho diz recusada', async () => {
    const c = cenario({ servidorAplica: false });
    const antes = madeira(c.sinc);
    const { desfecho } = c.sinc.clicar('arvore_1');
    expect(madeira(c.sinc)).toBeGreaterThan(antes);
    await c.avancar(SINCRONIA.loteCliquesMs);
    await c.responder(0, 422, { ok: false, erro: 'limite_cliques' });
    expect(await desfecho).toMatchObject({ ok: false, motivo: 'recusada', erro: 'limite_cliques' });
    expect(madeira(c.sinc)).toBe(antes);
  });

  it('409 em ação prevista: rebaseia no estado novo e reenvia com a mesma chave', async () => {
    const c = cenario();
    const { desfecho } = c.sinc.clicar('arvore_1');
    await c.avancar(SINCRONIA.loteCliquesMs);
    c.mudarPorFora((e) => (e.recursos.pedra += 5000));
    await c.responder(0, 409, { erro: 'rev_desatualizada' });
    expect(c.pedidos).toHaveLength(2);
    expect(c.pedidos[1]!.corpo.idempotencyKey).toBe(c.pedidos[0]!.corpo.idempotencyKey);
    expect(c.pedidos[1]!.corpo.revEsperada).toBe(2);
    await c.aplicar(1);
    expect((await desfecho).ok).toBe(true);
  });

  it('queda de rede em ação prevista: tenta de novo com a mesma chave; depois de 3 vezes desiste', async () => {
    const c = cenario();
    const { desfecho } = c.sinc.clicar('arvore_1');
    await c.avancar(SINCRONIA.loteCliquesMs);
    for (let k = 0; k < SINCRONIA.tentativasRede; k++) {
      c.pedidos[k]!.falhar();
      await c.avancar(0); // deixa o erro ser tratado (microtarefa) antes de passar o tempo
      await c.avancar(SINCRONIA.esperaRedeMs);
    }
    expect(c.pedidos).toHaveLength(SINCRONIA.tentativasRede);
    expect(new Set(c.pedidos.map((p) => p.corpo.idempotencyKey)).size).toBe(1);
    expect(await desfecho).toMatchObject({ ok: false, motivo: 'rede' });
  });

  it('429: espera o tempo pedido e reenvia a mesma chave', async () => {
    const c = cenario();
    c.sinc.clicar('arvore_1');
    await c.avancar(SINCRONIA.loteCliquesMs);
    await c.responder(0, 429, { erro: 'muitas_requisicoes', esperarS: 2 });
    await c.avancar(1999);
    expect(c.pedidos).toHaveLength(1);
    await c.avancar(1);
    expect(c.pedidos).toHaveLength(2);
    expect(c.pedidos[1]!.corpo.idempotencyKey).toBe(c.pedidos[0]!.corpo.idempotencyKey);
  });

  it('recusada já na previsão (sem recursos) não vai ao servidor', async () => {
    const c = cenario();
    expect(await c.sinc.enviar({ tipo: 'construir', slot: 'forja_1' })).toMatchObject({ ok: false, motivo: 'recusada' });
    expect(c.pedidos).toHaveLength(0);
  });
});

describe('sincronização: ações que esperam o servidor', () => {
  const partir = (c: ReturnType<typeof cenario>): Acao => ({ tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [c.servidor.aventureiros[0]!.id] });

  it('não muda a tela antes da resposta; com 200, a expedição aparece', async () => {
    const c = cenario();
    const d = c.sinc.enviar(partir(c));
    expect(c.sinc.estado()!.expedicoes).toHaveLength(0);
    expect(c.sinc.aguardandoServidor()).toBe(true);
    await c.aplicar(0);
    expect((await d).ok).toBe(true);
    expect(c.sinc.estado()!.expedicoes).toHaveLength(1);
    expect(c.sinc.aguardandoServidor()).toBe(false);
  });

  it('clique duplo: a mesma ação em andamento não sai duas vezes', async () => {
    const c = cenario();
    const d1 = c.sinc.enviar(partir(c));
    const d2 = c.sinc.enviar(partir(c));
    expect(d2).toBe(d1);
    await c.aplicar(0);
    expect(c.pedidos).toHaveLength(1);
  });

  it('sem resposta em 10 s: tempo esgotado; a nova tentativa reaproveita a chave e o servidor não aplica duas vezes', async () => {
    const c = cenario();
    const acao = partir(c);
    const d = c.sinc.enviar(acao);
    await c.avancar(SINCRONIA.tempoLimiteAcaoMs);
    const r = await d;
    expect(r).toMatchObject({ ok: false, motivo: 'tempo_esgotado' });
    expect(c.sinc.aguardandoServidor()).toBe(false); // botão destrava
    const chave = c.pedidos[0]!.corpo.idempotencyKey;
    void c.sinc.enviar(acao, { chave });
    expect(c.pedidos[1]!.corpo.idempotencyKey).toBe(chave);
  });

  it('409: recarrega o estado e avisa (conflito), sem reenviar', async () => {
    const c = cenario();
    const d = c.sinc.enviar(partir(c));
    c.mudarPorFora((e) => (e.recursos.ouro += 1000));
    await c.responder(0, 409, { erro: 'rev_desatualizada' });
    expect(await d).toMatchObject({ ok: false, motivo: 'conflito' });
    expect(c.sinc.rev).toBe(2);
    expect(c.pedidos).toHaveLength(1);
  });

  it('ascender só sai com confirmação', async () => {
    const c = cenario();
    expect(await c.sinc.enviar({ tipo: 'ascender' })).toEqual({ ok: false, motivo: 'sem_confirmacao' });
    expect(c.pedidos).toHaveLength(0);
    void c.sinc.enviar({ tipo: 'ascender' }, { confirmada: true });
    expect(c.pedidos).toHaveLength(1);
  });

  it('401: sessão expirou', async () => {
    const c = cenario();
    const d = c.sinc.enviar(partir(c));
    c.pedidos[0]!.responder({ status: 401, corpo: { erro: 'nao_autenticado' } });
    expect(await d).toMatchObject({ ok: false, motivo: 'sessao' });
  });
});

describe('sincronização: estado', () => {
  it('um estado mais velho que a base é ignorado; o relógio segue o do servidor', () => {
    const c = cenario();
    const atual = c.corpo();
    c.sinc.receberEstado({ ...atual, rev: 5, agora: atual.agora + 60_000 });
    expect(c.sinc.agora()).toBe(atual.agora + 60_000);
    c.sinc.receberEstado({ ...atual, rev: 4 });
    expect(c.sinc.rev).toBe(5);
  });
});

describe('sincronização: salvar agora', () => {
  it('fecha o lote de cliques aberto, manda na hora e resolve com a resposta', async () => {
    const c = cenario();
    c.sinc.clicar('arvore_1');
    c.sinc.clicar('arvore_1');
    expect(c.pedidos).toHaveLength(0); // lote aberto por 250 ms
    let pronto = false;
    const salvar = c.sinc.salvarAgora().then((d) => {
      pronto = true;
      return d;
    });
    await c.avancar(0);
    expect(c.pedidos).toHaveLength(1); // saiu sem esperar o lote
    expect(c.pedidos[0]!.corpo).toMatchObject({ tipo: 'clicar', dados: { objeto: 'arvore_1', quantidade: 2 } });
    expect(pronto).toBe(false);
    await c.aplicar(0);
    expect(await salvar).toEqual([{ ok: true, cliquesAceitos: 2 }]);
    expect(c.sinc.sincronia().pendentes).toBe(0);
  });

  it('sem nada na fila resolve na hora; espera de rede não é cortada', async () => {
    const c = cenario();
    expect(await c.sinc.salvarAgora()).toEqual([]);
    c.sinc.clicar('arvore_1');
    void c.sinc.salvarAgora();
    await c.avancar(0);
    c.pedidos[0]!.falhar();
    await c.avancar(0);
    void c.sinc.salvarAgora();
    await c.avancar(0);
    expect(c.pedidos).toHaveLength(1); // a nova tentativa espera o intervalo de rede
    await c.avancar(1_000);
    expect(c.pedidos).toHaveLength(2);
  });
});

describe('sincronização: ganho previsto do clique', () => {
  it('é exato mesmo com o relógio andando entre as leituras (sem "+0,998")', () => {
    let local = T0;
    // Cada leitura do relógio avança 3 ms, como no navegador entre duas chamadas.
    const sinc = new Sincronizador({
      transporte: () => new Promise(() => {}),
      agoraLocal: () => (local += 3),
      novaChave: () => 'k',
      agendar: () => 0,
      cancelar: () => {},
      objetosDoMapa: () => OBJETOS,
    });
    const servidor = estadoInicial({ semente: 42, agora: T0 });
    servidor.segredo.proximoEventoEm = T0 + 10 ** 9;
    sinc.receberEstado({ estado: visaoDoCliente(servidor), rev: 1, agora: T0 });
    // A serraria produz madeira o tempo todo: é ela que vazava para o "antes".
    // 4 cliques: abaixo do limite de 5 por segundo no mesmo objeto.
    const ganhos = Array.from({ length: 4 }, () => sinc.clicar('arvore_1').ganho);
    expect(ganhos.every((g) => g === ganhos[0])).toBe(true);
    expect(ganhos[0]! % 1_000).toBe(0); // inteiro em milésimos: nada de produção misturada
    expect(ganhos[0]).toBeGreaterThan(0);
  });
});
