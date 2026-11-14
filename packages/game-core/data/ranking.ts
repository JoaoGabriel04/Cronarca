// Ranking (Portão 15). Ordem: era desc, ciclo desc, relíquias totais desc,
// desempate por quem chegou primeiro à posição (marco). Lido só do servidor.

export const RANKING = {
  /** Linhas da lista (as primeiras posições); a do jogador vem à parte, presa embaixo. */
  tamanhoLista: 50,
  /**
   * Tempo jogado: soma dos intervalos entre requisições autenticadas de jogo,
   * só quando o intervalo é de até esta janela. O jogo lê o estado a cada 30 s
   * com a aba aberta, então aba aberta conta e tempo fora (offline) não conta.
   */
  janelaAtividadeMs: 5 * 60_000,
} as const;

/** Abas do modal (Figma "Modal Ranking"): Geral, a era do jogador e Amigos (em breve, sem sistema de amigos na v0). */
export const ABAS_RANKING = ['geral', 'era'] as const;
