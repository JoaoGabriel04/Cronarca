'use client';

// Ajuda curta dentro de um cartão (portão de ajustes rápidos): uma linha com o
// ícone CircleHelp que abre um parágrafo logo abaixo. É um <details> nativo
// (teclado e leitor de tela sem código extra); Escape fecha. No celular a linha
// tem 44 px de altura. Sem dica de hover: no toque ela não abre.

import { CircleHelp } from 'lucide-react';
import { useRef } from 'react';
import estilos from './casca.module.css';

export function Ajuda({ rotulo, texto }: { rotulo: string; texto: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={estilos.ajudaCartao}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && ref.current?.open) {
          ref.current.open = false;
          e.stopPropagation();
        }
      }}
    >
      <summary className={estilos.ajudaBotao}>
        <CircleHelp size={16} strokeWidth={2.5} aria-hidden="true" />
        {rotulo}
      </summary>
      <p className={estilos.ajudaTexto}>{texto}</p>
    </details>
  );
}
