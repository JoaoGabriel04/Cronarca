// Os 6 recursos do jogo, na ordem em que aparecem no HUD.
export const RECURSOS = ['madeira', 'pedra', 'comida', 'ferro', 'ouro', 'saber'] as const;
export type Recurso = (typeof RECURSOS)[number];

export const NOMES_RECURSOS: Record<Recurso, string> = {
  madeira: 'Madeira',
  pedra: 'Pedra',
  comida: 'Comida',
  ferro: 'Ferro',
  ouro: 'Ouro',
  saber: 'Saber',
};
