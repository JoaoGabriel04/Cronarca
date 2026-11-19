// Bug 2 (HUD oscilando): cliques rápidos com latência e jitter contra um servidor falso que usa o aplicarAcao REAL.
// A madeira exibida (previsão liquidada até o relógio estimado) nunca pode diminuir por causa dos cliques já
// mostrados e deve convergir ao valor do servidor quando a fila esvazia.
import { aplicarAcao, estadoInicial, FORMULAS, preverAcao, visaoDoCliente, type Acao, type EstadoJogo, type PesquisaId } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { Sincronizador, type CorpoEstado, type Transporte } from '../lib/jogo/sincronia';

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const OBJ = { arvore_1: 'madeira', arvore_2: 'madeira', arvore_3: 'madeira' } as const;
const micro = () => new Promise((r) => setTimeout(r, 0));

interface Opcoes {
  latenciaMs: number;
  cliquesPorS: number;
  duracaoS: number;
  jitter?: number;
  semente?: number;
  objetos?: string[];
  /** Pesquisas concluídas e Mãos Calejadas do servidor (GPC maior que 1) e Armazém alto para o teto não mascarar. */
  concluidas?: PesquisaId[];
  maos?: number;
}

async function simular(op: Opcoes) {
  let rnd = ((op.semente ?? 1) * 2654435761) % 2 ** 32;
  const sorte = () => (rnd = (rnd * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const lat = () => op.latenciaMs * (1 + (op.jitter ?? 0) * (sorte() * 2 - 1));

  let local = T0;
  const tarefas: { em: number; fn: () => void; id: number }[] = [];
  let id = 1;
  const servidor: { e: EstadoJogo; rev: number } = { e: estadoInicial({ semente: 42, agora: T0 }), rev: 1 };
  servidor.e.segredo.proximoEventoEm = T0 + 10 ** 9;
  if (op.concluidas || op.maos) {
    servidor.e.pesquisas.concluidas = op.concluidas ?? [];
    if (op.maos) servidor.e.reliquias.niveis.maos_calejadas = op.maos;
    servidor.e.slots.armazem_1.nivel = 6;
  }
  let aceitos = 0;
  const corpo = (): CorpoEstado => ({ estado: visaoDoCliente(servidor.e), rev: servidor.rev, agora: local });
  const agendar = (fn: () => void, ms: number) => {
    const i = id++;
    tarefas.push({ em: local + ms, fn, id: i });
    return i;
  };
  const transporte: Transporte = (c, sinal) =>
    new Promise((ok, falha) => {
      sinal.addEventListener('abort', () => falha(new Error('abortado')));
      const ida = lat() / 2;
      const volta = lat() / 2;
      agendar(() => {
        let status = 200;
        let extra: Record<string, unknown> = {};
        if (c.revEsperada !== servidor.rev) status = 409;
        else {
          const r = aplicarAcao(servidor.e, { tipo: c.tipo, ...c.dados } as Acao, local, { objetosDoMapa: OBJ });
          if (r.ok) {
            servidor.e = r.estado;
            servidor.rev++;
            if (r.cliquesAceitos !== undefined) {
              aceitos += r.cliquesAceitos;
              extra = { cliquesAceitos: r.cliquesAceitos };
            }
          } else status = 422;
        }
        const resposta = { status, corpo: { ...extra, ...corpo() } }; // o servidor carimba ao SAIR
        agendar(() => ok(resposta), volta);
      }, ida);
    });

  const sinc = new Sincronizador({
    transporte,
    agoraLocal: () => local,
    novaChave: (() => { let n = 0; return () => `k${++n}`; })(),
    agendar,
    cancelar: (i) => { const k = tarefas.findIndex((t) => t.id === i); if (k >= 0) tarefas.splice(k, 1); },
    objetosDoMapa: () => OBJ,
  });
  sinc.receberEstado(corpo());

  const exibida = () => sinc.exibir()!.recursos.madeira; // o que o HUD desenha
  const objetos = op.objetos ?? ['arvore_1'];
  const total = op.duracaoS * 1000;
  const intervalo = 1000 / op.cliquesPorS;
  let proximo = 0;
  let enviados = 0;
  let ultimo = exibida();
  let quedas = 0;
  let maiorQueda = 0;
  const FIM = total + 60_000; // dá tempo de a fila esvaziar
  for (let t = 0; t <= FIM; t += 20) {
    const alvo = T0 + t;
    for (;;) {
      tarefas.sort((a, b) => a.em - b.em);
      const k = tarefas[0];
      if (!k || k.em > alvo) break;
      tarefas.shift();
      local = k.em;
      k.fn();
      await micro();
    }
    local = alvo;
    while (t <= total && t >= proximo) {
      sinc.clicar(objetos[enviados % objetos.length]!);
      enviados++;
      proximo += intervalo;
    }
    await micro();
    const v = exibida();
    if (v < ultimo - 1e-9) {
      quedas++;
      maiorQueda = Math.max(maiorQueda, ultimo - v);
    }
    ultimo = v;
    if (t > total && sinc.sincronia().pendentes === 0) break;
  }
  // A madeira exibida e a do servidor, no mesmo instante, em unidades de madeira (os recursos vêm em micro).
  const noMesmoInstante = (e: EstadoJogo | { t: number }) => e;
  void noMesmoInstante;
  const servidorAgora = aplicarAcao(servidor.e, { tipo: 'clicar', objeto: 'arvore_1', quantidade: 0 } as Acao, local, { objetosDoMapa: OBJ });
  return { quedas, maiorQueda, enviados, aceitos, fimS: (local - T0) / 1000, pendentes: sinc.sincronia().pendentes, exibida: exibida(), servidor: servidorAgora.estado.recursos.madeira };
}

describe('HUD: a madeira exibida não recua com cliques rápidos', () => {
  for (const latenciaMs of [60, 250, 600]) {
    it(`10 cliques/s numa árvore por 10 s, latência de ${latenciaMs} ms`, async () => {
      const r = await simular({ latenciaMs, cliquesPorS: 10, duracaoS: 10 });
      expect(r.quedas, JSON.stringify(r)).toBe(0);
      expect(r.pendentes).toBe(0);
      // Converge ao servidor (diferença de milésimos de produção entre dois relógios de 20 ms).
      expect(Math.abs(r.exibida - r.servidor)).toBeLessThan(0.5e6);
    });
  }

  it('com jitter de 80% (150 e 400 ms), em várias rodadas, também não recua', async () => {
    for (const latenciaMs of [150, 400]) {
      for (const semente of [1, 2, 3, 4]) {
        const r = await simular({ latenciaMs, cliquesPorS: 10, duracaoS: 15, jitter: 0.8, semente });
        expect(r.quedas, `${latenciaMs} ms, semente ${semente}: ${JSON.stringify(r)}`).toBe(0);
      }
    }
    // 8 simulações de 15 s: ~75% do tempo é o `await micro()` do próprio teste (setTimeout real, ~1,2 ms cada, ~8 mil
    // vezes); o código medido gasta ~0,25 ms por exibir() e ~1 ms por clicar(). 15 s era folga curta demais.
  }, 30_000);

  it('o teto de 5 cliques/s por objeto vale: ~55 de 101 em 10 s', async () => {
    const r = await simular({ latenciaMs: 60, cliquesPorS: 10, duracaoS: 10 });
    expect(r.aceitos).toBeGreaterThanOrEqual(54);
    expect(r.aceitos).toBeLessThanOrEqual(56);
  });

  // Balde do USUÁRIO (10/s no total) com vários objetos clicando juntos. Com 3 árvores a capacidade por objeto é
  // 3 × 5 = 15/s, acima dos 10/s do usuário: quem manda é o teto do usuário, e a previsão do cliente precisa aceitar
  // o mesmo que o servidor (senão o número recua ou o "+N" promete o que o servidor recusa).
  it('previsão e servidor aceitam o mesmo no balde do usuário: 3 objetos no mesmo instante e depois de meio segundo', () => {
    let servidor = estadoInicial({ semente: 42, agora: T0 });
    let cliente = visaoDoCliente(servidor);
    const passo = (objeto: string, quantidade: number, agora: number) => {
      const acao = { tipo: 'clicar', objeto, quantidade } as const;
      const s = aplicarAcao(servidor, acao, agora, { objetosDoMapa: OBJ });
      const c = preverAcao(cliente, acao, agora, { objetosDoMapa: OBJ });
      expect(c.ok, `${objeto} em +${agora - T0} ms`).toBe(s.ok);
      if (s.ok && c.ok) {
        expect(c.cliquesAceitos).toBe(s.cliquesAceitos);
        servidor = s.estado;
        cliente = c.estado;
        return s.cliquesAceitos;
      }
      if (!s.ok && !c.ok) expect(c.erro).toBe(s.erro);
      return 0;
    };
    const U = FORMULAS.clique.porSegundoUsuario;
    const O = FORMULAS.clique.porSegundoObjeto;
    expect(O * 3).toBeGreaterThan(U); // o cenário só vale se o balde do usuário for o primeiro a esgotar
    expect(passo('arvore_1', 20, T0)).toBe(O);
    expect(passo('arvore_2', 20, T0)).toBe(O);
    expect(passo('arvore_3', 20, T0)).toBe(0); // usuário esgotado (U = 2 × O): recusa igual nos dois lados
    // Meio segundo depois o usuário recuperou U / 2 fichas; o objeto 3 está cheio (O), então rende U / 2.
    expect(passo('arvore_3', 20, T0 + 500)).toBe(U / 2);
    expect(cliente.recursos.madeira).toBe(servidor.recursos.madeira);
  });

  for (const latenciaMs of [60, 250]) {
    it(`10/s por usuário com 3 objetos a 10 cliques/s cada, latência de ${latenciaMs} ms: aceita só o balde, sem queda, converge`, async () => {
      const duracaoS = 4;
      const r = await simular({ latenciaMs, cliquesPorS: 30, duracaoS, objetos: ['arvore_1', 'arvore_2', 'arvore_3'] });
      const U = FORMULAS.clique.porSegundoUsuario;
      // Com as árvores alternando, cada clique vira um pedido e a fila escoa DEPOIS dos cliques (fimS > duracaoS): o balde
      // do usuário recarrega U por segundo durante todo esse tempo. Teto = balde cheio no início (U) + U × fimS.
      expect(r.fimS).toBeGreaterThan(duracaoS);
      const maximo = U + U * r.fimS;
      expect(r.enviados).toBeGreaterThan(duracaoS * 25); // o jogador clicou muito mais do que o balde permite
      expect(r.aceitos).toBeLessThanOrEqual(maximo);
      // Com latência baixa a fila escoa logo e o balde recusa parte dos cliques. Com latência alta (250 ms) a fila leva
      // ~30 s para escoar, o balde recarrega nesse tempo e o servidor aceita tudo: o teto é de TEMPO, não de clique.
      if (latenciaMs <= 60) expect(r.aceitos).toBeLessThan(r.enviados);
      expect(r.aceitos).toBeGreaterThanOrEqual(U * duracaoS); // e o balde foi aproveitado (não recusou à toa)
      expect(r.quedas, JSON.stringify(r)).toBe(0);
      expect(r.pendentes).toBe(0);
      expect(Math.abs(r.exibida - r.servidor)).toBeLessThan(0.5e6);
    }, 30_000);
  }

  // GPC maior que 1 (esquema 12): o cliente prevê o mesmo ganho do servidor (madeira rende 3 por clique aceito).
  for (const latenciaMs of [60, 250, 600]) {
    it(`GPC 3 (coletor I e II) e Mãos Calejadas 4, latência de ${latenciaMs} ms: sem queda e converge ao servidor`, async () => {
      const r = await simular({ latenciaMs, cliquesPorS: 10, duracaoS: 10, concluidas: ['coletor_1', 'coletor_2'], maos: 4 });
      expect(r.quedas, JSON.stringify(r)).toBe(0);
      expect(r.pendentes).toBe(0);
      expect(Math.abs(r.exibida - r.servidor)).toBeLessThan(0.5e6);
      // 4 por clique aceito (3 das pesquisas + 1 das relíquias, aditivas): o servidor ganhou bem mais que sem pesquisa.
      expect(r.servidor).toBeGreaterThan(r.aceitos * 4e6 * 0.99);
    });
  }
});
