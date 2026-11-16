// Mapa grande fixo (A13): esquema do mapa_meta.json e o mapa do jogo lido
// dele. Front e back leem o mesmo arquivo; o servidor confere o clique contra
// a lista `clicaveis` (seção 5b), nunca contra o que o cliente diz.

import { z } from 'zod';
import { OFICIOS, type Oficio } from '../../data/aventureiros.ts';
import type { TipoConstrucao } from '../../data/construcoes.ts';
import { DESTINOS_IDS, type DestinoId } from '../../data/expedicoes.ts';
import {
  ESCALA, LADO_SPRITE_ALDEAO, PE_ALTURA_PERMIL, POSICOES_ALDEOES, POSICOES_OCIOSOS, PROPS_NUCLEO, RECURSO_DO_CLICAVEL, TILE, VERSAO_MAPA_ATUAL, VERSOES_MAPA,
  type TipoClicavel, type TipoObjeto, type VersaoMapa,
} from '../../data/mapa.ts';
import bruto from '../../data/mapa_meta.json' with { type: 'json' };
import type { Recurso } from '../../data/recursos.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../../data/slots.ts';

/** Tamanho da imagem (seção 2): 96 x 72 tiles de 32. */
export const LARGURA_MAPA = 3072;
export const ALTURA_MAPA = 2304;

const inteiro = z.number().int();
const ponto = z.strictObject({ x: z.number(), y: z.number() });
/** Retângulo em px de mundo: x0, y0 inclusivos; x1, y1 exclusivos. */
const retangulo = z
  .strictObject({ x0: inteiro, y0: inteiro, x1: inteiro, y1: inteiro })
  .refine((r) => r.x1 > r.x0 && r.y1 > r.y0, 'retângulo vazio');

const esquemaDestino = z.strictObject({
  tipo: z.enum(['expedicao', 'poi']),
  tile: z.tuple([inteiro.min(0), inteiro.min(0)]),
  x: inteiro,
  y: inteiro,
});

const esquemaClicavel = z.strictObject({
  id: z.string().regex(/^[ap]\d{4}$/),
  tipo: z.enum(Object.keys(RECURSO_DO_CLICAVEL) as [TipoClicavel, ...TipoClicavel[]]),
  variante: z.string().regex(/^[a-z_]+$/),
  /** Quadro do sprite desenhado na imagem (0 ou 1): escolhe o contorno do hover. */
  quadro: z.union([z.literal(0), z.literal(1)]),
  /** Pé do sprite, em mundo. */
  x: inteiro,
  y: inteiro,
  /** Caixa do sprite, em px: só para o teste de clique. */
  w: inteiro.min(1),
  h: inteiro.min(1),
  /** Canto superior esquerdo do contorno do hover (contornos/<variante>_<quadro>.png), em mundo. */
  cx: inteiro,
  cy: inteiro,
});

type Ret = z.infer<typeof retangulo>;
const dentro = (r: Ret, x: number, y: number) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const contido = (de: Ret, em: Ret) => de.x0 >= em.x0 && de.y0 >= em.y0 && de.x1 <= em.x1 && de.y1 <= em.y1;

/**
 * Esquema do mapa_meta.json (seção 1). Campos que o jogo não usa (como a
 * `semente` da ferramenta que fez o mapa) são ignorados.
 */
/** Árvore desenhada por cima da imagem (versão 2): todas as da arte, clicáveis ou não. */
const esquemaArvore = z.strictObject({
  id: z.string().regex(/^t\d{4}$/),
  variante: z.string().regex(/^[a-z_]+$/),
  /** Desenho pintado (0 ou 1): o mesmo do contorno do hover. */
  quadro: z.union([z.literal(0), z.literal(1)]),
  /** Pé, em mundo. */
  x: inteiro,
  y: inteiro,
  /** Canto superior esquerdo do sprite, em mundo. */
  ox: inteiro,
  oy: inteiro,
  /** Id do item em `clicaveis`, ou null (decorativa). */
  clicavel: z.string().nullable(),
});

/** Balanço das árvores: quadros e duração de cada um (k = 1..quadros). */
const esquemaBalanco = z
  .strictObject({ quadros: z.number().int().min(1), duracoesMs: z.array(z.number().int().positive()), arquivos: z.string() })
  .refine((b) => b.duracoesMs.length === b.quadros, 'balanco: duracoesMs com tamanho diferente de quadros');

export const esquemaMetaMapa = z
  .object({
    versaoMapa: z.literal(VERSAO_MAPA_ATUAL),
    tile: z.literal(TILE),
    largura: z.literal(LARGURA_MAPA),
    altura: z.literal(ALTURA_MAPA),
    jogavel: retangulo,
    nucleo: retangulo,
    origemNucleo: z.strictObject({ x: inteiro, y: inteiro }),
    destinos: z.record(z.string(), esquemaDestino),
    minasAbandonadas: z.array(ponto),
    lagoGrande: z.strictObject({ cx: z.number(), cy: z.number(), rx: z.number(), ry: z.number() }),
    clicaveis: z.array(esquemaClicavel),
    easterEggs: z.record(z.string(), ponto),
    arvores: z.array(esquemaArvore),
    balanco: esquemaBalanco,
  })
  .superRefine((m, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: 'custom', message });
    const mundo = { x0: 0, y0: 0, x1: m.largura, y1: m.altura };
    if (!contido(m.jogavel, mundo)) erro('área jogável fora da imagem');
    if (!contido(m.nucleo, m.jogavel)) erro('núcleo fora da área jogável');
    for (const [id, d] of Object.entries(m.destinos)) {
      if (!dentro(m.jogavel, d.x, d.y)) erro(`destino ${id} fora da área jogável`);
    }
    for (const id of DESTINOS_IDS) {
      if (m.destinos[id]?.tipo !== 'expedicao') erro(`destino de expedição ausente: ${id}`);
    }
    for (const [id, d] of Object.entries(m.destinos)) {
      if (d.tipo === 'expedicao' && !(DESTINOS_IDS as readonly string[]).includes(id)) erro(`destino de expedição desconhecido: ${id}`);
    }
    const ids = new Set<string>();
    for (const c of m.clicaveis) {
      if (ids.has(c.id)) erro(`clicável repetido: ${c.id}`);
      ids.add(c.id);
      if (c.id[0] !== (c.tipo === 'arvore' ? 'a' : 'p')) erro(`prefixo do id não bate com o tipo: ${c.id}`);
      if (!dentro(mundo, c.x, c.y)) erro(`clicável fora da imagem: ${c.id}`);
      // O contorno começa em cima e à esquerda da caixa (ele a envolve).
      const cx0 = c.x - Math.floor(c.w / 2);
      if (c.cx > cx0 || c.cy > c.y - c.h) erro(`contorno não envolve a caixa: ${c.id}`);
    }
    // Árvores: ids únicos, em ordem de pé (y), e cada árvore clicável aparece uma vez, no mesmo pé e desenho.
    const clicaveis = new Map(m.clicaveis.map((c) => [c.id, c]));
    const ligadas = new Set<string>();
    const idsArvores = new Set<string>();
    m.arvores.forEach((a, i) => {
      if (idsArvores.has(a.id)) erro(`árvore repetida: ${a.id}`);
      idsArvores.add(a.id);
      if (i > 0 && a.y < m.arvores[i - 1]!.y) erro(`árvores fora da ordem de y: ${a.id}`);
      if (!a.clicavel) return;
      const c = clicaveis.get(a.clicavel);
      if (!c || c.tipo !== 'arvore') return erro(`árvore ${a.id} aponta para clicável inexistente: ${a.clicavel}`);
      if (ligadas.has(a.clicavel)) erro(`clicável ligado a duas árvores: ${a.clicavel}`);
      ligadas.add(a.clicavel);
      if (c.x !== a.x || c.y !== a.y || c.variante !== a.variante || c.quadro !== a.quadro) erro(`árvore ${a.id} não bate com ${a.clicavel}`);
    });
    for (const c of m.clicaveis) if (c.tipo === 'arvore' && !ligadas.has(c.id)) erro(`clicável sem árvore desenhada: ${c.id}`);
    // Os slots (spec do mapa, seção 5, somando a origem) caem dentro do núcleo.
    for (const id of SLOT_IDS) {
      const x = SLOTS[id].x + m.origemNucleo.x;
      const y = SLOTS[id].y + m.origemNucleo.y;
      if (!dentro(m.nucleo, x, y)) erro(`slot fora do núcleo: ${id}`);
    }
  });

export type MetaMapa = z.infer<typeof esquemaMetaMapa>;

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface PontoMapa {
  x: number;
  y: number;
}

/** Destino de expedição: centro do ponto no mapa, em mundo. */
export interface DestinoMapa extends PontoMapa {
  id: DestinoId;
}

/** Ponto decorativo (Acampamento, Menires...): sem pin e sem clique na v0. */
export interface PoiMapa extends PontoMapa {
  id: string;
}

/** Árvore ou pedra da imagem que rende recurso no clique (seção 5b). */
export interface ClicavelMapa {
  id: string;
  tipo: TipoClicavel;
  variante: string;
  recurso: Recurso;
  /** Pé do sprite, em mundo. */
  x: number;
  y: number;
  /** Caixa do sprite na imagem, em mundo: hitbox do clique. */
  caixa: Retangulo;
  /** Contorno do hover: sprite contornos/<nome>.png com o canto em (x, y), em mundo. */
  contorno: { nome: string; x: number; y: number };
}

export interface SlotMapa {
  id: SlotId;
  tipo: TipoConstrucao;
  /** Canto superior esquerdo, em mundo (já com a origem do núcleo). */
  x: number;
  y: number;
}

/** Prop do núcleo desenhado por cima da imagem (L4). */
export interface PropMapa {
  id: string;
  tipo: TipoObjeto;
  /** Pé (centro horizontal, 90% da altura), em mundo. */
  x: number;
  y: number;
}

/** Lugar do aldeão de um ofício na Vila (L4). */
export interface LugarAldeao {
  oficio: Oficio;
  /** Pé (centro horizontal, 90% da altura), em mundo. */
  x: number;
  y: number;
}

/** Árvore da L4 (versão 2): sprite arvores/<variante>_<quadro>_<k>.png com o canto em (ox, oy). */
export interface ArvoreMapa {
  id: string;
  variante: string;
  /** Desenho pintado (0 ou 1). */
  quadro: 0 | 1;
  /** Pé, em mundo. */
  x: number;
  y: number;
  ox: number;
  oy: number;
  /** Id do clicável (clique e hover), ou null. */
  clicavel: string | null;
}

/** O mapa do jogo: o mesmo para todos os jogadores e ciclos. */
export interface MapaJogo {
  versao: VersaoMapa;
  largura: number;
  altura: number;
  jogavel: Retangulo;
  nucleo: Retangulo;
  origemNucleo: PontoMapa;
  destinos: readonly DestinoMapa[];
  pois: readonly PoiMapa[];
  clicaveis: readonly ClicavelMapa[];
  slots: readonly SlotMapa[];
  props: readonly PropMapa[];
  /** Um lugar por ofício, na ordem do rodízio (OFICIOS). */
  aldeoes: readonly LugarAldeao[];
  /** Lugares dos Ociosos em volta da fogueira (pé, em mundo), na ordem em que são ocupados. */
  ociosos: readonly PontoMapa[];
  /** Árvores desenhadas por cima da imagem, em ordem de pé. */
  arvores: readonly ArvoreMapa[];
  /** Balanço das árvores: duração de cada quadro (k = 1..n). */
  balanco: { duracoesMs: readonly number[] };
}

const paraRet = (r: Ret): Retangulo => ({ x: r.x0, y: r.y0, largura: r.x1 - r.x0, altura: r.y1 - r.y0 });

/**
 * Caixa do clicável a partir do pé e de w x h: centrada no x do pé, com a
 * base no y do pé (conferida na imagem, Portão 7c).
 */
export function caixaDoClicavel(c: { x: number; y: number; w: number; h: number }): Retangulo {
  return { x: c.x - Math.floor(c.w / 2), y: c.y - c.h, largura: c.w, altura: c.h };
}

/** Monta o mapa do jogo a partir de um meta já validado. */
export function mapaDoMeta(m: MetaMapa): MapaJogo {
  const O = m.origemNucleo;
  const contagem = new Map<string, number>();
  return {
    versao: m.versaoMapa,
    largura: m.largura,
    altura: m.altura,
    jogavel: paraRet(m.jogavel),
    nucleo: paraRet(m.nucleo),
    origemNucleo: { x: O.x, y: O.y },
    destinos: DESTINOS_IDS.map((id) => ({ id, x: m.destinos[id]!.x, y: m.destinos[id]!.y })),
    pois: Object.entries(m.destinos)
      .filter(([, d]) => d.tipo === 'poi')
      .map(([id, d]) => ({ id, x: d.x, y: d.y })),
    clicaveis: m.clicaveis.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      variante: c.variante,
      recurso: RECURSO_DO_CLICAVEL[c.tipo],
      x: c.x,
      y: c.y,
      caixa: caixaDoClicavel(c),
      contorno: { nome: `${c.variante}_${c.quadro}`, x: c.cx, y: c.cy },
    })),
    slots: SLOT_IDS.map((id) => ({ id, tipo: SLOTS[id].tipo, x: SLOTS[id].x + O.x, y: SLOTS[id].y + O.y })),
    // Mesmos ids do mundo antigo (poco_1, flores_3...): pé no centro, a 90% do lado.
    props: PROPS_NUCLEO.map((p) => {
      const n = (contagem.get(p.tipo) ?? 0) + 1;
      contagem.set(p.tipo, n);
      const lado = ESCALA[p.tipo];
      return {
        id: `${p.tipo}_${n}`,
        tipo: p.tipo,
        x: p.x + O.x + lado / 2,
        y: p.y + O.y + Math.floor((lado * PE_ALTURA_PERMIL) / 1000),
      };
    }),
    aldeoes: OFICIOS.map((oficio) => {
      const p = POSICOES_ALDEOES[oficio];
      const lado = LADO_SPRITE_ALDEAO;
      return { oficio, x: p.x + O.x + lado / 2, y: p.y + O.y + Math.floor((lado * PE_ALTURA_PERMIL) / 1000) };
    }),
    ociosos: POSICOES_OCIOSOS.map((p) => ({ x: p.x + O.x + LADO_SPRITE_ALDEAO / 2, y: p.y + O.y + Math.floor((LADO_SPRITE_ALDEAO * PE_ALTURA_PERMIL) / 1000) })),
    arvores: m.arvores.map((a) => ({ ...a })),
    balanco: { duracoesMs: [...m.balanco.duracoesMs] },
  };
}

/** O meta do projeto, validado na importação (um meta errado não sobe). */
export const META_MAPA: MetaMapa = esquemaMetaMapa.parse(bruto);

/** O mapa do jogo (versão atual do arquivo). */
export const MAPA: MapaJogo = mapaDoMeta(META_MAPA);

/**
 * Mapa de uma versão salva no estado. A 1 e a 2 têm a mesma jogabilidade
 * (a 2 só desenha as árvores por cima da imagem): as duas abrem o mapa atual.
 */
export function mapaDaVersao(v: VersaoMapa): MapaJogo {
  if (!(VERSOES_MAPA as readonly number[]).includes(v)) throw new Error(`versão do mapa desconhecida: ${v}`);
  return MAPA;
}

/** Objetos clicáveis do mapa (id -> recurso), para a ação `clicar`. */
export function objetosDoMapa(m: MapaJogo = MAPA): Record<string, Recurso> {
  const out: Record<string, Recurso> = {};
  for (const c of m.clicaveis) out[c.id] = c.recurso;
  return out;
}
