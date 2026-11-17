// Cliente prediz, servidor confirma (Portão 10; handoff, Arquitetura 3, 5 e 6).
//
// O estado mostrado é o último estado do servidor com as ações ainda pendentes
// reaplicadas por cima (previsão). As ações vão uma por vez, encadeando o
// `rev`, cada uma com a sua chave de idempotência, gerada antes do primeiro
// envio e reaproveitada em toda nova tentativa. A resposta do servidor sempre
// vence: substitui a base e a fila é reaplicada sobre ela.
//
// Sem React e sem fetch: o transporte, o relógio e os temporizadores são
// injetados, para os testes controlarem tudo.

import {
  FORMULAS, precisaDoServidor, preverAcao, preverEstado, recursoDoObjeto, tetos,
  type Acao, type ErroAcao, type Recurso, type VisaoCliente,
} from '@cronarca/game-core';
import { SINCRONIA } from './config';

/** Corpo de GET /game/state e das respostas de POST /game/actions. */
export interface CorpoEstado {
  estado: VisaoCliente;
  rev: number;
  /** Relógio do servidor no instante em que a resposta saiu (ms). */
  agora: number;
  /** Ida e volta medida pelo cliente nesta resposta (ms), quando quem buscou soube medir. */
  rttMs?: number;
}

export interface RespostaHttp {
  status: number;
  corpo: unknown;
}

/** POST /game/actions; rejeita em queda de rede ou quando o sinal aborta. */
export type Transporte = (corpo: { tipo: string; dados: Record<string, unknown>; idempotencyKey: string; revEsperada: number }, sinal: AbortSignal) => Promise<RespostaHttp>;

export interface Ambiente {
  transporte: Transporte;
  /** Relógio local (Date.now). */
  agoraLocal: () => number;
  novaChave: () => string;
  agendar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
  /** Objetos clicáveis do mundo do jogador (id -> recurso), para prever cliques. */
  objetosDoMapa: () => Readonly<Record<string, Recurso>>;
}

export type Desfecho =
  | { ok: true; cliquesAceitos?: number }
  | {
      ok: false;
      motivo:
        | 'recusada' // 422 (ou recusada já na previsão)
        | 'conflito' // 409: o estado mudou; recarregado
        | 'rede' // sem resposta (queda de rede)
        | 'tempo_esgotado' // passou de 10 s
        | 'limite' // 429
        | 'sessao' // 401: sessão expirou
        | 'sem_confirmacao'; // ascender sem o passo de confirmação
      erro?: ErroAcao | string;
      esperarS?: number;
    };

interface Pedido {
  chave: string;
  acao: Acao;
  /** Prevista: entra na previsão e tenta de novo sozinha. Do servidor: espera a resposta. */
  prevista: boolean;
  /** Instante (relógio do servidor) em que o jogador agiu: a previsão aplica nele. */
  quando: number;
  /** Lote de cliques ainda aberto até este instante local. */
  loteAte: number | null;
  tentativas: number;
  /** Respostas 409 já recebidas (o reenvio por conflito tem limite). */
  conflitos: number;
  /** Descartado pelo jogador (reset): a resposta, se vier, não vale. */
  descartado?: boolean;
  resolver: (d: Desfecho) => void;
}

const corpoValido = (c: unknown): c is CorpoEstado =>
  typeof c === 'object' && c !== null && 'estado' in c && typeof (c as CorpoEstado).rev === 'number' && typeof (c as CorpoEstado).agora === 'number';

export class Sincronizador {
  private base: CorpoEstado | null = null;
  /** Servidor menos local, medido na última resposta (corrige o relógio do navegador). */
  private desvio = 0;
  private temDesvio = false;
  /** Ida e volta típica (média móvel das respostas), em ms; 0 até a primeira medida. */
  private rtt = 0;
  /** Controle do pedido em voo (para o reset poder abortá-lo). */
  private controleVoo: AbortController | null = null;
  /**
   * Piso da exibição por recurso clicado: enquanto o jogador clica, o número mostrado não recua por reconciliação
   * (o servidor gasta as fichas na chegada do pedido e a previsão no clique, e um lote a menos some da tela por um
   * instante). Some quando o jogador para de clicar, na compra de algo e ao adotar um estado do servidor.
   */
  private pisos = new Map<Recurso, number>();
  private ultimoCliquePorRecurso = new Map<Recurso, number>();
  private fila: Pedido[] = [];
  private emVoo: Pedido | null = null;
  private temporizador: unknown = null;
  private ouvintes = new Set<() => void>();
  private versao = 0;
  private cache: { versao: number; estado: VisaoCliente } | null = null;
  /** Relógio local da última resposta do servidor (para o "Salvo há"). */
  private confirmadoEm: number | null = null;
  private quedaDeRede = false;
  /** O temporizador atual só espera um lote de cliques fechar (pode ser cortado). */
  private esperaDeLote = false;

  constructor(private readonly amb: Ambiente) {}

  // ---------- leitura ----------

  /** Relógio do servidor, estimado. */
  agora(): number {
    return this.amb.agoraLocal() + this.desvio;
  }

  get rev(): number | null {
    return this.base?.rev ?? null;
  }

  /**
   * Recebe um estado do servidor (GET ou resposta de ação). Ignora um mais velho que a base, salvo `adotar`
   * (resposta 409 ou reset: o servidor acabou de dizer qual é o rev real, mesmo que seja menor que o da base,
   * como no estado guardado de outra conta).
   */
  receberEstado(corpo: CorpoEstado, op: { adotar?: boolean } = {}) {
    if (!op.adotar && this.base && corpo.rev < this.base.rev) return;
    if (op.adotar) this.limparPisos();
    this.base = corpo;
    if (corpo.rttMs !== undefined) this.registrarRtt(corpo.rttMs);
    // O servidor carimba a resposta ao sair; ela leva meia ida e volta para chegar.
    const novo = corpo.agora + this.rtt / 2 - this.amb.agoraLocal();
    // O relógio estimado nunca recua em ajustes pequenos (o HUD não pode andar para trás); salto grande vale.
    if (!this.temDesvio || novo >= this.desvio || this.desvio - novo > SINCRONIA.recuoMaximoDoRelogioMs) this.desvio = novo;
    this.temDesvio = true;
    this.confirmadoEm = this.amb.agoraLocal();
    this.quedaDeRede = false;
    this.mudou();
  }

  /**
   * Estado da base com as ações previstas pendentes reaplicadas, no instante
   * em que cada uma foi feita. Não liquida até agora: quem desenha liquida
   * com `preverEstado` no próprio ritmo.
   */
  estado(): VisaoCliente | null {
    if (!this.base) return null;
    if (this.cache?.versao === this.versao) return this.cache.estado;
    let e = this.base.estado;
    for (const p of this.todos()) {
      if (!p.prevista) continue;
      const r = preverAcao(e, p.acao, Math.max(p.quando, e.t), { objetosDoMapa: this.amb.objetosDoMapa() });
      if (r.ok) e = r.estado;
    }
    this.cache = { versao: this.versao, estado: e };
    return e;
  }

  private registrarRtt(ms: number) {
    this.rtt = this.rtt === 0 ? ms : this.rtt * 0.7 + ms * 0.3;
  }

  /** O estado para DESENHAR: a previsão liquidada até o relógio estimado, sem recuo por reconciliação de cliques. */
  exibir(): VisaoCliente | null {
    const previsto = this.estado();
    if (!previsto) return null;
    const v = preverEstado(previsto, this.agora()).estado;
    const local = this.amb.agoraLocal();
    for (const [r, quando] of [...this.ultimoCliquePorRecurso]) {
      if (local - quando > SINCRONIA.pisoDaExibicaoMs) {
        this.ultimoCliquePorRecurso.delete(r);
        this.pisos.delete(r);
        continue;
      }
      const piso = this.pisos.get(r) ?? v.recursos[r];
      if (v.recursos[r] >= piso) this.pisos.set(r, v.recursos[r]);
      else v.recursos[r] = piso;
    }
    return v;
  }

  private limparPisos() {
    this.pisos.clear();
    this.ultimoCliquePorRecurso.clear();
  }

  /** Instante em que é preciso pedir o estado de novo (fim de expedição), ou null. */
  proximaParada(): number | null {
    const e = this.estado();
    if (!e) return null;
    const fins = e.expedicoes.map((x) => x.fim);
    return fins.length ? Math.min(...fins) : null;
  }

  /** Para o "Salvo há": última confirmação, ações na fila e queda de rede. */
  sincronia(): { confirmadoEm: number | null; pendentes: number; semConexao: boolean } {
    return { confirmadoEm: this.confirmadoEm, pendentes: this.todos().length, semConexao: this.quedaDeRede };
  }

  /** Há ação do servidor em andamento (para travar botões). */
  aguardandoServidor(): boolean {
    return this.todos().some((p) => !p.prevista);
  }

  assinar(fn: () => void): () => void {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  /** Número que muda a cada mudança de estado ou de fila (para o React). */
  get instantaneo(): number {
    return this.versao;
  }

  // ---------- ações ----------

  /**
   * Clique em objeto: soma no lote aberto do mesmo objeto (até o máximo por
   * lote) ou abre um lote novo. Devolve o ganho previsto (para o "+N") e o
   * desfecho do lote. `cheio`: não rendeu nada porque o recurso está no teto
   * do armazém (o clique vai ao servidor do mesmo jeito; quem decide é ele).
   */
  clicar(objeto: string): { ganho: number; cheio: boolean; limite: boolean; desfecho: Promise<Desfecho> } {
    const antes = this.estado();
    // Árvores e pedras pelo mapa; construções produtoras (serraria, pedreira...) pelo slot.
    const recurso = antes ? recursoDoObjeto(antes, objeto, { objetosDoMapa: this.amb.objetosDoMapa() }) : null;
    if (!antes || !recurso) return { ganho: 0, cheio: false, limite: false, desfecho: Promise.resolve({ ok: false, motivo: 'recusada', erro: 'objeto_invalido' }) };
    const local = this.amb.agoraLocal();
    this.ultimoCliquePorRecurso.set(recurso, local);
    const ultimo = this.fila[this.fila.length - 1];
    const aberto =
      ultimo && ultimo.acao.tipo === 'clicar' && ultimo.acao.objeto === objeto && ultimo.loteAte !== null && local < ultimo.loteAte && ultimo.acao.quantidade < FORMULAS.clique.maximoPorLote;
    let desfecho: Promise<Desfecho>;
    if (aberto && ultimo.acao.tipo === 'clicar') {
      ultimo.acao = { ...ultimo.acao, quantidade: ultimo.acao.quantidade + 1 };
      desfecho = (ultimo as Pedido & { promessa: Promise<Desfecho> }).promessa;
    } else {
      desfecho = this.enfileirar({ tipo: 'clicar', objeto, quantidade: 1 }, { loteAte: local + SINCRONIA.loteCliquesMs });
    }
    this.mudou();
    // Os dois lados no mesmo instante: com dois relógios, a produção dos
    // milissegundos entre as leituras entrava no "antes" e o "+N" saía 0,998.
    const agora = this.agora();
    const depois = preverEstado(this.estado()!, agora).estado;
    const ganho = Math.max(0, depois.recursos[recurso] - preverEstado(antes, agora).estado.recursos[recurso]);
    const cheio = ganho === 0 && depois.recursos[recurso] >= tetos(depois)[recurso];
    // Não rendeu e o armazém não está cheio: bateu no teto de cliques por segundo (decisão do dono: o jogador é avisado).
    return { ganho, cheio, limite: ganho === 0 && !cheio, desfecho };
  }

  /**
   * Envia uma ação. As previstas mudam a tela na hora; as do servidor
   * (contratar, expedição, ascender) só mudam com a resposta. `chave`
   * reaproveita a chave de uma tentativa anterior que caiu por rede.
   * Ascender destrói o progresso: sem `confirmada: true` não sai daqui.
   * A mesma ação do servidor já em andamento (clique duplo) devolve o mesmo
   * desfecho, sem segundo envio.
   */
  enviar(acao: Acao, op: { chave?: string; confirmada?: boolean } = {}): Promise<Desfecho> {
    if (acao.tipo === 'ascender' && op.confirmada !== true) return Promise.resolve({ ok: false, motivo: 'sem_confirmacao' });
    const prevista = !precisaDoServidor(acao);
    // Qualquer ação que não seja clique pode gastar recursos: a tela volta a mostrar a previsão pura.
    this.limparPisos();
    if (!prevista) {
      const igual = this.todos().find((p) => !p.prevista && JSON.stringify(p.acao) === JSON.stringify(acao));
      if (igual) return (igual as Pedido & { promessa: Promise<Desfecho> }).promessa;
    }
    if (prevista) {
      const e = this.estado();
      if (e) {
        const r = preverAcao(e, acao, this.agora(), { objetosDoMapa: this.amb.objetosDoMapa() });
        if (!r.ok) return Promise.resolve({ ok: false, motivo: 'recusada', erro: r.erro });
      }
    }
    return this.enfileirar(acao, { chave: op.chave });
  }

  /**
   * "Salvar agora" (Configurações): fecha os lotes de cliques ainda abertos,
   * manda a fila já e resolve quando tudo o que estava pendente teve resposta.
   */
  salvarAgora(prazoMs: number = SINCRONIA.salvarPrazoMs): Promise<Desfecho[]> {
    // Cópia: bombear() tira o primeiro da própria fila.
    const pendentes = [...this.todos()] as (Pedido & { promessa: Promise<Desfecho> })[];
    let fechou = false;
    for (const p of this.fila) {
      if (p.loteAte !== null) {
        p.loteAte = null;
        fechou = true;
      }
    }
    // A espera era só do lote: corta e manda agora (espera de rede ou de 429 continua).
    if (fechou && this.esperaDeLote && this.temporizador !== null) {
      this.amb.cancelar(this.temporizador);
      this.temporizador = null;
    }
    this.bombear();
    // Com prazo: o botão nunca fica esperando para sempre; o que não respondeu conta como tempo esgotado.
    const respostas = pendentes.map((p) => Promise.race([p.promessa, new Promise<Desfecho>((ok) => {
      const id = this.amb.agendar(() => ok({ ok: false, motivo: 'tempo_esgotado' }), prazoMs);
      void p.promessa.then(() => this.amb.cancelar(id));
    })]));
    return Promise.all(respostas);
  }

  /**
   * Reset do progresso: o que está pendente não vale mais. Cancela o lote e o temporizador, aborta o pedido em
   * voo e resolve tudo como recusado ('descartada'). Uma resposta tardia desse pedido é ignorada.
   */
  descartarPendentes() {
    const todos = this.todos();
    if (this.temporizador !== null) {
      this.amb.cancelar(this.temporizador);
      this.temporizador = null;
      this.esperaDeLote = false;
    }
    const voo = this.emVoo;
    this.fila = [];
    this.emVoo = null;
    this.limparPisos();
    for (const p of todos) {
      p.descartado = true;
      p.resolver({ ok: false, motivo: 'recusada', erro: 'descartada' });
    }
    if (voo) this.controleVoo?.abort();
    this.mudou();
  }

  // ---------- fila ----------

  private todos(): Pedido[] {
    return this.emVoo ? [this.emVoo, ...this.fila] : this.fila;
  }

  private enfileirar(acao: Acao, op: { chave?: string; loteAte?: number }): Promise<Desfecho> {
    let resolver!: (d: Desfecho) => void;
    const promessa = new Promise<Desfecho>((r) => (resolver = r));
    const pedido: Pedido & { promessa: Promise<Desfecho> } = {
      chave: op.chave ?? this.amb.novaChave(),
      acao,
      prevista: !precisaDoServidor(acao),
      quando: this.agora(),
      loteAte: op.loteAte ?? null,
      tentativas: 0,
      conflitos: 0,
      resolver,
      promessa,
    };
    this.fila.push(pedido);
    this.mudou();
    this.bombear();
    return promessa;
  }

  private mudou() {
    this.versao++;
    for (const fn of this.ouvintes) fn();
  }

  private concluir(p: Pedido, d: Desfecho) {
    if (this.emVoo === p) this.emVoo = null;
    this.fila = this.fila.filter((x) => x !== p);
    p.resolver(d);
    this.mudou();
    this.bombear();
  }

  /** Manda o primeiro da fila, se não houver nenhum em voo e o lote dele já fechou. */
  private bombear() {
    if (this.emVoo || this.temporizador !== null || !this.base) return;
    const p = this.fila[0];
    if (!p) return;
    const local = this.amb.agoraLocal();
    if (p.loteAte !== null && local < p.loteAte) {
      this.esperaDeLote = true;
      this.temporizador = this.amb.agendar(() => {
        this.temporizador = null;
        this.esperaDeLote = false;
        this.bombear();
      }, p.loteAte - local);
      return;
    }
    p.loteAte = null;
    this.fila.shift();
    this.emVoo = p;
    void this.mandar(p);
  }

  private esperarEBombear(ms: number) {
    this.esperaDeLote = false;
    this.temporizador = this.amb.agendar(() => {
      this.temporizador = null;
      this.bombear();
    }, ms);
  }

  /** Volta o pedido para a frente da fila (nova tentativa com a mesma chave). */
  private devolver(p: Pedido) {
    this.emVoo = null;
    this.fila.unshift(p);
  }

  private async mandar(p: Pedido) {
    const { tipo, ...dados } = p.acao;
    const controle = new AbortController();
    this.controleVoo = controle;
    const prazo = this.amb.agendar(() => controle.abort(), SINCRONIA.tempoLimiteAcaoMs);
    const saiu = this.amb.agoraLocal();
    let resposta: RespostaHttp;
    try {
      resposta = await this.amb.transporte({ tipo, dados, idempotencyKey: p.chave, revEsperada: this.base!.rev }, controle.signal);
    } catch {
      this.amb.cancelar(prazo);
      if (p.descartado) return;
      const motivo = controle.signal.aborted ? 'tempo_esgotado' : 'rede';
      p.tentativas++;
      this.quedaDeRede = true;
      this.mudou();
      if (p.prevista && p.tentativas < SINCRONIA.tentativasRede) {
        // Mesma chave: se o servidor já tinha aplicado, ele devolve a resposta guardada.
        this.devolver(p);
        this.esperarEBombear(SINCRONIA.esperaRedeMs);
        return;
      }
      this.concluir(p, { ok: false, motivo });
      return;
    }
    this.amb.cancelar(prazo);
    if (p.descartado) return;
    const corpo = resposta.corpo as Record<string, unknown>;
    if (corpoValido(corpo)) this.receberEstado({ ...corpo, rttMs: this.amb.agoraLocal() - saiu }, { adotar: resposta.status === 409 });

    if (resposta.status === 200) {
      this.concluir(p, typeof corpo.cliquesAceitos === 'number' ? { ok: true, cliquesAceitos: corpo.cliquesAceitos } : { ok: true });
    } else if (resposta.status === 409) {
      p.conflitos++;
      if (p.prevista && p.conflitos <= SINCRONIA.tentativasConflito) {
        // Rebaseia no estado do servidor (adotado acima) e reenvia; o servidor revalida tudo.
        this.devolver(p);
        this.mudou();
        this.bombear();
      } else {
        this.concluir(p, { ok: false, motivo: 'conflito' });
      }
    } else if (resposta.status === 429) {
      const esperarS = typeof corpo.esperarS === 'number' ? corpo.esperarS : 1;
      if (p.prevista) {
        this.devolver(p);
        this.esperarEBombear(esperarS * 1000);
      } else {
        this.concluir(p, { ok: false, motivo: 'limite', esperarS });
      }
    } else if (resposta.status === 401) {
      this.concluir(p, { ok: false, motivo: 'sessao' });
    } else {
      this.concluir(p, { ok: false, motivo: 'recusada', erro: typeof corpo.erro === 'string' ? corpo.erro : 'erro_desconhecido' });
    }
  }
}
