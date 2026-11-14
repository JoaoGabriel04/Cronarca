// Câmera do mapa: funções puras de conversão mundo <-> tela.
//
// Spec: tela = (mundo - camera) * zoom + viewport / 2. O deslocamento
// (viewport / 2 - camera * zoom) é arredondado para pixel de tela inteiro,
// senão um centro fracionário como o da Vila (206,5; 236,3) desenharia os
// sprites entre pixels, borrados. O centro guardado continua exato.

import { ZOOM_MAX, ZOOM_MIN } from './visoes';

export interface Ponto {
  x: number;
  y: number;
}

export interface Tamanho {
  largura: number;
  altura: number;
}

/** Retângulo em coordenadas de mundo (ex.: área onde o pan pode andar). */
export interface Area {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Centro da câmera em coordenadas de mundo e zoom inteiro. */
export interface Camera extends Ponto {
  zoom: number;
}

export function limitarZoom(zoom: number, minimo: number = ZOOM_MIN): number {
  return Math.min(ZOOM_MAX, Math.max(minimo, ZOOM_MIN, Math.round(zoom)));
}

/**
 * Menor zoom inteiro em que a área cobre a viewport nos dois eixos (mapa
 * grande, seção 2: em telas grandes o 1x deixaria borda). Nunca passa do
 * máximo; se nem o máximo cobre, fica no máximo e a área é centralizada.
 */
export function zoomMinimoQueCobre(area: Area, vp: Tamanho): number {
  for (let z = ZOOM_MIN; z <= ZOOM_MAX; z++) if (area.largura * z >= vp.largura && area.altura * z >= vp.altura) return z;
  return ZOOM_MAX;
}

/** Deslocamento em px de tela inteiros: tela = mundo * zoom + deslocamento. */
export function deslocamento(cam: Camera, vp: Tamanho): Ponto {
  return {
    x: Math.round(vp.largura / 2 - cam.x * cam.zoom),
    y: Math.round(vp.altura / 2 - cam.y * cam.zoom),
  };
}

export function mundoParaTela(p: Ponto, cam: Camera, vp: Tamanho): Ponto {
  const d = deslocamento(cam, vp);
  return { x: p.x * cam.zoom + d.x, y: p.y * cam.zoom + d.y };
}

export function telaParaMundo(p: Ponto, cam: Camera, vp: Tamanho): Ponto {
  const d = deslocamento(cam, vp);
  return { x: (p.x - d.x) / cam.zoom, y: (p.y - d.y) / cam.zoom };
}

function limitarEixo(centro: number, visivel: number, inicio: number, tamanho: number): number {
  // Área menor que a tela nesse eixo: fica centralizada.
  if (tamanho <= visivel) return inicio + tamanho / 2;
  const meio = visivel / 2;
  return Math.min(inicio + tamanho - meio, Math.max(inicio + meio, centro));
}

/** Zoom inteiro (nunca abaixo do que cobre a tela) e pan preso à área: a tela nunca mostra fora dela. */
export function limitarCamera(cam: Camera, area: Area, vp: Tamanho): Camera {
  const zoom = limitarZoom(cam.zoom, zoomMinimoQueCobre(area, vp));
  return {
    zoom,
    x: limitarEixo(cam.x, vp.largura / zoom, area.x, area.largura),
    y: limitarEixo(cam.y, vp.altura / zoom, area.y, area.altura),
  };
}

/** Arrasto: move a câmera pelo contrário do movimento do ponteiro (px de tela). */
export function moverCamera(cam: Camera, dxTela: number, dyTela: number, area: Area, vp: Tamanho): Camera {
  return limitarCamera({ ...cam, x: cam.x - dxTela / cam.zoom, y: cam.y - dyTela / cam.zoom }, area, vp);
}

/** Troca o zoom mantendo o ponto do mundo sob o cursor no mesmo lugar (até onde o limite deixar). */
export function zoomNoPonto(cam: Camera, novoZoom: number, pontoTela: Ponto, area: Area, vp: Tamanho): Camera {
  const zoom = limitarZoom(novoZoom, zoomMinimoQueCobre(area, vp));
  if (zoom === cam.zoom) return limitarCamera(cam, area, vp);
  const alvo = telaParaMundo(pontoTela, cam, vp);
  return limitarCamera(
    {
      zoom,
      x: alvo.x - (pontoTela.x - vp.largura / 2) / zoom,
      y: alvo.y - (pontoTela.y - vp.altura / 2) / zoom,
    },
    area,
    vp,
  );
}

/**
 * Pixels do canvas por px CSS. Com escala de tela inteira (100%, 200%) usa a
 * resolução real; com escala fracionária (125%, 150%) desenha em px CSS e o
 * navegador amplia sem suavizar, para o pixel do sprite nunca ser cortado.
 */
export function escalaDoCanvas(devicePixelRatio: number): number {
  return Number.isInteger(devicePixelRatio) && devicePixelRatio >= 1 ? devicePixelRatio : 1;
}
