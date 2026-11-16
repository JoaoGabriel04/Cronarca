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

/** Escalas k (px do frame por pixel de arte) que os sprites do desktop usam (dados.ts). */
export const ESCALAS_K = [3, 4] as const;

/** Escala inteira da cena (--u) para a tela: pixels do frame de 1440x900 cabendo na janela, entre ESCALA_MIN e ESCALA_MAX. */
export function escalaDaTela(largura: number, altura: number): number {
  const u = Math.floor(Math.min(largura / (LARGURA_PALCO / PIXEL_DO_FIGMA), altura / (ALTURA_PALCO / PIXEL_DO_FIGMA)));
  return Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, u));
}

/**
 * Quantos pixels de tela vale um pixel de arte de um sprite de escala k com --u = u:
 * round(k * u / 6), no mínimo 1. Sempre inteiro, então o sprite nunca sai com pixel
 * quebrado. Com k = 6 é exatamente u; em u = 6 (1440x900) é exatamente k.
 */
export const pixelsDeTelaPorPixelDeArte = (k: number, u: number): number => Math.max(1, Math.round((k * u) / PIXEL_DO_FIGMA));

/**
 * Pixels do frame por pixel de arte que o CSS usa (--e2, --e3, --e4, --e6): o palco tem
 * zoom z = u/6, então n pixels de tela por pixel de arte são n * 6 / u pixels do frame.
 */
export const pixelsDoFramePorPixelDeArte = (k: number, u: number): number => (pixelsDeTelaPorPixelDeArte(k, u) * PIXEL_DO_FIGMA) / u;

/** Roda no <head>, antes da primeira pintura, e a cada redimensionamento. Mesma conta das funções acima. */
export const SCRIPT_ESCALA = `(function(){
function f(){
var u=Math.floor(Math.min(innerWidth/${LARGURA_PALCO / PIXEL_DO_FIGMA},innerHeight/${ALTURA_PALCO / PIXEL_DO_FIGMA}));
u=Math.max(${ESCALA_MIN},Math.min(${ESCALA_MAX},u));
var s=document.documentElement.style;
s.setProperty('--u',u+'px');s.setProperty('--z',String(u/${PIXEL_DO_FIGMA}));
var ks=[${ESCALAS_K.join(',')}];
for(var i=0;i<ks.length;i++){var n=Math.max(1,Math.round(ks[i]*u/${PIXEL_DO_FIGMA}));s.setProperty('--e'+ks[i],String(n*${PIXEL_DO_FIGMA}/u));}
}
f();addEventListener('resize',f);
})();`;
