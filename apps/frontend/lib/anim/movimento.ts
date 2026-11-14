// A animação dos sprites fica no quadro 1 com movimento reduzido no sistema
// (prefers-reduced-motion) ou com a preferência "Animações dos sprites" desligada.

let consulta: MediaQueryList | null | undefined;
let preferencia = true;

/** A preferência do jogador (Configurações), lida pelo laço dos sprites fora do mapa. */
export function definirPreferenciaAnimacao(ligada: boolean) {
  preferencia = ligada;
}

/** false com movimento reduzido ou a preferência desligada. A consulta é viva: muda sem recarregar. */
export function animacaoLigada(): boolean {
  if (typeof window === 'undefined') return preferencia;
  if (consulta === undefined) consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  return preferencia && !consulta?.matches;
}
