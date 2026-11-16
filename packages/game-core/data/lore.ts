// Lore do Cronarca (Portão 16): todos os textos que contam a história, em
// pt-BR, sem lógica. Textos aprovados pelo dono; não reescrever sem ele.
// Tom: misterioso e um pouco sombrio, medieval. Personagens e símbolos: o
// Relógio (o selo é o seu emblema), o Rei Cinzento (Cripta), o Sábio (guarda os
// livros; é o ofício Sábio e o dono do Scriptorium) e a Falha.
//
// Para acrescentar capítulos (ex.: Portão 21, descoberta do QG): uma entrada a
// mais em CAPITULOS e a condição dela em src/diario.ts. Nunca apagar um id:
// saves guardam os ids liberados.

/** Os 3 cartões do prólogo (no máximo 2 frases cada), com o selo do relógio no topo. */
export const PROLOGO = [
  'O Relógio do Mundo parou numa hora que ninguém lembra. Desde então as eras se arrastam, e cada recomeço custa mais que o anterior.',
  'Você herdou uma aldeia ao pé da Cripta do Rei Cinzento, o último regente do Relógio. Dizem que ele não morreu: ficou à espera.',
  'O Sábio guarda os livros que restaram. Abra as estradas até a Cripta e reivindique a Carta Real.',
] as const;

export interface Capitulo {
  titulo: string;
  /** Até 3 frases. */
  texto: string;
  /** Dica neutra enquanto bloqueado (o capítulo aparece como "?"). null: sempre liberado. */
  dica: string | null;
}

export const CAPITULOS_IDS = [
  'prologo', 'scriptorium', 'cartografia', 'estradas_reais', 'carta_real', 'cripta_vencida', 'aldeoes_40', 'primeira_ascensao', 'falha_3',
] as const;
export type CapituloId = (typeof CAPITULOS_IDS)[number];

/** Capítulos do Diário, na ordem de leitura. */
export const CAPITULOS: Record<CapituloId, Capitulo> = {
  prologo: {
    titulo: 'O Relógio parado',
    texto:
      'Ninguém sabe a hora em que o Relógio do Mundo parou, só que desde então nada avança de verdade e cada recomeço pesa mais. Você recebeu uma aldeia pequena ao pé da Cripta do Rei Cinzento.',
    dica: null,
  },
  scriptorium: {
    titulo: 'Os livros do Sábio',
    texto:
      'O Sábio pôs nas estantes os livros que trouxe nas costas. Diz que neles está o caminho até a Cripta, para quem tiver paciência de lê-los, e que alguns nunca deveriam ser abertos.',
    dica: 'Construa um lugar para os livros.',
  },
  cartografia: {
    titulo: 'O que o mapa esconde',
    texto:
      'Com os mapas refeitos, a mina velha e o pântano voltaram a ter nome. O Sábio apontou uma estrada apagada que corta a floresta rumo à Cripta. Ninguém lembra quem a apagou.',
    dica: 'Conclua uma pesquisa sobre o mapa.',
  },
  estradas_reais: {
    titulo: 'Caminhos até a Cripta',
    texto:
      'As pedras do caminho voltaram a ver o sol. No fim dele, o portão da Cripta está entreaberto, como se esperasse visita. O Sábio pediu que ninguém fosse sozinho.',
    dica: 'Reabra os caminhos antigos.',
  },
  carta_real: {
    titulo: 'A Carta',
    texto:
      'A Carta Real está escrita numa letra que muda quando ninguém olha. Diz que quem governa a aldeia governa a hora, enquanto o Relógio permitir. O selo no fim ainda está quente.',
    dica: 'Conclua a pesquisa que o rei espera.',
  },
  cripta_vencida: {
    titulo: 'O Rei Cinzento',
    texto:
      'O Rei Cinzento não lutou até o fim: baixou a espada e olhou para o Relógio parado. Disse que o trono só espera quem o faça andar. A Cripta ficou em silêncio, mas não vazia.',
    dica: 'Vença o que guarda a Cripta.',
  },
  aldeoes_40: {
    titulo: 'A aldeia cheia',
    texto:
      'Quarenta vozes na mesma noite, em volta da fogueira. O Sábio conta histórias de eras que ninguém viveu, e todos juram que já as ouviram.',
    dica: 'Encha as Casas de gente.',
  },
  primeira_ascensao: {
    titulo: 'O Relógio gira de volta',
    texto:
      'Você fez o Relógio andar, e ele andou para trás. A aldeia recomeçou do nada, mas as relíquias e a memória ficaram. O Sábio jura que se lembra de você.',
    dica: 'Ascenda pela primeira vez.',
  },
  falha_3: {
    titulo: 'Rachaduras',
    texto:
      'A cada recomeço, o Relógio falha mais. As obras demoram, os livros custam caro, e há rachaduras no mostrador que ninguém viu surgir. O Sábio parou de dizer que tudo vai ficar bem.',
    dica: 'Recomece mais vezes.',
  },
};

/** Linha da Crônica quando um capítulo é liberado. */
export const textoNovaPagina = (titulo: string) => `Nova página no Diário: ${titulo}.`;

/** Voz do Sábio no painel do Objetivo: prefixo e as falas fixas (os números vêm dos dados). */
export const SABIO = {
  prefixo: 'O Sábio diz:',
  guardeOuro: (ouro: string, pesquisa: string) => `guarde ${ouro} de ouro para as ${pesquisa}.`,
} as const;
