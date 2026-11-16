// Aventureiros e aldeões (handoff "Economia v0" e "Dados do jogo").

/**
 * Classes do combate (Portão 20a, esquema 9; CRONARCA_COMBATE_E_MAPA.md 1.3):
 * Lanceiro vence Cavaleiro, Cavaleiro vence Arqueiro, Arqueiro vence
 * Lanceiro; o Mago do Tempo é suporte, sem vantagem. Nas expedições a classe
 * ainda não tem efeito (o poder ignora a classe).
 */
export const CLASSES = ['lanceiro', 'arqueiro', 'cavaleiro', 'mago_do_tempo'] as const;
export type Classe = (typeof CLASSES)[number];

export const NOMES_CLASSES: Record<Classe, string> = {
  lanceiro: 'Lanceiro',
  arqueiro: 'Arqueiro',
  cavaleiro: 'Cavaleiro',
  mago_do_tempo: 'Mago do Tempo',
};

/** Classe do aventureiro inicial de cada ciclo. */
export const CLASSE_INICIAL: Classe = 'lanceiro';

/** Classes do esquema 8 e anteriores, e a classe nova de cada uma (migração 8 → 9). */
export const CLASSES_ANTIGAS = { guerreiro: 'lanceiro', arqueiro: 'arqueiro', ladino: 'arqueiro', clerigo: 'cavaleiro', mago: 'mago_do_tempo' } as const satisfies Record<string, Classe>;

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
