// Estado de exemplo do preview do mapa (/jogo/mapa): início do ciclo, mais
// uma expedição real para a Floresta (pela regra do game-core) e uma obra em
// andamento, para mostrar pin ativo, trilha, grupo e caixas de tempo.

import { aplicarAcao, estadoInicial, type EstadoJogo } from '@cronarca/game-core';

const OBRA_EXEMPLO_MS = 90_000;

/** Estado completo (com o segredo): o preview roda as ações do game-core sobre ele. */
export function estadoDeExemplo(agora: number): EstadoJogo {
  const inicio = estadoInicial({ semente: 1, agora });
  const r = aplicarAcao(inicio, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['a1'] }, agora);
  const e = r.estado;
  // Obra só de exemplo (a regra real exige recursos que o início do ciclo não tem).
  e.slots.serraria_2 = { ...e.slots.serraria_2, obraAte: agora + OBRA_EXEMPLO_MS };
  return e;
}
