'use client';

// Peças do layout do celular (Portão 14, até 600 px; Figma "Vila - Mobile",
// "Mapa - Mobile" e "Mapa - Mobile (Destinos aberta)"): o botão Construções e a
// Crônica abaixo do mapa da Vila, e a gaveta de Destinos abaixo do mapa do Reino.

import { TEXTOS_CATALOGO, TEXTOS_GAVETA_DESTINOS as T } from '@cronarca/game-core';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { CartaDestino, LinhaCronica } from '../../lib/casca/dados';
import { gestoDaGaveta } from '../../lib/casca/gaveta';
import estilos from './casca.module.css';
import { Icone } from './Icone';
import { CartaoDestino, Cronica, type EventoCasca } from './Paineis';
import { SeloNumero } from './Hud';

/** Botão largo abaixo do mapa da Vila: abre o Catálogo (folha de construções). */
export function BotaoConstrucoes({ selo, aoAbrir }: { selo: number; aoAbrir: () => void }) {
  return (
    <span className={estilos.botaoConstrucoesCelular}>
      <button
        type="button"
        className="caixa botao botao-dourado"
        onClick={aoAbrir}
        aria-label={selo > 0 ? `${TEXTOS_CATALOGO.titulo} (${selo} disponíve${selo === 1 ? 'l' : 'is'})` : TEXTOS_CATALOGO.titulo}
      >
        {TEXTOS_CATALOGO.titulo}
      </button>
      {selo > 0 && <SeloNumero n={selo} />}
    </span>
  );
}

/** Crônica abaixo do botão Construções, num cartão de pergaminho. */
export function CartaoCronica({ linhas }: { linhas: LinhaCronica[] }) {
  return (
    <section className={`caixa pergaminho com-linha ${estilos.cronicaCelular}`} aria-label="Crônica">
      <Cronica linhas={linhas} />
    </section>
  );
}

export interface PropsGaveta {
  subtitulo: string;
  destinos: CartaDestino[];
  aoEvento: (e: EventoCasca) => void;
  aberta: boolean;
  aoTrocar: (aberta: boolean) => void;
  animado: boolean;
}

/**
 * Gaveta de Destinos: fechada, mostra o título e os dois primeiros destinos
 * abaixo do mapa; aberta, cobre a área entre o HUD e as abas com a lista toda.
 * Abre e fecha tocando na alça, arrastando a alça com mouse ou caneta (para
 * cima abre, para baixo fecha), pelo X e por Esc.
 */
export function GavetaDestinos({ subtitulo, destinos, aoEvento, aberta, aoTrocar, animado }: PropsGaveta) {
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const inicio = useRef<number | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    fechar.current?.focus({ preventScroll: true });
    if (animado && painel.current) gsap.fromTo(painel.current, { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoTrocar(false);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, animado, aoTrocar]);

  const alca = (
    <button
      type="button"
      className={estilos.alcaGaveta}
      aria-label={aberta ? T.fechar : T.abrir}
      aria-expanded={aberta}
      // Sem touch-action: none (só a janela do mapa tem, Portão 14): no toque o arrasto vertical é
      // da rolagem e a alça abre e fecha com um toque; com mouse e caneta, arrastar também funciona.
      onPointerDown={(e) => {
        inicio.current = e.clientY;
        setArrastando(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const dy = inicio.current === null ? 0 : e.clientY - inicio.current;
        inicio.current = null;
        setArrastando(false);
        const r = gestoDaGaveta(aberta, dy);
        if (r !== aberta) aoTrocar(r);
      }}
      onPointerCancel={() => {
        inicio.current = null;
        setArrastando(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          aoTrocar(!aberta);
        }
      }}
    >
      <span className={`${estilos.marcaAlca} ${arrastando ? estilos.marcaAlcaAtiva : ''}`} />
    </button>
  );

  const lista = aberta ? destinos : destinos.slice(0, T.fechadaMostra);
  return (
    <section
      ref={painel}
      className={`caixa pergaminho com-linha ${estilos.gaveta} ${aberta ? estilos.gavetaAberta : ''}`}
      aria-label={T.titulo}
      data-gaveta={aberta ? 'aberta' : 'fechada'}
    >
      {alca}
      <header className={`${estilos.cabecalho} ${estilos.cabecalhoGaveta}`}>
        <h2>{T.titulo}</h2>
        <p>{subtitulo}</p>
        {aberta ? (
          <button ref={fechar} type="button" className={`caixa ${estilos.fecharGaveta}`} onClick={() => aoTrocar(false)} aria-label={T.fechar}>
            <Icone nome="icone-fechar" />
          </button>
        ) : (
          <Icone nome="icone-expedicao" />
        )}
      </header>
      <ul className={`${estilos.lista} ${estilos.listaGaveta}`}>
        {lista.map((c) => (
          <CartaoDestino key={c.destino} c={c} aoEvento={aoEvento} />
        ))}
      </ul>
      {aberta && <p className={estilos.notaGaveta}>{T.nota}</p>}
    </section>
  );
}
