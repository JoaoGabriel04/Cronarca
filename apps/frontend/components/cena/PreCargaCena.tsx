'use client';

// Pré-carrega os quadros dos sprites da cena depois da primeira pintura (com o
// navegador ocioso): o quadro 1 já vem na própria <img>; os demais chegam antes
// da primeira troca, sem segurar o primeiro desenho do Início e do Login.

import { quadrosDaCena } from '@cronarca/game-core';
import { useEffect } from 'react';
import { preCarregarSemEsperar } from '../../lib/anim/precarga';

export function PreCargaCena({ nomes }: { nomes: readonly string[] }) {
  useEffect(() => {
    const carregar = () => preCarregarSemEsperar(quadrosDaCena(nomes));
    // Safari não tem requestIdleCallback: um atraso curto basta.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(carregar, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(carregar, 200);
    return () => clearTimeout(id);
  }, [nomes]);
  return null;
}
