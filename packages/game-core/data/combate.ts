// Combate (Portão 20b; CRONARCA_COMBATE_E_MAPA.md 1.3 a 1.5): só números,
// todos inteiros. Multiplicadores em pontos-base (10 000 = 100%). A lógica fica
// em src/combate/. Valores iniciais: a calibragem (20c) propõe os definitivos.

import type { Classe } from './aventureiros.ts';

/** Um tick é 100 ms de jogo; a batalha acaba em 600 ticks (60 s) no máximo. */
export const TICK_MS = 100;
export const LIMITE_TICKS = 600;

/** Linhas de formação: 0 frente, 1 meio, 2 trás. */
export const LINHAS = 3;
export type Linha = 0 | 1 | 2;

export interface AtributosClasse {
  /** Nível 1, sem equipamento. */
  vida: number;
  ataque: number;
  defesa: number;
  /**
   * Alcance em linhas: ataca a linha j do inimigo se (linha própria + j + 1) <= alcance,
   * com as linhas fechadas (uma linha vazia faz as de trás avançarem).
   */
  alcance: number;
  /** Ticks entre ataques. */
  intervalo: number;
  /** Linha padrão na formação. */
  linha: Linha;
  /** Ticks até o primeiro golpe (aproximação; é o "Movimento" da especificação). */
  aproximacao: number;
  /** Quantos inimigos cada golpe atinge (dano em área pequena do Mago). */
  alvos: number;
  /** Ganho por nível (do 2 ao 20). */
  porNivel: { vida: number; ataque: number; defesa: number };
  /** Ataque por nível de arma (0 a 6). */
  ataquePorArma: number;
}

export const ATRIBUTOS_CLASSE: Record<Classe, AtributosClasse> = {
  lanceiro: { vida: 120, ataque: 12, defesa: 10, alcance: 1, intervalo: 12, linha: 0, aproximacao: 20, alvos: 1, porNivel: { vida: 12, ataque: 1, defesa: 1 }, ataquePorArma: 2 },
  cavaleiro: { vida: 110, ataque: 14, defesa: 7, alcance: 1, intervalo: 11, linha: 0, aproximacao: 10, alvos: 1, porNivel: { vida: 11, ataque: 2, defesa: 1 }, ataquePorArma: 2 },
  arqueiro: { vida: 75, ataque: 11, defesa: 3, alcance: 4, intervalo: 13, linha: 2, aproximacao: 0, alvos: 1, porNivel: { vida: 7, ataque: 1, defesa: 0 }, ataquePorArma: 2 },
  mago_do_tempo: { vida: 55, ataque: 8, defesa: 2, alcance: 3, intervalo: 16, linha: 1, aproximacao: 0, alvos: 2, porNivel: { vida: 5, ataque: 1, defesa: 0 }, ataquePorArma: 1 },
};

/** Armadura (0 a 6): vida e defesa por nível. */
export const ARMADURA = { vida: 8, defesa: 2 } as const;

/** Triângulo de classes: quem cada uma vence. O Mago do Tempo não entra. */
export const VENCE: Partial<Record<Classe, Classe>> = { lanceiro: 'cavaleiro', cavaleiro: 'arqueiro', arqueiro: 'lanceiro' };
/** Dano a favor (x1,5) e contra (x0,75), em pontos-base. */
export const VANTAGEM_BP = { favor: 15_000, contra: 7_500, neutro: 10_000 } as const;

export const TATICAS = ['agressiva', 'defensiva', 'equilibrada'] as const;
export type Tatica = (typeof TATICAS)[number];
/**
 * Tática, em pontos-base: `ataque` muda o dano causado; `defesa` reduz o dano
 * recebido (negativo: recebe mais). Mexer direto no dano dá o mesmo peso aos
 * dois lados (somar à defesa da fórmula valia bem menos que tirar do ataque).
 */
export const AJUSTE_TATICA: Record<Tatica, { ataque: number; defesa: number }> = {
  agressiva: { ataque: 2_000, defesa: -2_000 },
  defensiva: { ataque: -2_000, defesa: 2_000 },
  equilibrada: { ataque: 0, defesa: 0 },
};

/** Variação sorteada do dano, em pontos-base (90% a 110%). */
export const VARIACAO_DANO_BP = [9_000, 11_000] as const;
/** Dano = ataque × 100 / (100 + FATOR_DEFESA × defesa). */
export const FATOR_DEFESA = 5;

/** Mago do Tempo: cada golpe atrasa o próximo ataque dos atingidos; aliados perto atacam mais rápido. */
export const MAGO = {
  /** Ticks somados ao próximo ataque de quem o Mago atinge. */
  atrasoTicks: 3,
  /** Intervalo dos aliados na mesma linha do Mago ou na vizinha, em milésimos (9/10). Não acumula. */
  pressaPermil: 900,
} as const;

/**
 * Poder de combate: raiz inteira de (vida × (100 + 5 × defesa) × ataque × alvos × ESCALA / (intervalo × DIVISOR)).
 * Lanceiro de nível 1 sem equipamento: 33; três deles, cerca de E(1) = 100.
 */
export const PODER = { escala: 64, divisor: 1_000 } as const;

/**
 * Curva dos Ecos (seção 1.5). E(n) = 100 × (21/20)^(n−1). Multiplicadores em
 * centésimos. O chefe substitui o "muito difícil" a cada 10 fases. Endurecimento:
 * +2 centésimos a cada 30 fases (k = piso((n−1)/30), até 5, ou seja, no máximo +0,10) no
 * difícil, muito difícil e chefe. Era +5 (máximo +0,25); o Portão 20d-1 (decisão do dono em
 * 16/11) baixou para +2 porque com +5 o difícil caía a 17% e o muito difícil a 7% (docs/CALIBRACAO_COMBATE.md).
 */
export const CURVA_ECO = {
  base: 100,
  fator: { num: 21, den: 20 },
  ciclo: [
    // Calibrados no Portão 20c (docs/CALIBRACAO_COMBATE.md, aprovados pelo dono): com o jogador tipo em
    // E(n), fácil ~90% das tropas plausíveis vencem, média ~60%, difícil ~30%, muito difícil ~10-20%,
    // chefe 0% (pede poder acima do esperado). Antes: 0,75 / 1,00 / 0,80 / 1,20 / 1,45 e chefe 1,70.
    { nivel: 'facil', mult: 75 },
    { nivel: 'media', mult: 95 },
    { nivel: 'facil', mult: 80 },
    { nivel: 'dificil', mult: 105 },
    { nivel: 'muito_dificil', mult: 110 },
  ],
  chefe: { aCada: 10, mult: 130 },
  endurecimento: { aCada: 30, passo: 2, passosMaximos: 5 },
} as const;
export type NivelEco = 'facil' | 'media' | 'dificil' | 'muito_dificil' | 'chefe';

/**
 * Poder mínimo e recomendado para tentar uma fase, em pontos-base do poder do
 * Eco (Portão 20c): o mínimo é o limiar da melhor contra-escalação (abaixo dele
 * nenhuma tropa plausível vence); o recomendado, o da composição razoável.
 */
export const PODER_FASE_BP = { minimo: 8_800, recomendado: 10_200 } as const;

/** Composição defensiva do Eco: parte do orçamento por classe, em %. Sem tema (Portão 23). */
export const COMPOSICAO_ECO: Record<Classe, number> = { lanceiro: 35, cavaleiro: 25, arqueiro: 25, mago_do_tempo: 15 };
/** Tamanho do Eco: 3 unidades, +1 a cada 20 fases, até 8. */
export const TAMANHO_ECO = { inicial: 3, aCada: 20, maximo: 8 } as const;
