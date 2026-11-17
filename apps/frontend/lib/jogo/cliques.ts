// Texto do teto de cliques (decisão do dono, 17/11: manter o limite e explicá-lo). O número vem dos dados do jogo.
import { FORMULAS } from '@cronarca/game-core';

/** Rótulo curto que sobe do ponto do clique quando o teto por objeto barra o ganho. */
export const rotuloLimiteCliques = (): string => `Máx. ${FORMULAS.clique.porSegundoObjeto}/s`;

/** Aviso completo, uma vez por visita. */
export const avisoLimiteCliques = (): string =>
  `Cada árvore ou pedra rende até ${FORMULAS.clique.porSegundoObjeto} cliques por segundo (e ${FORMULAS.clique.porSegundoUsuario} no total). Espalhe os cliques entre objetos diferentes.`;
