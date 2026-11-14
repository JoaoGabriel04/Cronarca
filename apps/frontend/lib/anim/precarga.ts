// Pré-carrega todos os quadros do quadros.json no início do jogo (atrás da
// tela de carregamento), para a troca de quadro não piscar. Os da cena do
// Início e do Login (quadros_cena.json) não entram aqui: ver PreCargaCena. As imagens ficam
// guardadas aqui para o navegador manter a decodificação.

import { useEffect, useState } from 'react';
import { todosOsQuadros } from '@cronarca/game-core';

const guardadas: HTMLImageElement[] = [];
let promessa: Promise<void> | null = null;

export function preCarregarQuadros(urls: readonly string[] = todosOsQuadros()): Promise<void> {
  promessa ??= Promise.all(
    urls.map((url) => {
      const img = new Image();
      img.src = url;
      guardadas.push(img);
      // Um quadro que falhar não trava o jogo: aparece no console e a troca dele pode piscar.
      return img.decode().catch(() => console.error('[animação] quadro não carregou:', url));
    }),
  ).then(() => undefined);
  return promessa;
}

/** Pré-carrega sem bloquear nada (cena do Início e do Login): só pede as imagens e as guarda. */
export function preCarregarSemEsperar(urls: readonly string[]): void {
  for (const url of urls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    guardadas.push(img);
  }
}

/** true quando todos os quadros já carregaram. */
export function usePreCarga(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    void preCarregarQuadros().then(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
  }, []);
  return pronto;
}
