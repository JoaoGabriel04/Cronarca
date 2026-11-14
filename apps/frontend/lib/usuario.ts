'use client';

import useSWR from 'swr';
import { buscar, ErroApi, type UsuarioPublico } from './api';

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

export interface ProvedoresDisponiveis {
  google: boolean;
  discord: boolean;
}

export function useProvedores() {
  const { data } = useSWR<ProvedoresDisponiveis>('/api/auth/provedores', buscar, {
    revalidateOnFocus: false,
  });
  return data;
}
