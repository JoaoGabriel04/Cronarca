// Preferências do jogador (handoff, "Estado salvo"): não são estado de jogo.
// Ficam na conta (User.preferencias) e numa cópia no navegador; o contrato é
// este esquema, usado pela rota e pela tela de Configurações.
import { z } from 'zod';

export const esquemaPreferencias = z.strictObject({
  /** Sprites com os 2 quadros de animação; desligado, tudo fica no quadro 1. */
  animacoes: z.boolean(),
});

export type Preferencias = z.infer<typeof esquemaPreferencias>;

export const PREFERENCIAS_PADRAO: Preferencias = { animacoes: true };

/** Lê o que está gravado (pode faltar campo de versão anterior); o que não vale volta ao padrão. */
export function lerPreferencias(bruto: unknown): Preferencias {
  const r = esquemaPreferencias.partial().safeParse(bruto ?? {});
  return { ...PREFERENCIAS_PADRAO, ...(r.success ? r.data : {}) };
}
