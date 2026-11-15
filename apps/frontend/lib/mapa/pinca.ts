// Pinça com dois dedos no mapa (celular). Só lógica pura: o CanvasMapa
// acompanha os dedos e aplica o resultado na câmera.
//
// O zoom continua inteiro (spec do mapa): a distância entre os dedos vira
// níveis inteiros a partir do zoom do início da pinça. Cada nível pede
// FATOR_NIVEL_PINCA de abertura (ou de fechamento) e há folga: para voltar
// um nível é preciso desfazer o gesto inteiro daquele nível, então o zoom não
// fica piscando quando os dedos param perto de um limite. O ponto médio entre
// os dedos é o centro do zoom, e mover os dois juntos arrasta o mapa.

import type { Ponto } from './camera';

/** Quanto a distância entre os dedos precisa crescer (ou encolher) para subir (ou descer) um nível de zoom. */
export const FATOR_NIVEL_PINCA = 1.4;

export interface Pinca {
  /** Distância entre os dedos no começo da pinça (px de tela, nunca 0). */
  distancia0: number;
  /** Zoom da câmera no começo da pinça. */
  zoom0: number;
  /** Níveis já aplicados desde o começo (positivo aproxima). */
  nivel: number;
  /** Ponto médio entre os dedos no último movimento (para o arrasto). */
  medio: Ponto;
}

const distancia = (a: Ponto, b: Ponto) => Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
const pontoMedio = (a: Ponto, b: Ponto): Ponto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function iniciarPinca(a: Ponto, b: Ponto, zoom: number): Pinca {
  return { distancia0: distancia(a, b), zoom0: zoom, nivel: 0, medio: pontoMedio(a, b) };
}

export interface PassoPinca {
  pinca: Pinca;
  /** Zoom pedido pelo gesto (o CanvasMapa ainda limita ao mínimo e ao máximo). */
  zoom: number;
  /** Centro do zoom, em px do canvas: o ponto médio entre os dedos. */
  centro: Ponto;
  /** Arrasto do ponto médio desde o último movimento, em px de tela. */
  pan: Ponto;
}

export function moverPinca(p: Pinca, a: Ponto, b: Ponto): PassoPinca {
  // Níveis "crus" pela razão das distâncias, em escala logarítmica (abrir 1,4x = +1; fechar 1,4x = −1).
  const cru = Math.log(distancia(a, b) / p.distancia0) / Math.log(FATOR_NIVEL_PINCA);
  let nivel = p.nivel;
  if (cru >= nivel + 1) nivel = Math.floor(cru);
  else if (cru <= nivel - 1) nivel = Math.ceil(cru);
  const medio = pontoMedio(a, b);
  return {
    pinca: { ...p, nivel, medio },
    zoom: p.zoom0 + nivel,
    centro: medio,
    pan: { x: medio.x - p.medio.x, y: medio.y - p.medio.y },
  };
}
