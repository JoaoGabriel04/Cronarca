// Layout do celular (Portão 14): até 600 px de largura (decisão do dono, o
// mesmo limite do mapa estreito). Entre 601 e 1023 px fica o layout empilhado
// do Portão 11; a partir de 1024, o desktop.

'use client';

import { useEffect, useState } from 'react';

export const LARGURA_MAXIMA_CELULAR = 600;
export const CONSULTA_CELULAR = `(max-width: ${LARGURA_MAXIMA_CELULAR}px)`;

/** A mesma regra do CSS (@media (max-width: 600px)), para quem decide em JavaScript. */
export const ehCelular = (larguraJanela: number) => larguraJanela <= LARGURA_MAXIMA_CELULAR;

/** true no celular; acompanha a rotação e o redimensionamento. No servidor (e no 1º quadro), false. */
export function useCelular(): boolean {
  const [celular, setCelular] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(CONSULTA_CELULAR);
    const atualizar = () => setCelular(m.matches);
    atualizar();
    m.addEventListener('change', atualizar);
    return () => m.removeEventListener('change', atualizar);
  }, []);
  return celular;
}
