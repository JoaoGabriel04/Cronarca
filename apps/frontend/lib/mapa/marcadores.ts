// Trilhas (por baixo da névoa) e pins, rótulos, grupos em marcha, caixas de
// tempo e o aviso da névoa (por cima dela), a partir do mapa fixo (A13) e do
// estado. Funções puras. Posições em mundo; o tamanho na tela é fixo (ver
// desenharMarcadores). A trilha sai do cruzamento do núcleo em linha reta
// até o ponto do destino (spec do mapa, seção 6).

import { nevoasAtivas } from './nevoa';
import {
  DESTINOS, destinoAberto,
  type Classe, type DestinoId, type MapaJogo, type VisaoCliente,
} from '@cronarca/game-core';

export interface PontoMundo {
  x: number;
  y: number;
}

export type EstadoPin = 'ativo' | 'aberto' | 'bloqueado';

export interface Pin {
  id: DestinoId;
  nome: string;
  estado: EstadoPin;
  /** Ponta do pin: centro do tile do destino. */
  ponta: PontoMundo;
}

export interface Trilha {
  expedicao: string;
  pontos: PontoMundo[];
}

export interface GrupoEmMarcha {
  expedicao: string;
  classe: Classe;
  /** Pé do aventureiro, em mundo. */
  pe: PontoMundo;
  restanteMs: number;
}

export interface Obra {
  slot: string;
  /** Centro do topo do slot, em mundo. */
  ancora: PontoMundo;
  restanteMs: number;
}

export interface Marcadores {
  trilhas: Trilha[];
  pins: Pin[];
  grupos: GrupoEmMarcha[];
  obras: Obra[];
  /** Aviso sobre a névoa da Cripta enquanto a pesquisa Estradas Reais não termina. */
  avisoNevoa: { texto: string; centro: PontoMundo } | null;
}

/** Distância entre pontos da trilha, em mundo (spec do mapa, seção 6). */
export const PASSO_TRILHA = 10;

/** O que o mapa precisa do estado (a visão do cliente serve). */
export type EstadoMapa = Pick<VisaoCliente, 'pesquisas' | 'expedicoes' | 'aventureiros' | 'slots'>;

/**
 * Caminho do núcleo até o destino: reta do cruzamento das estradas do
 * núcleo, que fica em origemNucleo + (240, 240) (spec do mapa, seção 6),
 * até o ponto do destino no meta.
 */
export function caminhoAteDestino(m: MapaJogo, id: DestinoId): PontoMundo[] | null {
  const d = m.destinos.find((x) => x.id === id);
  return d ? [{ x: m.origemNucleo.x + 240, y: m.origemNucleo.y + 240 }, { x: d.x, y: d.y }] : null;
}

const distancia = (a: PontoMundo, b: PontoMundo) => Math.hypot(b.x - a.x, b.y - a.y);

/** Pontos a cada `passo` de mundo ao longo da linha poligonal. */
export function amostrar(caminho: readonly PontoMundo[], passo: number): PontoMundo[] {
  const out: PontoMundo[] = [];
  let percorrido = 0;
  let proximo = 0;
  for (let k = 1; k < caminho.length; k++) {
    const a = caminho[k - 1]!;
    const b = caminho[k]!;
    const trecho = distancia(a, b);
    while (proximo <= percorrido + trecho) {
      const t = trecho === 0 ? 0 : (proximo - percorrido) / trecho;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      proximo += passo;
    }
    percorrido += trecho;
  }
  return out;
}

/** Ponto a uma fração (0 a 1) do comprimento do caminho. */
export function pontoNoCaminho(caminho: readonly PontoMundo[], fracao: number): PontoMundo {
  if (caminho.length === 1) return caminho[0]!;
  const trechos = caminho.slice(1).map((b, k) => distancia(caminho[k]!, b));
  let alvo = Math.min(1, Math.max(0, fracao)) * trechos.reduce((x, y) => x + y, 0);
  for (let k = 1; k < caminho.length; k++) {
    const trecho = trechos[k - 1]!;
    if (alvo <= trecho || k === caminho.length - 1) {
      const a = caminho[k - 1]!;
      const b = caminho[k]!;
      const t = trecho === 0 ? 0 : Math.min(1, alvo / trecho);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    alvo -= trecho;
  }
  return caminho[caminho.length - 1]!;
}

/** mm:ss (ou h:mm:ss) do tempo restante, arredondado para cima. */
export function formatarRestante(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function marcadores(m: MapaJogo, e: EstadoMapa, agora: number): Marcadores {
  const emExpedicao = new Set(e.expedicoes.map((x) => x.destino));

  const pins: Pin[] = m.destinos.map((d) => ({
    id: d.id,
    nome: DESTINOS[d.id].nome,
    estado: emExpedicao.has(d.id) ? 'ativo' : destinoAberto(e, d.id) ? 'aberto' : 'bloqueado',
    ponta: { x: d.x, y: d.y },
  }));

  const trilhas: Trilha[] = [];
  const grupos: GrupoEmMarcha[] = [];
  for (const x of e.expedicoes) {
    const caminho = caminhoAteDestino(m, x.destino);
    if (!caminho) continue;
    trilhas.push({ expedicao: x.id, pontos: amostrar(caminho, PASSO_TRILHA) });
    // Ida na primeira metade do tempo, volta na segunda.
    const duracao = Math.max(1, x.fim - x.inicio);
    const p = Math.min(1, Math.max(0, (agora - x.inicio) / duracao));
    const fracao = p < 0.5 ? p * 2 : (1 - p) * 2;
    const lider = e.aventureiros.find((a) => a.id === x.grupo[0]);
    grupos.push({
      expedicao: x.id,
      classe: lider?.classe ?? 'guerreiro',
      pe: pontoNoCaminho(caminho, fracao),
      restanteMs: Math.max(0, x.fim - agora),
    });
  }

  const obras: Obra[] = [];
  for (const s of m.slots) {
    const fim = e.slots[s.id]?.obraAte;
    if (fim === null || fim === undefined) continue;
    obras.push({ slot: s.id, ancora: { x: s.x + 24, y: s.y }, restanteMs: Math.max(0, fim - agora) });
  }

  // Aviso no centro da névoa da Cripta (a mesma regra que decide a névoa).
  const nevoa = nevoasAtivas(e).find((n) => n.destino === 'cripta');
  const avisoNevoa = nevoa ? { texto: 'Estradas Reais', centro: { x: nevoa.x, y: nevoa.y } } : null;

  return { trilhas, pins, grupos, obras, avisoNevoa };
}
