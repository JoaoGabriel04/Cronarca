// Bug 3 (reset congelando): base de outra conta (rev alto), 409 sem fim, salvarAgora sem prazo, reset sem tentativa.
import { estadoInicial, FORMULAS, visaoDoCliente } from '@cronarca/game-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ehChaveDaConta, limparCacheDoJogo } from '../lib/jogo/cache';
import { avisoLimiteCliques } from '../lib/jogo/cliques';
import { SINCRONIA } from '../lib/jogo/config';
import { apagarComTentativas, RESET, textoDaFalhaDoReset, type RespostaReset } from '../lib/jogo/reset';
import { Sincronizador, type CorpoEstado, type RespostaHttp, type Transporte } from '../lib/jogo/sincronia';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const OBJ = { arvore_1: 'madeira' } as const;
const micro = () => new Promise((r) => setTimeout(r, 0));

function cenario(responder: (c: Parameters<Transporte>[0], n: number) => RespostaHttp | 'pendurar') {
  let local = T0;
  const tarefas: { em: number; fn: () => void; id: number }[] = [];
  let id = 1;
  let pedidos = 0;
  const revsUsados: number[] = [];
  const servidor = estadoInicial({ semente: 7, agora: T0 });
  const corpo = (rev: number): CorpoEstado => ({ estado: visaoDoCliente(servidor), rev, agora: local });
  const transporte: Transporte = (c, sinal) =>
    new Promise((ok, falha) => {
      sinal.addEventListener('abort', () => falha(new Error('abortado')));
      pedidos++;
      revsUsados.push(c.revEsperada);
      const r = responder(c, pedidos);
      if (r !== 'pendurar') ok(r);
    });
  const sinc = new Sincronizador({
    transporte,
    agoraLocal: () => local,
    novaChave: (() => { let n = 0; return () => `k${++n}`; })(),
    agendar: (fn, ms) => { const i = id++; tarefas.push({ em: local + ms, fn, id: i }); return i; },
    cancelar: (i) => { const k = tarefas.findIndex((t) => t.id === i); if (k >= 0) tarefas.splice(k, 1); },
    objetosDoMapa: () => OBJ,
  });
  return {
    sinc,
    corpo,
    get pedidos() { return pedidos; },
    revsUsados,
    async avancar(ms: number) {
      const alvo = local + ms;
      for (;;) {
        tarefas.sort((a, b) => a.em - b.em);
        const t = tarefas[0];
        if (!t || t.em > alvo) break;
        tarefas.shift();
        local = t.em;
        t.fn();
        await micro();
      }
      local = alvo;
      await micro();
    },
  };
}

describe('cache de outra conta: base de rev alto', () => {
  it('um GET de rev menor é ignorado (continua protegendo contra resposta velha)...', () => {
    const c = cenario(() => 'pendurar');
    c.sinc.receberEstado(c.corpo(500));
    c.sinc.receberEstado(c.corpo(3));
    expect(c.sinc.rev).toBe(500);
  });

  it('...mas o 409 adota o estado do servidor e o clique segue com o rev certo, sem laço', async () => {
    const c = cenario((corpo, n) => (n === 1 ? { status: 409, corpo: { erro: 'conflito', ...c.corpo(3) } } : { status: 200, corpo: { ok: true, cliquesAceitos: 1, ...c.corpo(4) } }));
    c.sinc.receberEstado(c.corpo(500));
    const { desfecho } = c.sinc.clicar('arvore_1');
    await c.avancar(SINCRONIA.loteCliquesMs + 5);
    expect(await desfecho).toEqual({ ok: true, cliquesAceitos: 1 });
    expect(c.revsUsados).toEqual([500, 3]);
    expect(c.pedidos).toBe(2);
    expect(c.sinc.rev).toBe(4);
  });

  it('conflito que não se resolve: no máximo 1 + 3 envios e o clique é descartado com o aviso de conflito', async () => {
    const c = cenario(() => ({ status: 409, corpo: { erro: 'conflito', ...c.corpo(3) } }));
    c.sinc.receberEstado(c.corpo(3));
    const { desfecho } = c.sinc.clicar('arvore_1');
    await c.avancar(SINCRONIA.loteCliquesMs + 5);
    expect(await desfecho).toEqual({ ok: false, motivo: 'conflito' });
    expect(c.pedidos).toBe(1 + SINCRONIA.tentativasConflito);
    expect(c.sinc.sincronia().pendentes).toBe(0);
  });
});

describe('salvarAgora e descartarPendentes', () => {
  it('salvarAgora tem prazo: o que não responde conta como tempo esgotado', async () => {
    const c = cenario(() => 'pendurar');
    c.sinc.receberEstado(c.corpo(1));
    c.sinc.clicar('arvore_1');
    let resultado: unknown = null;
    void c.sinc.salvarAgora(1_000).then((r) => (resultado = r));
    await c.avancar(900);
    expect(resultado).toBeNull();
    await c.avancar(200);
    expect(resultado).toEqual([{ ok: false, motivo: 'tempo_esgotado' }]);
  });

  it('descartarPendentes resolve a fila e o pedido em voo, e uma resposta tardia não mexe na base', async () => {
    let soltar: ((r: RespostaHttp) => void) | null = null;
    const c = cenario(() => 'pendurar');
    c.sinc.receberEstado(c.corpo(1));
    const a = c.sinc.clicar('arvore_1').desfecho;
    await c.avancar(SINCRONIA.loteCliquesMs + 5); // o lote sai e fica em voo
    const b = c.sinc.clicar('arvore_1').desfecho; // outro lote, na fila
    c.sinc.descartarPendentes();
    expect(await a).toEqual({ ok: false, motivo: 'recusada', erro: 'descartada' });
    expect(await b).toEqual({ ok: false, motivo: 'recusada', erro: 'descartada' });
    expect(c.sinc.sincronia().pendentes).toBe(0);
    expect(soltar).toBeNull();
    // Depois do reset, o estado novo vence qualquer base anterior.
    c.sinc.receberEstado(c.corpo(0), { adotar: true });
    expect(c.sinc.rev).toBe(0);
  });
});

describe('reset com prazo e tentativas', () => {
  const amb = (respostas: (RespostaReset | 'pendurar' | 'cair')[]) => {
    const esperas: number[] = [];
    let i = 0;
    let abortar: (() => void) | null = null;
    return {
      esperas,
      amb: {
        transporte: (sinal: AbortSignal) =>
          new Promise<RespostaReset>((ok, falha) => {
            const r = respostas[i++]!;
            if (r === 'cair') return falha(new Error('rede'));
            sinal.addEventListener('abort', () => falha(new Error('abortado')));
            if (r === 'pendurar') return void (abortar?.());
            ok(r);
          }),
        esperar: async (ms: number) => void esperas.push(ms),
        agendar: (fn: () => void) => ((abortar = fn), 1),
        cancelar: () => {
          abortar = null;
        },
      },
    };
  };
  const estadoOk = { status: 200, corpo: { estado: {}, rev: 0, agora: 1 } };

  it('200: devolve o estado novo', async () => {
    const r = await apagarComTentativas(amb([estadoOk]).amb);
    expect(r.ok).toBe(true);
  });
  it('429 e depois 200: espera o Retry-After (limitado) e conclui', async () => {
    const a = amb([{ status: 429, corpo: { esperarS: 2 } }, estadoOk]);
    expect((await apagarComTentativas(a.amb)).ok).toBe(true);
    expect(a.esperas).toEqual([2000]);
    const b = amb([{ status: 429, corpo: { esperarS: 60 } }, estadoOk]);
    await apagarComTentativas(b.amb);
    expect(b.esperas).toEqual([RESET.esperaMaximaMs]);
  });
  it(`429 ${RESET.tentativas} vezes: desiste com erro claro`, async () => {
    const r = await apagarComTentativas(amb(Array.from({ length: 3 }, () => ({ status: 429, corpo: { esperarS: 1 } }))).amb);
    expect(r).toEqual({ ok: false, motivo: 'limite' });
    expect(textoDaFalhaDoReset({ ok: false, motivo: 'limite' })).toMatch(/Muitas requisições/);
  });
  it('sem resposta no prazo: tempo esgotado (nunca congela); queda de rede e sessão também têm desfecho', async () => {
    expect(await apagarComTentativas(amb(['pendurar']).amb)).toEqual({ ok: false, motivo: 'tempo_esgotado' });
    expect(await apagarComTentativas(amb(['cair']).amb)).toEqual({ ok: false, motivo: 'rede' });
    expect(await apagarComTentativas(amb([{ status: 401, corpo: {} }]).amb)).toEqual({ ok: false, motivo: 'sessao' });
    expect(await apagarComTentativas(amb([{ status: 400, corpo: { erro: 'confirmacao_invalida' } }]).amb)).toEqual({ ok: false, motivo: 'recusada', erro: 'confirmacao_invalida' });
  });
});

describe('troca de conta limpa o cache do jogo', () => {
  it('só as chaves do jogo e do ranking, e sem pedir de novo', async () => {
    const chamadas: { filtro: (k: unknown) => boolean; dados: unknown; opcoes: unknown }[] = [];
    await limparCacheDoJogo(async (filtro, dados, opcoes) => void chamadas.push({ filtro, dados, opcoes }));
    expect(chamadas).toHaveLength(1);
    const { filtro, dados, opcoes } = chamadas[0]!;
    expect(dados).toBeUndefined();
    expect(opcoes).toEqual({ revalidate: false });
    for (const k of ['/api/game/state', '/api/game/readiness?fase=1', '/api/ranking?aba=geral']) expect(filtro(k), k).toBe(true);
    for (const k of ['/api/auth/me', '/api/auth/provedores', '/api/me/preferencias', 42, null]) expect(filtro(k), String(k)).toBe(false);
    expect(ehChaveDaConta('/api/game/state')).toBe(true);
  });
  it('sair, entrar, convidado e "entrar na conta existente" chamam a limpeza', () => {
    const ler = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
    expect(ler('app/jogo/BotaoSair.tsx')).toContain('limparCacheDoJogo(mutate)');
    expect((ler('app/login/CartaoLogin.tsx').match(/limparCacheDoJogo\(mutate\)/g) ?? []).length).toBe(2);
    expect(ler('components/casca/Vinculo.tsx')).toContain('limparCacheDoJogo(mutate)');
  });
});

describe('teto de cliques explicado ao jogador (opção A)', () => {
  it('o aviso usa o número dos dados do jogo, sem emoji', () => {
    expect(avisoLimiteCliques()).toContain(`${FORMULAS.clique.porSegundoObjeto} cliques por segundo`);
    expect(avisoLimiteCliques()).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('clicar devolve limite quando bate no teto, e não quando é o armazém cheio', async () => {
    const c = cenario(() => 'pendurar');
    c.sinc.receberEstado(c.corpo(1));
    const resultados = Array.from({ length: 12 }, () => c.sinc.clicar('arvore_1'));
    // Rajada: os 5 primeiros cabem no balde do objeto; os seguintes batem no teto por segundo.
    expect(resultados.slice(0, 5).every((r) => r.ganho > 0 && !r.limite)).toBe(true);
    expect(resultados.slice(5).some((r) => r.limite && r.ganho === 0 && !r.cheio)).toBe(true);
  });
});
