// Escala das telas com cenário (Início, Login). O frame do Figma tem 1440x900
// e foi desenhado com 1 pixel de sprite = 6 px. Aqui escolhemos quantos px de
// tela vale um pixel de sprite (--u, sempre inteiro) e aplicamos zoom = u/6 no
// palco de 1440x900. Assim todo sprite fica com pixel inteiro, nunca esticado.

export const PIXEL_DO_FIGMA = 6;

/**
 * Abaixo disto o palco de 1440 x 900 não cabe inteiro (com escala mínima 3 ele
 * tem 720 x 450 e precisa de folga): Início e Login viram coluna única.
 * A mesma consulta está no globals.css (seção "Cena no celular").
 */
export const CONSULTA_CENA_CELULAR = '(max-width: 899px), (max-height: 499px)';
export const ESCALA_MIN = 3;
export const ESCALA_MAX = 8;
export const LARGURA_PALCO = 1440;
export const ALTURA_PALCO = 900;

/** Roda no <head>, antes da primeira pintura, e a cada redimensionamento. */
export const SCRIPT_ESCALA = `(function(){
function f(){
var u=Math.floor(Math.min(innerWidth/${LARGURA_PALCO / PIXEL_DO_FIGMA},innerHeight/${ALTURA_PALCO / PIXEL_DO_FIGMA}));
u=Math.max(${ESCALA_MIN},Math.min(${ESCALA_MAX},u));
var s=document.documentElement.style;
s.setProperty('--u',u+'px');s.setProperty('--z',String(u/${PIXEL_DO_FIGMA}));
}
f();addEventListener('resize',f);
})();`;
