// Apagar o progresso (POST /game/reset) com prazo, nova tentativa em 429 e um desfecho sempre claro (nunca "congela").
// Sem React e sem fetch fixo: o transporte e a espera são injetados, para os testes controlarem tudo.

import type { CorpoEstado } from './sincronia';

export const RESET = {
  /** Sem resposta neste prazo, a tentativa falha com erro visível. */
  prazoMs: 10_000,
  /** Tentativas em 429 (limite de requisições por segundo), respeitando o Retry-After. */
  tentativas: 3,
  /** Espera máxima entre tentativas, qualquer que seja o Retry-After. */
  esperaMaximaMs: 5_000,
} as const;

export interface RespostaReset {
  status: number;
  corpo: unknown;
}

export type DesfechoReset =
  | { ok: true; corpo: CorpoEstado }
  | { ok: false; motivo: 'rede' | 'tempo_esgotado' | 'limite' | 'sessao' | 'recusada'; erro?: string };

export interface AmbienteReset {
  /** POST /api/game/reset; rejeita em queda de rede ou quando o sinal aborta. */
  transporte: (sinal: AbortSignal) => Promise<RespostaReset>;
  /** Espera `ms` (setTimeout; o teste troca). */
  esperar: (ms: number) => Promise<void>;
  /** Agenda o aborto do prazo. */
  agendar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
}

export async function apagarComTentativas(amb: AmbienteReset): Promise<DesfechoReset> {
  for (let tentativa = 1; ; tentativa++) {
    const controle = new AbortController();
    const prazo = amb.agendar(() => controle.abort(), RESET.prazoMs);
    let r: RespostaReset;
    try {
      r = await amb.transporte(controle.signal);
    } catch {
      return { ok: false, motivo: controle.signal.aborted ? 'tempo_esgotado' : 'rede' };
    } finally {
      amb.cancelar(prazo);
    }
    const corpo = (r.corpo ?? {}) as Record<string, unknown>;
    if (r.status === 200) return { ok: true, corpo: corpo as unknown as CorpoEstado };
    if (r.status === 401) return { ok: false, motivo: 'sessao' };
    if (r.status === 429) {
      if (tentativa >= RESET.tentativas) return { ok: false, motivo: 'limite' };
      const s = typeof corpo.esperarS === 'number' ? corpo.esperarS : 1;
      await amb.esperar(Math.min(RESET.esperaMaximaMs, Math.max(0, s) * 1000));
      continue;
    }
    return { ok: false, motivo: 'recusada', ...(typeof corpo.erro === 'string' ? { erro: corpo.erro } : {}) };
  }
}

/** Mensagem ao jogador para cada falha do reset. */
export function textoDaFalhaDoReset(d: Extract<DesfechoReset, { ok: false }>): string {
  switch (d.motivo) {
    case 'tempo_esgotado':
      return 'O servidor demorou a responder e o progresso não foi apagado. Tente de novo.';
    case 'rede':
      return 'Sem conexão com o servidor. O progresso não foi apagado.';
    case 'limite':
      return 'Muitas requisições agora. Espere alguns segundos e tente de novo.';
    case 'sessao':
      return 'Sua sessão expirou. Entre de novo.';
    default:
      return 'Não foi possível apagar o progresso. Tente de novo.';
  }
}
