'use client';

// Abas (Vila, Heróis, Expedições, Eras) e o indicador "Salvo há" (Figma, linha
// das abas). O conteúdo de Heróis, Expedições e Eras chega no Portão 12.

import type { ReactNode } from 'react';
import type { Sincronia } from '../../lib/casca/dados';
import { textoSalvo } from '../../lib/casca/dados';
import estilos from './casca.module.css';
import { Icone } from './Icone';

export type Aba = 'vila' | 'herois' | 'expedicoes' | 'eras';

export const ABAS: readonly { id: Aba; nome: string; icone: string }[] = [
  { id: 'vila', nome: 'Vila', icone: 'icone-construir' },
  { id: 'herois', nome: 'Heróis', icone: 'icone-aventureiro' },
  { id: 'expedicoes', nome: 'Expedições', icone: 'icone-expedicao' },
  { id: 'eras', nome: 'Eras', icone: 'icone-ascensao' },
];

/** Linha das abas (no desktop, com o "Salvo há" à direita; abaixo de 1024 px, no rodapé). */
export function Abas({ ativa, aoTrocar, children }: { ativa: Aba; aoTrocar: (a: Aba) => void; children?: ReactNode }) {
  return (
    <nav className={estilos.abas} aria-label="Telas do jogo">
      {ABAS.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`caixa ${estilos.aba} ${a.id === ativa ? estilos.ativa : ''}`}
          aria-current={a.id === ativa ? 'page' : undefined}
          onClick={() => a.id !== ativa && aoTrocar(a.id)}
        >
          <Icone nome={a.icone} />
          {a.nome}
        </button>
      ))}
      {children}
    </nav>
  );
}

export function IndicadorSalvo({ sincronia, agoraLocal }: { sincronia: Sincronia; agoraLocal: number }) {
  const s = textoSalvo(sincronia, agoraLocal);
  return (
    <p className={estilos.salvo} role="status" aria-live="polite">
      <Icone nome={`icone-${s.icone}`} />
      {s.texto}
    </p>
  );
}
