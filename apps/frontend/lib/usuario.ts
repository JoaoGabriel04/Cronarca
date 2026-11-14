'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { buscar, ErroApi, type UsuarioPublico } from './api';
import { LIMITE_CONECTANDO_MS, type ProvedoresDisponiveis } from './provedores';

export { estadoProvedor, type EstadoProvedor, type ProvedoresDisponiveis } from './provedores';

export const CHAVE_USUARIO = '/api/auth/me';

/** Usuário logado (null se não houver sessão). undefined enquanto carrega. */
export function useUsuario() {
  const { data, error, isLoading, mutate } = useSWR<UsuarioPublico | null>(
    CHAVE_USUARIO,
    async (caminho: string) => {
      try {
        return (await buscar<{ usuario: UsuarioPublico }>(caminho)).usuario;
      } catch (e) {
        if (e instanceof ErroApi && e.status === 401) return null;
        throw e;
      }
    },
    { revalidateOnFocus: true, shouldRetryOnError: false },
  );
  return { usuario: data, erro: error as Error | undefined, carregando: isLoading, mutate };
}

export function useProvedores() {
  const { data } = useSWR<ProvedoresDisponiveis>('/api/auth/provedores', buscar, {
    revalidateOnFocus: false,
    // Enquanto o backend acorda, tenta de novo a cada 5 s (sem limite de tentativas).
    errorRetryInterval: 5_000,
    errorRetryCount: Number.POSITIVE_INFINITY,
  });
  const [desistiu, setDesistiu] = useState(false);
  useEffect(() => {
    if (data) return;
    const id = setTimeout(() => setDesistiu(true), LIMITE_CONECTANDO_MS);
    return () => clearTimeout(id);
  }, [data]);
  return { dados: data, desistiu };
}
