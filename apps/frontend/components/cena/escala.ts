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

/**
 * Bloco de título do Início (logo, subtítulo e ornamentos) acima do topo RENDERIZADO do castelo.
 * Em escalas menores o arredondamento (round(4·u/6)) faz o castelo crescer além da proporção do palco e as
 * bandeiras (que tocam a linha 0 do quadro de 96 x 96, medido nos 8 quadros) chegariam ao subtítulo.
 * Regra: folga mínima de 8 px do frame (8·z na tela, z = u/6) entre a base do ornamento mais baixo
 * (o losango) e o topo do castelo. Se o bloco não couber no palco, ele sobe; se a logo passaria de
 * TITULO_TOPO_MIN, a logo cai para a escala k seguinte (4, 3, 2). A escala do castelo não muda.
 * Medidas em px do frame de 1440 x 900; o castelo tem o pé em y = 606 (y 222 + 96 x 4) e 96 px de arte.
 */
export const CASTELO_PE = 606;
export const CASTELO_ARTE = 96;
export const BLOCO_FOLGA = 8;
/** Base do ornamento mais baixo (losango, 188 + 10) no desenho do Figma. */
export const BLOCO_BASE_NOMINAL = 198;
/** Distâncias acima da base do bloco (px do frame): topo do losango, do fio e do subtítulo; a logo termina 46 acima. */
export const BLOCO_LOSANGO = 10;
export const BLOCO_FIO = 6;
export const BLOCO_SUBTITULO = 44;
export const BLOCO_LOGO_ACIMA = 46;
export const LOGO_ARTE_ALTURA = 32;
export const TITULO_TOPO_MIN = 8;
export const ESCALAS_DA_LOGO = [4, 3, 2] as const;

export interface BlocoDoTitulo {
  /** Px do frame: base do bloco (losango), topo do losango, do fio, do subtítulo e da logo. */
  base: number;
  topoLosango: number;
  topoFio: number;
  topoSubtitulo: number;
  topoLogo: number;
  /** Px do frame por pixel de arte da logo (--logo-e) e o k escolhido. */
  logoE: number;
  logoK: number;
  /** Topo do castelo renderizado e folga real até a base do bloco, em px do frame. */
  topoCastelo: number;
  folga: number;
}

export function blocoDoTitulo(u: number): BlocoDoTitulo {
  const z = u / PIXEL_DO_FIGMA;
  const topoCastelo = CASTELO_PE - CASTELO_ARTE * pixelsDoFramePorPixelDeArte(4, u);
  const base = Math.min(BLOCO_BASE_NOMINAL, Math.floor((topoCastelo - BLOCO_FOLGA) * z) / z);
  let logoK: number = ESCALAS_DA_LOGO[ESCALAS_DA_LOGO.length - 1]!;
  for (const k of ESCALAS_DA_LOGO) {
    if (base - BLOCO_LOGO_ACIMA - LOGO_ARTE_ALTURA * pixelsDoFramePorPixelDeArte(k, u) >= TITULO_TOPO_MIN) {
      logoK = k;
      break;
    }
  }
  const logoE = pixelsDoFramePorPixelDeArte(logoK, u);
  return {
    base,
    topoLosango: base - BLOCO_LOSANGO,
    topoFio: base - BLOCO_FIO,
    topoSubtitulo: base - BLOCO_SUBTITULO,
    topoLogo: base - BLOCO_LOGO_ACIMA - LOGO_ARTE_ALTURA * logoE,
    logoE,
    logoK,
    topoCastelo,
    folga: topoCastelo - base,
  };
}

/** Roda no <head>, antes da primeira pintura, e a cada redimensionamento. Mesma conta das funções acima. */
export const SCRIPT_ESCALA = `(function(){
function f(){
var u=Math.floor(Math.min(innerWidth/${LARGURA_PALCO / PIXEL_DO_FIGMA},innerHeight/${ALTURA_PALCO / PIXEL_DO_FIGMA}));
u=Math.max(${ESCALA_MIN},Math.min(${ESCALA_MAX},u));
var s=document.documentElement.style;
s.setProperty('--u',u+'px');s.setProperty('--z',String(u/${PIXEL_DO_FIGMA}));
var ks=[${ESCALAS_K.join(',')}];
for(var i=0;i<ks.length;i++){var n=Math.max(1,Math.round(ks[i]*u/${PIXEL_DO_FIGMA}));s.setProperty('--e'+ks[i],String(n*${PIXEL_DO_FIGMA}/u));}
var z=u/${PIXEL_DO_FIGMA};
function e(k){return Math.max(1,Math.round(k*u/${PIXEL_DO_FIGMA}))*${PIXEL_DO_FIGMA}/u;}
var tc=${CASTELO_PE}-${CASTELO_ARTE}*e(4);
var b=Math.min(${BLOCO_BASE_NOMINAL},Math.floor((tc-${BLOCO_FOLGA})*z)/z);
var ls=[${ESCALAS_DA_LOGO.join(',')}],le=e(ls[ls.length-1]);
for(var j=0;j<ls.length;j++){if(b-${BLOCO_LOGO_ACIMA}-${LOGO_ARTE_ALTURA}*e(ls[j])>=${TITULO_TOPO_MIN}){le=e(ls[j]);break;}}
s.setProperty('--logo-e',String(le));
s.setProperty('--bloco-logo',(b-${BLOCO_LOGO_ACIMA}-${LOGO_ARTE_ALTURA}*le)+'px');
s.setProperty('--bloco-sub',(b-${BLOCO_SUBTITULO})+'px');
s.setProperty('--bloco-fio',(b-${BLOCO_FIO})+'px');
s.setProperty('--bloco-losango',(b-${BLOCO_LOSANGO})+'px');
}
f();addEventListener('resize',f);
})();`;
