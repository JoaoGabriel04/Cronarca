// Aventureiros e aldeões (handoff "Economia v0" e "Dados do jogo").

export const CLASSES = ['guerreiro', 'arqueiro', 'mago', 'ladino', 'clerigo'] as const;
export type Classe = (typeof CLASSES)[number];

export const NOMES_CLASSES: Record<Classe, string> = {
  guerreiro: 'Guerreiro',
  arqueiro: 'Arqueiro',
  mago: 'Mago',
  ladino: 'Ladino',
  clerigo: 'Clérigo',
};

/** Classe do aventureiro inicial de cada ciclo. */
export const CLASSE_INICIAL: Classe = 'guerreiro';

/** Lista fixa de nomes (decisão do Portão 4). O sorteio evita repetir enquanto houver nome livre. */
export const NOMES_AVENTUREIROS = [
  'Aldric', 'Brenna', 'Cedric', 'Dália', 'Edmundo', 'Fiona',
  'Gaspar', 'Helena', 'Isolda', 'Jofre', 'Leonor', 'Mateus',
  'Nuno', 'Olívia', 'Percival', 'Quitéria', 'Rodrigo', 'Sancha',
  'Tristão', 'Urraca', 'Vasco', 'Violante', 'Afonso', 'Beatriz',
] as const;

export const OFICIOS = ['fazendeiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro'] as const;
export type Oficio = (typeof OFICIOS)[number];

export const NOMES_OFICIOS: Record<Oficio, string> = {
  fazendeiro: 'Fazendeiro',
  lenhador: 'Lenhador',
  mineiro: 'Mineiro',
  sabio: 'Sábio',
  ferreiro: 'Ferreiro',
};

/** Rodízio determinístico: o n-ésimo aldeão recebe OFICIOS[n % 5]. */
export const RODIZIO_OFICIOS: readonly Oficio[] = OFICIOS;
