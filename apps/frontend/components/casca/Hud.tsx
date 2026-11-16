'use client';

// HUD (Figma "HUD", 1440 x 72): selo, era, 6 chips de recurso com quantidade
// e taxa por segundo (o de Saber abre a Pesquisa), e os botões Construir,
// Pesquisa, Ranking (Portão 15), Salvar agora e Configurações. O número sobe animado (GSAP) e o chip pulsa a cada
// ganho por clique.

import { TEXTOS_CATALOGO, type Recurso } from '@cronarca/game-core';
import { Hammer } from 'lucide-react';
import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import type { ChipRecurso } from '../../lib/casca/dados';
import estilos from './casca.module.css';
import { Icone } from './Icone';
import { BotaoDiario } from './Objetivo';
import { MARCA } from '../../lib/marca';

/** Riscos de textura do fundo do HUD (posições do Figma). */
const RISCOS = [
  [0, 20], [150, 30], [300, 40], [360, 50], [510, 20], [660, 30], [720, 40],
  [870, 50], [1020, 20], [1080, 30], [1230, 40], [1380, 50],
] as const;


export interface PropsHud {
  era: string;
  chips: ChipRecurso[];
  /** Muda a cada ganho por clique: o chip desse recurso pulsa. */
  pulso: { recurso: Recurso; n: number } | null;
  /** Manda o que está na fila agora e confirma com o servidor. */
  aoSalvar: () => void;
  salvando: boolean;
  aoConfigurar: () => void;
  aoRanking: () => void;
  /** Botão Construir (A12): abre o Catálogo; o selo conta os slots que já dá para pagar (0 esconde). */
  aoConstruir: () => void;
  selo: number;
  /** Botão Pesquisa (e o chip de Saber): abre o modal de Pesquisa; o selo conta as que dá para começar. */
  aoPesquisar: () => void;
  seloPesquisa: number;
  /** Diário (Portão 16): no HUD do desktop; abaixo de 1024 px fica na faixa do Objetivo. */
  aoDiario: () => void;
  novosDiario: number;
}

function Valor({ texto }: { texto: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const anterior = useRef(texto);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const de = Number(anterior.current.replace(/\./g, ''));
    const para = Number(texto.replace(/\./g, ''));
    anterior.current = texto;
    if (!Number.isFinite(de) || !Number.isFinite(para) || de === para) {
      el.textContent = texto;
      return;
    }
    // Conta do valor antigo ao novo; o texto final é sempre o formatado do estado.
    const obj = { v: de };
    const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
    const t = gsap.to(obj, {
      v: para,
      duration: 0.4,
      ease: 'power1.out',
      onUpdate: () => {
        el.textContent = fmt.format(Math.round(obj.v));
      },
      onComplete: () => {
        el.textContent = texto;
      },
    });
    return () => {
      t.kill();
    };
  }, [texto]);
  return (
    <p ref={ref} className={estilos.chipValor}>
      {texto}
    </p>
  );
}

/** Selo numérico do botão Construir (no HUD e no flutuante do celular). */
export function SeloNumero({ n }: { n: number }) {
  return (
    <span className={estilos.selo} aria-hidden="true">
      {n}
    </span>
  );
}

export function Hud({ era, chips, pulso, aoSalvar, salvando, aoConfigurar, aoRanking, aoConstruir, selo, aoPesquisar, seloPesquisa, aoDiario, novosDiario }: PropsHud) {
  const refs = useRef<Partial<Record<Recurso, HTMLElement | null>>>({});

  useEffect(() => {
    if (!pulso) return;
    const el = refs.current[pulso.recurso];
    if (!el) return;
    gsap.fromTo(el, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)', duration: 0.35, ease: 'power1.out' });
  }, [pulso]);

  return (
    <header className={estilos.hud}>
      {RISCOS.map(([x, y]) => (
        <span key={`${x}-${y}`} className={estilos.risco} style={{ left: x, top: y }} aria-hidden="true" />
      ))}
      {/* Selo do relógio (portão Logo e ícone): 64 px no desktop, 32 no topo compacto e no celular (o PNG é 64: metade exata). */}
      <img className={estilos.logo} src={MARCA.selo(64)} width={64} height={64} alt={MARCA.nome} draggable={false} />
      <div className={`caixa ${estilos.era}`}>{era}</div>
      <div className={`${estilos.recursos} ${estilos.rola}`} role="list" aria-label="Recursos">
      {chips.map((c) => {
        const conteudo = (
          <>
            <Icone nome={`icone-${c.recurso}`} className={estilos.chipIcone} />
            <Valor texto={c.quantidade} />
            <p className={`${estilos.chipTaxa} ${c.negativa ? estilos.negativa : ''}`}>{c.taxa}</p>
          </>
        );
        const classe = `caixa ${estilos.chip} ${c.cheio ? estilos.cheio : ''} ${c.alerta ? estilos.chipAlerta : ''}`;
        const dica = c.alerta ?? (c.cheio ? 'Armazém cheio' : undefined);
        const ref = (el: HTMLElement | null) => {
          refs.current[c.recurso] = el;
        };
        // Saber abre a Pesquisa (atalho além do botão).
        return c.recurso === 'saber' ? (
          <div key={c.recurso} role="listitem" className={estilos.chipItem}>
            <button ref={ref} type="button" className={`${classe} ${estilos.chipBotao}`} onClick={aoPesquisar} aria-label={`Saber: ${c.quantidade}, ${c.taxa}. Abrir a Pesquisa`} title="Abrir a Pesquisa">
              {conteudo}
            </button>
          </div>
        ) : (
          <div key={c.recurso} ref={ref} className={classe} role="listitem" aria-label={`${c.recurso}: ${c.quantidade}, ${c.taxa}${c.alerta ? `. ${c.alerta}` : ''}`} title={dica}>
            {conteudo}
          </div>
        );
      })}
      </div>
      <div className={estilos.botoesHud}>
        <span className={`${estilos.comSelo} ${estilos.construirHud}`}>
          <button
            type="button"
            className={`caixa ${estilos.botaoHud}`}
            onClick={aoConstruir}
            aria-label={selo > 0 ? `${TEXTOS_CATALOGO.botao} (${selo} disponíve${selo === 1 ? 'l' : 'is'})` : TEXTOS_CATALOGO.botao}
            title={TEXTOS_CATALOGO.botao}
          >
            <Hammer size={24} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {selo > 0 && <SeloNumero n={selo} />}
        </span>
        <span className={`${estilos.comSelo} ${estilos.pesquisaHud}`}>
          <button
            type="button"
            className={`caixa ${estilos.botaoHud}`}
            onClick={aoPesquisar}
            aria-label={seloPesquisa > 0 ? `Pesquisa (${seloPesquisa} disponíve${seloPesquisa === 1 ? 'l' : 'is'})` : 'Pesquisa'}
            title="Pesquisa"
          >
            <Icone nome="icone-saber" />
          </button>
          {seloPesquisa > 0 && <SeloNumero n={seloPesquisa} />}
        </span>
        <BotaoDiario novos={novosDiario} aoAbrir={aoDiario} classe={estilos.diarioHud} />
        <button type="button" className={`caixa ${estilos.botaoHud} ${estilos.rankingHud}`} onClick={aoRanking} aria-label="Ranking" title="Ranking">
          <Icone nome="icone-ranking" />
        </button>
        <button type="button" className={`caixa ${estilos.botaoHud}`} disabled={salvando} onClick={aoSalvar} aria-label="Salvar agora" title="Salvar agora">
          <Icone nome="icone-salvar" />
        </button>
        <button type="button" className={`caixa ${estilos.botaoHud}`} onClick={aoConfigurar} aria-label="Configurações" title="Configurações">
          <Icone nome="icone-config" />
        </button>
      </div>
    </header>
  );
}
