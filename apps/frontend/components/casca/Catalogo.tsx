'use client';

// Catálogo de construções (handoff, A12; Figma "Construir - Desktop/Mobile
// (Catalogo)"). Modal no desktop, folha de baixo no celular. Uma linha por
// slot; o estado de cada uma vem do game-core (linhasCatalogo). Só emite
// intenções: quem constrói é o JogoAoVivo, e quem valida é o servidor.

import { TEXTOS_CATALOGO, type SlotId } from '@cronarca/game-core';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { filtrarCatalogo, type FiltroCatalogo, type LinhaCatalogoTela } from '../../lib/casca/modais';
import { Icone } from './Icone';
import { Modal } from './Modal';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import estilos from './modais.module.css';

const T = TEXTOS_CATALOGO;

export interface PropsCatalogo {
  linhas: LinhaCatalogoTela[];
  /** Veio do mapa (slot vazio): rola até a linha e a realça. */
  foco: SlotId | null;
  /** Slot esperando a resposta do servidor (botão "Construindo…"). */
  construindo: SlotId | null;
  aoConstruir: (slot: SlotId) => void;
  aoMelhorar: (slot: SlotId) => void;
  aoFechar: () => void;
}

function Linha({ l, foco, construindo, aoAgir }: { l: LinhaCatalogoTela; foco: boolean; construindo: boolean; aoAgir: () => void }) {
  const idMotivo = `catalogo-motivo-${l.slot}`;
  const desativado = !l.pode || construindo;
  // Enter na linha focada confirma a ação dela (a mesma do botão).
  const aoTeclar = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
    e.preventDefault();
    if (l.acao && !desativado) aoAgir();
  };
  return (
    <li
      className={`caixa ${estilos.cartao} ${estilos.linhaCatalogo} ${l.estado === 'bloqueada' ? estilos.catalogo_bloqueada : ''} ${foco ? estilos.focoCatalogo : ''}`}
      data-slot={l.slot}
      data-estado={l.estado}
      tabIndex={0}
      aria-label={`${l.nome}${l.motivo ? `, ${l.motivo}` : ''}`}
      onKeyDown={aoTeclar}
    >
      <SpriteAnimado className={estilos.pixel} sprite={l.sprite} instancia={l.slot} lado={48} />
      <div className={estilos.linhaInfo}>
        <h3 className={estilos.nomeLinha}>
          {l.nome}
          {l.nivel && <span className={estilos.nivelNome}>{l.nivel}</span>}
        </h3>
        {l.efeito && (
          <p className={estilos.efeitoLinha}>
            {l.efeito.hoje}
            <ArrowRight size={14} strokeWidth={3} aria-label="passa a" className={estilos.setaLinha} />
            <strong>{l.efeito.depois}</strong>
          </p>
        )}
        {l.custo.length > 0 && (
          <p className={estilos.custosLinha}>
            {l.custo.map((c) => (
              <span key={c.recurso} className={c.falta ? estilos.falta : ''}>
                <Icone nome={`icone-${c.recurso}`} tamanho={16} />
                {c.valor}
              </span>
            ))}
            {l.tempo && (
              <span className={estilos.tempoLinha}>
                <Icone nome="icone-tempo" tamanho={16} />
                {l.tempo}
              </span>
            )}
          </p>
        )}
        {l.obra && (
          <div className={estilos.obraLinha}>
            <Icone nome="icone-tempo" tamanho={16} />
            <span className={estilos.restanteLinha}>{l.obra.restante}</span>
            <div className={estilos.barraLinha} role="progressbar" aria-label={T.emObra} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(l.obra.fracao * 100)}>
              <span style={{ width: `${Math.round(l.obra.fracao * 100)}%` }} />
            </div>
          </div>
        )}
        {l.nivel && !l.acao && (
          <p className={estilos.nivelLinha}>
            <Check size={16} strokeWidth={3} aria-hidden="true" className={estilos.verde} />
            {T.maximo}
          </p>
        )}
        {l.motivo && (
          <p id={idMotivo} className={`${estilos.motivoLinha} ${l.estado === 'bloqueada' ? '' : estilos.falta}`}>
            {l.estado === 'bloqueada' && <Lock size={14} strokeWidth={2.5} aria-hidden="true" />}
            {l.motivo}
          </p>
        )}
      </div>
      {l.acao && (
        <button
          type="button"
          tabIndex={-1}
          className={`caixa botao ${l.pode ? 'botao-dourado' : ''} ${estilos.botaoLinha} ${desativado ? estilos.desativado : ''}`}
          aria-disabled={desativado || undefined}
          aria-describedby={l.motivo ? idMotivo : undefined}
          onClick={() => {
            if (!desativado) aoAgir();
          }}
        >
          {construindo ? (l.acao === 'melhorar' ? T.melhorando : T.construindo) : l.acao === 'construir' ? T.construir : T.melhorar}
        </button>
      )}
    </li>
  );
}

export function Catalogo({ linhas, foco, construindo, aoConstruir, aoMelhorar, aoFechar }: PropsCatalogo) {
  const [filtro, setFiltro] = useState<FiltroCatalogo>('todas');
  const lista = useRef<HTMLUListElement>(null);
  const visiveis = filtrarCatalogo(linhas, filtro);

  // Veio do mapa: rola até a linha do slot e põe o foco nela (depois do foco inicial do Modal).
  useEffect(() => {
    if (!foco) return;
    const el = lista.current?.querySelector<HTMLElement>(`[data-slot="${foco}"]`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus({ preventScroll: true });
  }, [foco]);

  return (
    <Modal titulo={T.titulo} subtitulo={T.subtitulo} largura="larga" folha rodape={T.rodape} aoFechar={aoFechar}>
      <div className={estilos.filtros} role="group" aria-label="Filtro">
        {(['todas', 'disponiveis'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`${estilos.filtro} ${filtro === f ? estilos.filtroAtivo : ''}`}
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
          >
            {f === 'todas' ? T.filtroTodas : T.filtroDisponiveis}
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <p className={estilos.texto}>{T.vazioDisponiveis}</p>
      ) : (
        <ul ref={lista} className={estilos.gradeCatalogo}>
          {visiveis.map((l) => (
            <Linha
              key={l.slot}
              l={l}
              foco={l.slot === foco}
              construindo={construindo === l.slot}
              aoAgir={() => (l.acao === 'construir' ? aoConstruir(l.slot) : aoMelhorar(l.slot))}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
}
