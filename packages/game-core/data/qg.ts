// Quartel General (Portão 21): descoberta por uma expedição e custo de reerguer. Todos os números e textos do QG ficam
// aqui (o código não escreve nenhum). O estado vive em `estado.qg` e atravessa a ascensão.
import type { Custo } from '../src/formulas.ts';

export const QG_ESTADOS = ['oculto', 'ruinas', 'reerguido'] as const;
export type EstadoQg = (typeof QG_ESTADOS)[number];

/** Destino de expedição que revela as Ruínas (o único que some depois de descoberto). */
export const DESTINO_QG = 'ruinas_qg' as const;
/** Id do ponto de interesse do QG no mapa (`pontosDeInteresse` do mapa_meta.json) e do objeto na L4. */
export const PONTO_QG = 'quartel_general' as const;

export const QG = {
  /** Custo de reerguer, em unidades (o jogo converte para micro). Baixo: cabe no que o jogador tem ao descobrir. */
  custoReerguer: { madeira: 80, pedra: 20 } satisfies Custo,
  /** Com o QG oculto há este tempo (desde a criação do reino ou a migração), o Sábio dá a dica. */
  dicaDoSabioAposMs: 8 * 60_000,
} as const;

/** Textos do QG (pt-BR, sem emoji). */
export const TEXTOS_QG = {
  botaoReerguer: 'Reerguer o Quartel General',
  tituloReerguer: 'Reerguer o Quartel General',
  subtituloReerguer: 'Entre as ruínas ainda há um canto com teto.',
  dicaDoSabio: 'As pedras do norte guardam algo mais antigo que a vila.',
  descobertaCronica: 'O grupo encontrou as Ruínas do Quartel General.',
  recuoComDescoberta: 'O grupo recuou, mas as Ruínas do Quartel General foram encontradas.',
  reerguidoCronica: 'O Quartel General foi reerguido.',
  /** Pontos de entrada futuros (Portão 22) enquanto o QG não foi reerguido. */
  bloqueado: 'Explore as Ruínas do Quartel General, ao norte da vila.',
  /** Toque no QG já reerguido, até a tela da Tropa e da Mesa de Guerra chegarem (Portão 22). */
  reerguidoAviso: 'O Quartel General está de pé. A Tropa e a Mesa de Guerra chegam em breve.',
  descricaoDestino: 'Brasões e muros caídos ao norte da vila.',
} as const;
