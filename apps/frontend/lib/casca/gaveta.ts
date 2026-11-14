// Gesto da alça da gaveta de Destinos (Portão 14). Função pura.

/** Arrasto mínimo, em px de tela, para a alça abrir ou fechar; abaixo disso é um toque. */
export const ARRASTO_GAVETA_PX = 24;

/**
 * Estado da gaveta depois de soltar a alça. dy: deslocamento vertical do
 * ponteiro (negativo = para cima). Toque alterna; arrastar para cima abre e
 * para baixo fecha; arrasto no sentido em que ela já está não muda nada.
 */
export function gestoDaGaveta(aberta: boolean, dy: number): boolean {
  if (Math.abs(dy) < ARRASTO_GAVETA_PX) return !aberta;
  return dy < 0;
}
