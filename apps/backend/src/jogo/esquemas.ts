import { esquemaAcao, PALAVRA_APAGAR, type Acao } from '@cronarca/game-core';
import { z } from 'zod';

/**
 * Corpo de POST /game/actions (handoff, Arquitetura 3). `dados` são os campos
 * da ação, ex.: { slot: 'casa_1' }. Só intenções e ids: quem decide custo,
 * ganho e sorteio é o servidor.
 */
export const esquemaCorpoAcao = z.strictObject({
  tipo: z.string().min(1).max(32),
  dados: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.uuid(),
  revEsperada: z.number().int().min(0),
});

export type CorpoAcao = z.infer<typeof esquemaCorpoAcao>;

/** Junta tipo e dados e valida com o esquema estrito do game-core. */
export function lerAcao(corpo: CorpoAcao): Acao | null {
  const r = esquemaAcao.safeParse({ ...corpo.dados, tipo: corpo.tipo });
  return r.success ? r.data : null;
}

/** Corpo de POST /game/reset: o jogador digitou a palavra de confirmação. */
export const esquemaApagar = z.strictObject({ confirmacao: z.literal(PALAVRA_APAGAR) });
