// Animação dos sprites (Portão Animação): de 2 a 6 quadros por sprite, cada
// um com sua duração. A fonte da verdade é data/quadros.json (jogo) e
// data/quadros_cena.json (cena do Início e do Login); aqui ficam só o
// esquema, o catálogo e o relógio (funções puras, sem timer).

import { z } from 'zod';
import bruto from '../data/quadros.json' with { type: 'json' };
import brutoCena from '../data/quadros_cena.json' with { type: 'json' };

const esquemaSprite = z
  .strictObject({
    quadros: z.number().int().min(1),
    duracoesMs: z.array(z.number().int().positive()).min(1),
    tamanho: z.union([z.literal(16), z.literal(32), z.literal(48), z.literal(64)]),
    arquivos: z.array(z.string().regex(/^[a-z0-9_]+_[1-9]\.png$/)).min(1),
  })
  .refine((s) => s.duracoesMs.length === s.quadros && s.arquivos.length === s.quadros, 'quadros, duracoesMs e arquivos com tamanhos diferentes');

// Nomes com dígitos (pinho0, arbusto1): variantes da cena.
export const esquemaQuadros = z.record(z.string().regex(/^[a-z]+$/), z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), esquemaSprite));
export type DadosQuadros = z.infer<typeof esquemaQuadros>;

export interface Animacao {
  /** "grupo/nome", como no quadros.json. */
  chave: string;
  /** Endereço público de cada quadro, na ordem (/sprites/<grupo>/<arquivo>). */
  quadros: readonly string[];
  duracoesMs: readonly number[];
  /** Soma das durações. */
  cicloMs: number;
  tamanho: number;
}

/** Pasta pública dos quadros (apps/frontend/public/sprites/<grupo>/). */
export const urlDoQuadro = (grupo: string, arquivo: string) => `/sprites/${grupo}/${arquivo}`;

export function montarCatalogo(dados: DadosQuadros): ReadonlyMap<string, Animacao> {
  const out = new Map<string, Animacao>();
  for (const [grupo, sprites] of Object.entries(dados)) {
    for (const [nome, s] of Object.entries(sprites)) {
      out.set(`${grupo}/${nome}`, {
        chave: `${grupo}/${nome}`,
        quadros: s.arquivos.map((a) => urlDoQuadro(grupo, a)),
        duracoesMs: s.duracoesMs,
        cicloMs: s.duracoesMs.reduce((a, b) => a + b, 0),
        tamanho: s.tamanho,
      });
    }
  }
  return out;
}

export const QUADROS: DadosQuadros = esquemaQuadros.parse(bruto);
/** Cena do Início e do Login (grupo "cena"): não entra no pré-carregamento do jogo. */
export const QUADROS_CENA: DadosQuadros = esquemaQuadros.parse(brutoCena);
/** Só os sprites do jogo: o que a tela de carregamento de /jogo espera. */
export const ANIMACOES_JOGO: ReadonlyMap<string, Animacao> = montarCatalogo(QUADROS);
/** Catálogo para consulta (jogo + cena). */
export const ANIMACOES: ReadonlyMap<string, Animacao> = montarCatalogo({ ...QUADROS, ...QUADROS_CENA });

/**
 * Ids do jogo que têm outro nome no quadros.json (os arquivos não são
 * renomeados): grupo -> id do jogo -> nome do sprite.
 */
export const EQUIVALENCIA_SPRITES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  expedicao: { floresta_lobos: 'floresta' },
  evento: { festival_colheita: 'festival' },
};

/** Animação de um sprite pelo grupo e pelo id do jogo (ou o nome do sprite). Falha se não existir. */
export function animacao(grupo: string, id: string): Animacao {
  const nome = EQUIVALENCIA_SPRITES[grupo]?.[id] ?? id;
  const a = ANIMACOES.get(`${grupo}/${nome}`);
  if (!a) throw new Error(`sprite sem animação no quadros.json: ${grupo}/${nome}`);
  return a;
}

/** Todos os quadros dos sprites do jogo (para o pré-carregamento de /jogo). */
export const todosOsQuadros = (catalogo: ReadonlyMap<string, Animacao> = ANIMACOES_JOGO): string[] => [...catalogo.values()].flatMap((a) => a.quadros);

/** Quadros de alguns sprites da cena (para o pré-carregamento do Início e do Login). */
export const quadrosDaCena = (nomes: readonly string[]): string[] => nomes.flatMap((n) => animacao('cena', n).quadros);

/**
 * Índice (base 0) do quadro que cobre o instante t no ciclo: o primeiro cuja
 * soma acumulada das durações passa de t % ciclo. Vale para t negativo.
 */
export function indiceNoTempo(duracoesMs: readonly number[], t: number): number {
  const ciclo = duracoesMs.reduce((a, b) => a + b, 0);
  let r = ((Math.floor(t) % ciclo) + ciclo) % ciclo;
  for (let i = 0; i < duracoesMs.length; i++) {
    if (r < duracoesMs[i]!) return i;
    r -= duracoesMs[i]!;
  }
  return duracoesMs.length - 1;
}

/** Hash FNV-1a de 32 bits (estável entre cliente e testes). */
function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deslocamento de fase de uma instância, em ms, dentro do ciclo: derivado do id. */
export const faseDe = (id: string, cicloMs: number): number => fnv1a(id) % cicloMs;

/**
 * Endereço do quadro na tela no instante t (ms do relógio global) para uma
 * instância com fase; sem animação (preferência ou prefers-reduced-motion), o quadro 1.
 */
export function quadroNoTempo(a: Animacao, t: number, fase = 0, animado = true): string {
  return animado ? a.quadros[indiceNoTempo(a.duracoesMs, t + fase)]! : a.quadros[0]!;
}

/** Sprite animado de uma tela: grupo do quadros.json e o id do jogo (ou o nome do sprite). */
export interface RefSprite {
  grupo: string;
  id: string;
}
