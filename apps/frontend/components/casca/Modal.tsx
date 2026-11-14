'use client';

// Base dos modais (Figma "Modal ... - Desktop"): fundo escurecido, painel de
// pergaminho com o título, o subtítulo e o botão de fechar no canto. Fecha
// com Esc, com o X e com clique fora; o foco fica preso dentro enquanto
// aberto e volta para onde estava ao fechar. No celular (até 600 px, Portão
// 14) todo modal vira a folha que sobe de baixo, com a alça no topo; o
// Catálogo (`folha`) já vira folha abaixo de 1024 px.

import { gsap } from 'gsap';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CONSULTA_CELULAR } from '../../lib/casca/celular';
import { Icone } from './Icone';
import estilos from './modais.module.css';

const FOCAVEIS = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface PropsModal {
  titulo: string;
  /** Etiqueta ao lado do título ("Nv 3 → Nv 4"). */
  etiqueta?: string;
  subtitulo?: ReactNode;
  /** Subtítulo em vermelho (ação sem volta). */
  subtituloAlerta?: boolean;
  /** Canto direito do cabeçalho, antes do X (saber da Pesquisa). */
  extra?: ReactNode;
  /** Larguras do Figma: media 712 (Melhorar), estreita 632 (Configurações), larga 872 (Pesquisa), ranking 880. */
  largura: 'estreita' | 'media' | 'ascensao' | 'larga' | 'ranking';
  /** Folha que sobe de baixo já abaixo de 1024 px (Catálogo, A12). Os demais modais viram folha só no celular (até 600 px). */
  folha?: boolean;
  /** Fica embaixo, fora da rolagem (nota de rodapé). */
  rodape?: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
}

export function Modal({ titulo, etiqueta, subtitulo, subtituloAlerta = false, extra, largura, folha = false, rodape, aoFechar, children }: PropsModal) {
  const painel = useRef<HTMLElement>(null);
  const idTitulo = useId();
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = painel.current;
    if (el) {
      const deBaixo = window.matchMedia(folha ? '(max-width: 1023px)' : CONSULTA_CELULAR).matches;
      gsap.fromTo(el, { opacity: 0, y: deBaixo ? 48 : 12 }, { opacity: 1, y: 0, duration: deBaixo ? 0.28 : 0.2, ease: 'power2.out' });
      // Foco no primeiro controle do corpo (não no X), como num diálogo nativo.
      const primeiro = el.querySelector(`.${estilos.corpo}`)?.querySelector<HTMLElement>(FOCAVEIS) ?? el.querySelector<HTMLElement>(FOCAVEIS);
      primeiro?.focus({ preventScroll: true });
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== 'Tab' || !painel.current) return;
      const itens = [...painel.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (itens.length === 0) return;
      const primeiro = itens[0]!;
      const ultimo = itens[itens.length - 1]!;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      anterior?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className={`${estilos.fundo} ${folha ? estilos.fundoFolha : ''}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <section ref={painel} className={`caixa pergaminho com-linha ${estilos.modal} ${estilos[largura]} ${folha ? estilos.folha : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        {/* Alça da folha (Figma "Painel inferior"): só aparece quando o modal é folha. */}
        <span className={estilos.alca} aria-hidden="true" />
        <header className={estilos.cabecalho}>
          <div className={estilos.titulos}>
            <h2 id={idTitulo} className={estilos.titulo}>
              {titulo}
              {etiqueta && <span className={estilos.etiqueta}>{etiqueta}</span>}
            </h2>
            {subtitulo && <p className={`${estilos.subtitulo} ${subtituloAlerta ? estilos.alerta : ''}`}>{subtitulo}</p>}
          </div>
          {extra}
          <button type="button" className={`caixa ${estilos.fechar}`} onClick={aoFechar} aria-label="Fechar">
            <Icone nome="icone-fechar" />
          </button>
        </header>
        <div className={estilos.corpo}>{children}</div>
        {rodape && <p className={estilos.rodape}>{rodape}</p>}
      </section>
    </div>,
    document.body,
  );
}
