'use client';

// Avisos curtos ao jogador (erro de rede, conflito, tempo esgotado). Visual
// provisório: os chips e etiquetas da casca chegam no Portão 11.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { textoDaRecusa } from './recusas';
import type { Desfecho } from './sincronia';

const DURACAO_MS = 6_000;

interface Aviso {
  id: number;
  texto: string;
}

const Contexto = createContext<(texto: string) => void>(() => {});

export const useAvisar = () => useContext(Contexto);

/** Texto do aviso para um desfecho ruim; null quando não precisa avisar (ex.: clique recusado, confirmação negada). */
export function textoDoDesfecho(d: Desfecho, op: { silenciarRecusa?: boolean } = {}): string | null {
  if (d.ok) return null;
  switch (d.motivo) {
    case 'conflito':
      return 'O reino mudou enquanto você agia. O estado foi recarregado: confira e tente de novo.';
    case 'tempo_esgotado':
      return 'O servidor demorou a responder. Tente de novo.';
    case 'rede':
      return 'Sem conexão com o servidor. Tente de novo.';
    case 'limite':
      return `Muitas ações seguidas. Espere ${d.esperarS ?? 1} s.`;
    case 'sessao':
      return 'Sua sessão expirou. Entre de novo.';
    case 'sem_confirmacao':
      return null;
    case 'recusada':
      return op.silenciarRecusa ? null : textoDaRecusa(d.erro);
  }
}

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximo = useRef(1);
  const avisar = useCallback((texto: string) => {
    const id = proximo.current++;
    // O mesmo texto não empilha: renova o que já está na tela.
    setAvisos((a) => [...a.filter((x) => x.texto !== texto), { id, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), DURACAO_MS);
  }, []);
  const valor = useMemo(() => avisar, [avisar]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      <div role="status" aria-live="polite" style={{ position: 'fixed', left: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 10 }}>
        {avisos.map((a) => (
          <p key={a.id} className="caixa" style={{ margin: 0, padding: '8px 14px', maxWidth: 420 }}>
            {a.texto}
          </p>
        ))}
      </div>
    </Contexto.Provider>
  );
}
