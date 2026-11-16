import { esquemaAcao, FASE_MAXIMA, PALAVRA_APAGAR, TAMANHO_ECO, type Acao } from '@cronarca/game-core';
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

/**
 * Query de GET /game/readiness (Portão 20d-2): a fase e, opcionalmente, os ids
 * dos aventureiros da tropa separados por vírgula. Só ids: o servidor lê nível e
 * equipamento do próprio estado.
 */
export const esquemaConsultaProntidao = z
  .strictObject({
    fase: z.string().regex(/^\d{1,4}$/).transform(Number).pipe(z.number().int().min(1).max(FASE_MAXIMA)),
    tropa: z.string().max(400).optional(),
  })
  .transform((q, ctx) => {
    const ids = q.tropa ? q.tropa.split(',') : [];
    const validos = ids.every((id) => id.length >= 1 && id.length <= 32) && new Set(ids).size === ids.length && ids.length <= TAMANHO_ECO.maximo;
    if (!validos) ctx.addIssue({ code: 'custom', path: ['tropa'], message: 'ids inválidos, repetidos ou em excesso' });
    return { fase: q.fase, tropa: ids };
  });
