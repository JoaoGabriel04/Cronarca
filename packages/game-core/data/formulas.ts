// Parâmetros das fórmulas v0 (handoff, "Fórmulas iniciais"). Só números:
// a lógica que os usa fica em src/formulas.ts. Trocar um valor aqui muda o
// jogo sem mexer em código.

export const FORMULAS = {
  /** Custo de construir/melhorar para o nível n: round(custoBase × fatorCusto^(n−1)). */
  construcao: { fatorCusto: 1.55, segundosBase: 30, fatorTempo: 1.4 },

  /**
   * Teto: round(base × fator^(nível−1)); Armazém para 5 recursos, Celeiro para comida.
   * O fator é o mesmo do custo (1,55): assim toda construção com custoBase ≤ base (300)
   * por recurso cabe em todos os níveis, inclusive o próprio Armazém (test/capacidade).
   */
  teto: { base: 300, fator: 1.55, nivelMinimo: 1 },

  aldeoes: {
    porNivelDeCasa: 4,
    segundosPorChegada: 20,
    comidaDoFazendeiro: 0.35,
    /** Bônus de cada aldeão no recurso do seu ofício (lenhador, mineiro, sábio, ferreiro). */
    bonusPorOficio: 0.05,
  },

  /**
   * Comida por segundo. Aventureiro (Portão 22, curva C): cada um come `base + crescimento × (n − 1)`, com n o número
   * de aventureiros (alojados ou não): simbólico com poucos e crescente com a guilda. Era 0,08 fixo por aventureiro.
   */
  consumo: { comidaPorAldeao: 0.05, comidaBaseAventureiro: 0.03, comidaCrescimentoAventureiro: 0.006 },

  guilda: { vagasBase: 4, vagasPorNivelDeTaverna: 1, vagasHospitalidadePorTaverna: 1 },

  /** fatorOuro 1,58: a última contratação (guilda com 15 vagas) cabe no Armazém 10. */
  contratar: { ouroBase: 40, fatorOuro: 1.58, comida: 20 },

  aventureiro: {
    nivelInicial: 1,
    nivelMaximo: 20,
    xpVitoria: 2,
    xpRecuo: 1,
    /** XP para subir do nível n para n+1: xpPorNivel × n. */
    xpPorNivel: 4,
    /** Poder: base + porNivel × nível + porArma × arma + porArmadura × armadura. */
    poder: { base: 5, porNivel: 4, porArma: 3, porArmadura: 2 },
    equipamentoMaximo: 6,
    /** Custo de melhorar (n = nível atual): round(base × (n + 1)). */
    custoArma: { ferro: 12, ouro: 15 },
    custoArmadura: { ferro: 10, ouro: 12 },
    /** Na derrota, cada um tem esta chance de ficar ferido, por este tempo. */
    chanceFerimento: 0.25,
    segundosFerido: 60,
  },

  expedicao: {
    /** Chance: clamp(base + porPoder × (poder − fatorPerigo × perigo), mínimo, máximo). */
    chanceBase: 0.5,
    chancePorPoder: 0.02,
    fatorPerigo: 1.5,
    chanceMinima: 0.05,
    chanceMaxima: 0.98,
    /** Saque × (1 + bonusPorAventureiroExtra × (aventureiros − 1)). */
    bonusPorAventureiroExtra: 0.1,
  },

  /** Relíquias na ascensão: base + porCiclo × (ciclo − 1). */
  ascensao: { reliquiasBase: 3, reliquiasPorCiclo: 2 },

  /** Bônus por nível de relíquia. */
  reliquias: {
    maosCalejadasPorNivel: 0.25,
    bencaoColheitaPorNivel: 0.1,
    sabedoriaAncestralPorNivel: 0.15,
    caminhosEternosPorNivel: 0.06,
    linhagemHeroicaPorNivel: 1,
    legadoPorNivel: { madeira: 60, pedra: 30, comida: 40 },
  },

  pesquisas: { colheitaFarta: 0.1 },

  /** Clique: ganho = base × (1 + Mãos Calejadas); baldes de fichas com capacidade de 1 s. */
  clique: { ganhoBase: 1, porSegundoUsuario: 10, porSegundoObjeto: 5, maximoPorLote: 100 },

  cronica: { maximoDeLinhas: 50 },
  /** Relatórios de expedição guardados (os mais recentes). */
  relatorios: { maximo: 10 },
} as const;
