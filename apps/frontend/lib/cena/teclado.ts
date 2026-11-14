'use client';

// Teclado do celular no Login: a altura visível vem do visualViewport (no
// iPhone o teclado não encolhe a página) em --altura-visivel, e
// html[data-teclado] liga a logo compacta e tira o castelo (login.module.css).
// O campo focado rola para o meio da área visível, com o Entrar logo abaixo.

import { useEffect } from 'react';
import { CONSULTA_CENA_CELULAR } from '../../components/cena/escala';

/** Diferença de altura que conta como teclado aberto (a barra do navegador mexe menos que isso). */
const LIMIAR_TECLADO_PX = 150;

export function AjusteTeclado() {
  useEffect(() => {
    const html = document.documentElement;
    const vv = window.visualViewport;
    const celular = window.matchMedia(CONSULTA_CENA_CELULAR);
    // Maior altura vista sem teclado: no Android a página encolhe junto, então a comparação é com ela.
    let alturaCheia = vv?.height ?? window.innerHeight;

    const atualizar = () => {
      const altura = vv?.height ?? window.innerHeight;
      const focado = document.activeElement instanceof HTMLInputElement;
      if (!focado) alturaCheia = Math.max(alturaCheia, altura);
      html.style.setProperty('--altura-visivel', `${Math.round(altura)}px`);
      html.toggleAttribute('data-teclado', celular.matches && alturaCheia - altura > LIMIAR_TECLADO_PX);
    };
    const aoFocar = (e: FocusEvent) => {
      if (!celular.matches || !(e.target instanceof HTMLInputElement)) return;
      const campo = e.target;
      // Espera o teclado abrir (e o layout encolher) antes de rolar.
      window.setTimeout(() => campo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    };

    atualizar();
    vv?.addEventListener('resize', atualizar);
    window.addEventListener('resize', atualizar);
    document.addEventListener('focusin', aoFocar);
    return () => {
      vv?.removeEventListener('resize', atualizar);
      window.removeEventListener('resize', atualizar);
      document.removeEventListener('focusin', aoFocar);
      html.style.removeProperty('--altura-visivel');
      html.removeAttribute('data-teclado');
    };
  }, []);
  return null;
}
