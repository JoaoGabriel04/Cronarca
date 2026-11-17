// Feedback do clique em PEDRA (decisão do dono, 17/11): a pedra está pintada na imagem do mapa e não treme, então no
// mesmo tempo da tremida (220 ms) o contorno dourado dela acende e algumas lascas saltam. Funções puras e um desenho
// simples; o contorno é o mesmo do hover (contornos/, desenhado no CanvasMapa).

export const BRILHO_MS = 220;

/** Ângulos (graus, 0 = direita, 90 = baixo) das 5 lascas: abrem para cima e para os lados. */
const ANGULOS = [-155, -118, -90, -62, -25];

export interface Lasca {
  x: number;
  y: number;
  lado: number;
  /** 1 no início, 0 no fim. */
  alfa: number;
}

/**
 * Posição das lascas `t` (0 a 1) depois do clique, a partir do centro (cx, cy) da pedra em px de tela, no zoom
 * inteiro `zoom`: saem para fora e caem um pouco; tudo em pixel inteiro e com o lado de pelo menos 2 px.
 */
export function posicoesDasLascas(cx: number, cy: number, t: number, zoom: number): Lasca[] {
  const u = Math.min(1, Math.max(0, t));
  return ANGULOS.map((graus, i) => {
    const rad = (graus * Math.PI) / 180;
    const alcance = (5 + 4 * (i % 2)) * zoom * (1 - (1 - u) ** 2); // freia no fim
    const queda = 5 * zoom * u * u;
    return {
      x: Math.round(cx + Math.cos(rad) * alcance),
      y: Math.round(cy + Math.sin(rad) * alcance + queda),
      lado: Math.max(2, Math.round(zoom)),
      alfa: 1 - u,
    };
  });
}

export function desenharLascas(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, zoom: number) {
  const anterior = ctx.globalAlpha;
  for (const l of posicoesDasLascas(cx, cy, t, zoom)) {
    ctx.globalAlpha = l.alfa;
    ctx.fillStyle = '#1a100a'; // contorno de 1 px, como o texto do "+N"
    ctx.fillRect(l.x - 1, l.y - 1, l.lado + 2, l.lado + 2);
    ctx.fillStyle = '#d6d0c0';
    ctx.fillRect(l.x, l.y, l.lado, l.lado);
  }
  ctx.globalAlpha = anterior;
}
