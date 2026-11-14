'use client';

// Preferências do jogador (Configurações): ficam na conta (/me/preferencias)
// e numa cópia no navegador, que vale enquanto a conta não responde (e evita
// a animação "piscar" ligada antes de ler o que o jogador escolheu).

import { lerPreferencias, PREFERENCIAS_PADRAO, type Preferencias } from '@cronarca/game-core';
import { useCallback } from 'react';
import useSWR from 'swr';
import { atualizar, buscar } from '../api';

export const CHAVE_PREFERENCIAS = '/api/me/preferencias';
const CHAVE_LOCAL = 'cronarca:preferencias';

function lerLocal(): Preferencias | undefined {
  try {
    const bruto = window.localStorage.getItem(CHAVE_LOCAL);
    return bruto ? lerPreferencias(JSON.parse(bruto)) : undefined;
  } catch {
    return undefined;
  }
}

function gravarLocal(p: Preferencias) {
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(p));
  } catch {
    // Sem armazenamento local (janela privada): vale só a da conta.
  }
}

export function usePreferencias() {
  const { data, mutate } = useSWR<Preferencias>(
    CHAVE_PREFERENCIAS,
    async (caminho: string) => {
      const p = lerPreferencias((await buscar<{ preferencias: unknown }>(caminho)).preferencias);
      gravarLocal(p);
      return p;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false, fallbackData: typeof window === 'undefined' ? undefined : lerLocal() },
  );
  const preferencias = data ?? PREFERENCIAS_PADRAO;

  /** Muda na hora (tela e cópia local) e grava na conta; se a conta recusar, volta. */
  const definir = useCallback(
    async (mudanca: Partial<Preferencias>): Promise<boolean> => {
      const nova = { ...preferencias, ...mudanca };
      gravarLocal(nova);
      try {
        await mutate(async () => lerPreferencias((await atualizar<{ preferencias: unknown }>(CHAVE_PREFERENCIAS, nova)).preferencias), {
          optimisticData: nova,
          rollbackOnError: true,
          revalidate: false,
        });
        return true;
      } catch {
        gravarLocal(preferencias);
        return false;
      }
    },
    [preferencias, mutate],
  );

  return { preferencias, definir };
}
