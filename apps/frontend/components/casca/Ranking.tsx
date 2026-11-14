'use client';

// Modal Ranking (Portão 15, Figma "Modal Ranking - Desktop/Mobile"). Lê
// GET /ranking (SWR) só enquanto aberto; o servidor decide posição, nome e
// valores. No celular vira folha de baixo, como os demais modais.

import { esquemaRespostaRanking, type AbaRanking } from '@cronarca/game-core';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { buscar } from '../../lib/api';
import { abasRanking, dadosRanking, rotaRanking, textoAtualizado, type LinhaTela } from '../../lib/casca/ranking';
import { Icone } from './Icone';
import { Modal } from './Modal';
import estilos from './modais.module.css';

/** A lista muda só nos marcos; reler a cada minuto com o modal aberto basta. */
const RELER_MS = 60_000;

async function buscarRanking(caminho: string) {
  return { r: esquemaRespostaRanking.parse(await buscar<unknown>(caminho)), recebidoEm: Date.now() };
}

function Linha({ l }: { l: LinhaTela }) {
  return (
    <div role="row" className={`caixa ${estilos.linhaRanking} ${l.voce ? estilos.voce : ''}`} aria-current={l.voce ? 'true' : undefined}>
      <span role="cell" className={estilos.colPosicao}>
        <span className={l.selo ? `${estilos.seloPosicao} ${estilos[`selo_${l.selo}`]}` : undefined}>{l.posicao}</span>
      </span>
      <span role="cell" className={estilos.colNome}>
        {l.voce ? (
          <>
            <span className={estilos.soLargo}>{l.nome}</span>
            <span className={estilos.soCelular}>Você</span>
          </>
        ) : (
          l.nome
        )}
      </span>
      <span role="cell" className={estilos.colEra}>{l.era}</span>
      <span role="cell" className={estilos.colCiclo}>{l.ciclo}</span>
      <span role="cell" className={estilos.colReliquias}>
        <Icone nome="icone-reliquia" tamanho={16} className={estilos.soLargo} />
        {l.reliquias}
      </span>
      <span role="cell" className={estilos.colTempo}>{l.tempo}</span>
    </div>
  );
}

export function ModalRanking({ eraDoJogador, aoFechar }: { eraDoJogador: number; aoFechar: () => void }) {
  const [aba, setAba] = useState<AbaRanking>('geral');
  const { data, error, isLoading } = useSWR(rotaRanking(aba), buscarRanking, {
    refreshInterval: RELER_MS,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  // O "há N min" anda sozinho entre uma leitura e outra.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const dados = data ? dadosRanking(data.r) : null;
  const subtitulo = `Jogadores por era e ciclo · ${data ? textoAtualizado(data.recebidoEm, Math.max(agora, data.recebidoEm)) : 'carregando…'}`;

  return (
    <Modal titulo="Ranking" subtitulo={subtitulo} largura="ranking" aoFechar={aoFechar}>
      <div className={estilos.abasRanking} role="group" aria-label="Lista">
        {abasRanking(eraDoJogador).map((x) => {
          const atual = x.id === aba;
          return (
            <button
              key={x.id}
              type="button"
              className={`caixa botao ${atual ? 'botao-dourado' : ''} ${estilos.abaRanking}`}
              aria-pressed={x.ativa ? atual : undefined}
              disabled={!x.ativa}
              title={x.ativa ? undefined : 'Em breve'}
              onClick={() => {
                if (x.id !== 'amigos') setAba(x.id);
              }}
            >
              {x.rotulo}
            </button>
          );
        })}
      </div>

      <div role="table" aria-label="Ranking" aria-busy={isLoading || undefined} className={estilos.tabelaRanking}>
        <div role="row" className={estilos.cabecalhoRanking}>
          <span role="columnheader" className={estilos.colPosicao}>#</span>
          <span role="columnheader" className={estilos.colNome}>Jogador</span>
          <span role="columnheader" className={estilos.colEra}>Era</span>
          <span role="columnheader" className={estilos.colCiclo}>Ciclo</span>
          <span role="columnheader" className={estilos.colReliquias}>
            <span className={estilos.soLargo}>Relíquias</span>
            <span className={estilos.soCelular} aria-hidden="true">Relíq.</span>
          </span>
          <span role="columnheader" className={estilos.colTempo}>Tempo</span>
        </div>
        <div role="rowgroup" className={estilos.corpoRanking}>
          {dados?.linhas.map((l) => <Linha key={l.chave} l={l} />)}
          {dados?.vazio && <p className={estilos.texto}>Nenhum reino nesta lista ainda.</p>}
          {!data && error && <p className={estilos.texto}>Não deu para carregar o ranking. Tente de novo em instantes.</p>}
        </div>
        {dados?.presa && (
          <div role="rowgroup" className={estilos.presaRanking}>
            <p className={estilos.reticencias} aria-hidden="true">· · ·</p>
            <Linha l={dados.presa} />
          </div>
        )}
      </div>
    </Modal>
  );
}
