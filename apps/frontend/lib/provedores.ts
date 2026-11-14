// Botões de Google e Discord no login: estado puro (testado sem navegador).

export interface ProvedoresDisponiveis {
  google: boolean;
  discord: boolean;
}

/**
 * Quanto esperar a lista de provedores antes de mostrar "indisponível". O
 * backend no plano grátis do Render dorme e leva perto de 1 min para acordar;
 * a busca continua tentando depois disso e os botões ligam se ele responder.
 */
export const LIMITE_CONECTANDO_MS = 90_000;

export type EstadoProvedor = 'conectando' | 'ligado' | 'indisponivel';

/** Estado do botão de um provedor: sem resposta ainda é "conectando", não "indisponível". */
export function estadoProvedor(
  dados: ProvedoresDisponiveis | undefined,
  desistiu: boolean,
  provedor: keyof ProvedoresDisponiveis,
): EstadoProvedor {
  if (dados) return dados[provedor] ? 'ligado' : 'indisponivel';
  return desistiu ? 'indisponivel' : 'conectando';
}
