// Cache do SWR do jogo. As chaves /api/game/* e /api/ranking valem para UMA conta; ao trocar de conta (sair, entrar,
// convidado, entrar na conta existente) o cache da anterior precisa sumir, senão o jogo novo nasce com o estado antigo
// (e, com rev maior, o servidor parecia "velho" para o Sincronizador).

type Mutar = (filtro: (chave: unknown) => boolean, dados?: unknown, opcoes?: { revalidate: boolean }) => Promise<unknown>;

/** Chaves do cache que pertencem à conta atual. */
export const ehChaveDaConta = (chave: unknown): boolean =>
  typeof chave === 'string' && (chave.startsWith('/api/game') || chave.startsWith('/api/ranking'));

/** Esvazia o cache das chaves da conta, sem pedir de novo (quem monta o jogo pede o estado da conta nova). */
export function limparCacheDoJogo(mutate: Mutar): Promise<unknown> {
  return mutate(ehChaveDaConta, undefined, { revalidate: false });
}
