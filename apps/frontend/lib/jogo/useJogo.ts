'use client';

// Estado do jogo no cliente (Portão 10): SWR lê GET /game/state (a cada 30 s
// com a aba visível e de novo ao voltar o foco), o Sincronizador guarda a
// base do servidor e as ações pendentes, e a tela mostra a previsão.

import { mapaDaVersao, objetosDoMapa, type Acao, type Recurso, type VisaoCliente } from '@cronarca/game-core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { buscar, ErroApi } from '../api';
import { textoDoDesfecho, useAvisar } from './avisos';
import { SINCRONIA } from './config';
import { useConfirmador } from './confirmacao';
import { Sincronizador, type CorpoEstado, type Desfecho, type Transporte } from './sincronia';

const ROTA_ESTADO = '/api/game/state';

/** GET do estado medindo a ida e volta (o Sincronizador usa para estimar o relógio do servidor). */
async function buscarEstado(rota: string): Promise<CorpoEstado> {
  const saiu = performance.now();
  const corpo = await buscar<CorpoEstado>(rota);
  return { ...corpo, rttMs: performance.now() - saiu };
}

const transporte: Transporte = async (corpo, sinal) => {
  const res = await fetch('/api/game/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo),
    signal: sinal,
  });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
};

export interface Jogo {
  sinc: Sincronizador;
  /** Base do servidor com as ações previstas (null até o primeiro estado chegar). */
  estado: VisaoCliente | null;
  erro: unknown;
  recarregar: () => void;
  /** Pede o estado de novo e espera a resposta ("Salvar agora"). */
  revalidar: () => Promise<unknown>;
  /** Relógio do servidor, estimado. */
  relogio: () => number;
}

export function useJogo(): Jogo {
  const router = useRouter();
  const objetos = useRef<Readonly<Record<string, Recurso>>>({});
  const [sinc] = useState(
    () =>
      new Sincronizador({
        transporte,
        agoraLocal: () => Date.now(),
        novaChave: () => crypto.randomUUID(),
        agendar: (fn, ms) => setTimeout(fn, ms),
        cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
        objetosDoMapa: () => objetos.current,
      }),
  );

  const { data, error, mutate } = useSWR<CorpoEstado>(ROTA_ESTADO, buscarEstado, {
    refreshInterval: SINCRONIA.atualizarMs,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    if (data) sinc.receberEstado(data);
  }, [data, sinc]);

  useEffect(() => {
    if (error instanceof ErroApi && error.status === 401) router.replace('/login?voltar=/jogo');
  }, [error, router]);

  useSyncExternalStore(
    useCallback((fn: () => void) => sinc.assinar(fn), [sinc]),
    () => sinc.instantaneo,
    () => 0,
  );
  const estado = sinc.estado();

  // Árvores e pedras clicáveis do mapa fixo (para prever cliques).
  const versaoMapa = estado?.mundo.versaoMapa;
  const objetosDoMundo = useMemo(
    () => (versaoMapa === undefined ? {} : objetosDoMapa(mapaDaVersao(versaoMapa))),
    [versaoMapa],
  );
  objetos.current = objetosDoMundo;

  // Fim de expedição: o resultado é secreto, então pede o estado com a volta já resolvida.
  const parada = sinc.proximaParada();
  useEffect(() => {
    if (parada === null) return;
    const id = setTimeout(() => void mutate(), Math.max(0, parada - sinc.agora()) + SINCRONIA.margemFimExpedicaoMs);
    return () => clearTimeout(id);
  }, [parada, mutate, sinc]);

  return { sinc, estado, erro: error, recarregar: () => void mutate(), revalidar: () => mutate(), relogio: () => sinc.agora() };
}

/**
 * Ação que espera o servidor (contratar, expedição, ascender), para o botão
 * de quem chama: trava enquanto envia (clique duplo não manda duas), destrava
 * com erro visível em 10 s, reaproveita a chave de idempotência na nova
 * tentativa depois de queda de rede, e pede confirmação antes de ascender.
 */
export function useAcaoServidor(jogo: Jogo) {
  const avisar = useAvisar();
  const confirmar = useConfirmador();
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [ultimo, setUltimo] = useState<Desfecho | null>(null);
  const travado = useRef(false);
  /** Chave da última tentativa que caiu por rede ou tempo: a mesma ação reaproveita. */
  const pendente = useRef<{ acao: string; chave: string } | null>(null);

  const executar = useCallback(
    async (acao: Acao): Promise<Desfecho | null> => {
      if (travado.current) return null; // clique duplo: o primeiro já está indo
      travado.current = true;
      setEnviando(true);
      try {
        let confirmada = false;
        if (acao.tipo === 'ascender') {
          if (!confirmar) {
            avisar('A confirmação de ascender ainda não está disponível.');
            const d: Desfecho = { ok: false, motivo: 'sem_confirmacao' };
            setUltimo(d);
            return d;
          }
          confirmada = await confirmar({ tipo: 'ascender' });
          if (!confirmada) {
            const d: Desfecho = { ok: false, motivo: 'sem_confirmacao' };
            setUltimo(d);
            return d;
          }
        }
        const id = JSON.stringify(acao);
        const chave = pendente.current?.acao === id ? pendente.current.chave : crypto.randomUUID();
        const d = await jogo.sinc.enviar(acao, { chave, confirmada });
        pendente.current = !d.ok && (d.motivo === 'rede' || d.motivo === 'tempo_esgotado') ? { acao: id, chave } : null;
        const texto = textoDoDesfecho(d);
        if (texto) avisar(texto);
        if (!d.ok && d.motivo === 'sessao') router.replace('/login?voltar=/jogo');
        if (!d.ok && d.motivo === 'conflito') jogo.recarregar();
        setUltimo(d);
        return d;
      } finally {
        travado.current = false;
        setEnviando(false);
      }
    },
    [avisar, confirmar, jogo, router],
  );

  return { executar, enviando, ultimo };
}
