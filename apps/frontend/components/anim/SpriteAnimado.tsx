'use client';

// Sprite animado fora do mapa (painéis, modais, telas, carregamento). Nada de
// timer por sprite: um único requestAnimationFrame percorre os sprites na tela
// e troca o src da imagem só quando o quadro muda (sem render do React).
// Quadros e durações vêm do quadros.json; a fase sai do id da instância.

import { useEffect, useRef } from 'react';
import { animacao, faseDe, quadroNoTempo, type Animacao, type RefSprite } from '@cronarca/game-core';
import { animacaoLigada } from '../../lib/anim/movimento';

interface Registro {
  img: HTMLImageElement;
  anim: Animacao;
  fase: number;
  animado: boolean;
  atual: string;
}

const registros = new Set<Registro>();
let pedido = 0;

function laco() {
  const t = Date.now();
  const ligada = animacaoLigada();
  for (const r of registros) {
    const q = quadroNoTempo(r.anim, t, r.fase, r.animado && ligada);
    if (q !== r.atual) {
      r.atual = q;
      r.img.src = q;
    }
  }
  pedido = registros.size ? requestAnimationFrame(laco) : 0;
}

function registrar(r: Registro): () => void {
  registros.add(r);
  if (!pedido) pedido = requestAnimationFrame(laco);
  return () => void registros.delete(r);
}

export interface PropsSpriteAnimado {
  sprite: RefSprite;
  /** Lado na tela, em px CSS (múltiplo inteiro do lado do sprite). */
  lado: number;
  /** Id da instância para a fase (dois iguais na tela não andam juntos); sem ele, o do sprite. */
  instancia?: string;
  /** Preferência "Animações dos sprites"; desligada, quadro 1. */
  animado?: boolean;
  className?: string;
}

export function SpriteAnimado({ sprite, lado, instancia, animado = true, className }: PropsSpriteAnimado) {
  const anim = animacao(sprite.grupo, sprite.id);
  const fase = faseDe(instancia ?? anim.chave, anim.cicloMs);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    return registrar({ img, anim, fase, animado, atual: img.getAttribute('src') ?? '' });
  }, [anim, fase, animado]);
  // O src do React fica no quadro 1 (não muda entre renders); o laço troca o do elemento.
  return <img ref={ref} className={className} src={anim.quadros[0]} width={lado} height={lado} alt="" draggable={false} />;
}
