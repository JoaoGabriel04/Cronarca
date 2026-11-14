// "+N" do clique (handoff, Interação com o mapa, item 7): o ícone do recurso
// (16 px, a 1x) e o valor sobem cerca de 32 px em 600 ms e somem. Camada HTML
// por cima do canvas, animada com GSAP. Pool de elementos: cliques rápidos no
// mesmo objeto somam o valor no elemento que ainda está no ar.

import type { Recurso } from '@cronarca/game-core';
import { gsap } from 'gsap';

const TAMANHO_POOL = 12;
const SUBIDA_PX = 32;
const DURACAO_S = 0.6;

interface Elemento {
  raiz: HTMLDivElement;
  icone: HTMLImageElement;
  texto: HTMLSpanElement;
  chave: string | null;
  valor: number;
  ocupado: boolean;
}

export class EfeitosClique {
  private readonly pool: Elemento[] = [];

  constructor(private readonly camada: HTMLElement, private readonly formatar: (valor: number) => string) {
    for (let k = 0; k < TAMANHO_POOL; k++) {
      const raiz = document.createElement('div');
      raiz.style.cssText =
        'position:absolute;left:0;top:0;display:none;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;' +
        'font:500 12px var(--fonte-numero),monospace;color:#ffd060;text-shadow:1px 0 #1a100a,-1px 0 #1a100a,0 1px #1a100a,0 -1px #1a100a;';
      const icone = document.createElement('img');
      icone.width = 16;
      icone.height = 16;
      icone.alt = '';
      icone.style.imageRendering = 'pixelated';
      const texto = document.createElement('span');
      raiz.append(icone, texto);
      camada.append(raiz);
      this.pool.push({ raiz, icone, texto, chave: null, valor: 0, ocupado: false });
    }
  }

  /** Mostra (ou soma no que já está no ar para a mesma chave) o "+N" no ponto da tela. */
  mostrar(chave: string, recurso: Recurso, valor: number, x: number, y: number) {
    let el = this.pool.find((e) => e.ocupado && e.chave === chave);
    if (el) {
      el.valor += valor;
    } else {
      // Livre, ou o mais antigo (o primeiro do pool) se todos estiverem no ar.
      el = this.pool.find((e) => !e.ocupado) ?? this.pool[0]!;
      el.chave = chave;
      el.valor = valor;
      el.icone.src = `/icones/icone-${recurso}.png`;
      el.raiz.style.left = `${Math.round(x)}px`;
      el.raiz.style.top = `${Math.round(y)}px`;
    }
    el.ocupado = true;
    el.texto.textContent = `+${this.formatar(el.valor)}`;
    el.raiz.style.display = 'flex';
    gsap.killTweensOf(el.raiz);
    const alvo = el;
    gsap.fromTo(
      el.raiz,
      { x: '-50%', y: -8, opacity: 1 },
      {
        y: -8 - SUBIDA_PX,
        opacity: 0,
        duration: DURACAO_S,
        ease: 'power1.out',
        onComplete: () => {
          alvo.ocupado = false;
          alvo.chave = null;
          alvo.raiz.style.display = 'none';
        },
      },
    );
  }

  /**
   * O clique não rendeu porque o recurso está no teto do armazém: o mesmo
   * ícone sobe com "Cheio" em vez do "+N", para o clique não parecer perdido.
   */
  mostrarCheio(chave: string, recurso: Recurso, x: number, y: number) {
    this.mostrar(chave, recurso, 0, x, y);
    const el = this.pool.find((e) => e.ocupado && e.chave === chave);
    if (el) el.texto.textContent = 'Cheio';
  }

  /** O servidor recusou: o "+N" dessa chave some na hora (handoff, item 7). */
  cancelar(chave: string) {
    const el = this.pool.find((e) => e.ocupado && e.chave === chave);
    if (!el) return;
    gsap.killTweensOf(el.raiz);
    el.ocupado = false;
    el.chave = null;
    el.raiz.style.display = 'none';
  }

  destruir() {
    for (const e of this.pool) {
      gsap.killTweensOf(e.raiz);
      e.raiz.remove();
    }
  }
}
