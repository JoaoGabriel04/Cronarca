'use client';

// Confirmação das ações sem volta (ascender). Quem pede a ação chama o
// confirmador e espera; o Modal de Ascensão (Portão 13) lê o pedido pendente
// e responde. Sem provedor, não há confirmador: a ação não sai (o mecanismo
// nunca manda ascender sem um "sim").

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface PedidoConfirmacao {
  tipo: 'ascender';
}

/** Pergunta ao jogador; resolve true só com confirmação explícita. */
export type Confirmador = (pedido: PedidoConfirmacao) => Promise<boolean>;

export const ContextoConfirmacao = createContext<Confirmador | null>(null);

export const useConfirmador = () => useContext(ContextoConfirmacao);

interface Pendente {
  pedido: PedidoConfirmacao | null;
  /** Fecha o pedido: true só pelo botão de confirmar do modal. */
  responder: (sim: boolean) => void;
}

const ContextoPendente = createContext<Pendente>({ pedido: null, responder: () => {} });

/** O pedido esperando resposta (para o modal), e como responder. */
export const usePedidoConfirmacao = () => useContext(ContextoPendente);

export function ProvedorConfirmacao({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const resolver = useRef<((sim: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmador>((p) => {
    // Um pedido novo cancela o anterior (nunca dois "sim" com um clique).
    resolver.current?.(false);
    setPedido(p);
    return new Promise<boolean>((r) => {
      resolver.current = r;
    });
  }, []);

  const responder = useCallback((sim: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setPedido(null);
    r?.(sim);
  }, []);

  const pendente = useMemo(() => ({ pedido, responder }), [pedido, responder]);

  return (
    <ContextoConfirmacao.Provider value={confirmar}>
      <ContextoPendente.Provider value={pendente}>{children}</ContextoPendente.Provider>
    </ContextoConfirmacao.Provider>
  );
}
