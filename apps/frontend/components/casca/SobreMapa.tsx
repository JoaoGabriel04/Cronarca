'use client';

// Camadas HTML sobre o mapa: L9 (popup de evento, só na Vila) e L8 (chip de
// evento, Vila/Reino, zoom e minimapa). Figma "L9 Evento (popup)" e
// "L8 UI sobre o mapa".

import { TEXTOS_CATALOGO, type MapaJogo } from '@cronarca/game-core';
import { Hammer } from 'lucide-react';
import { gsap } from 'gsap';
import { useEffect, useRef, useState } from 'react';
import type { Camera, Ponto, Tamanho } from '../../lib/mapa/camera';
import { comporArteParada } from '../mapa/desenharMapaBase';
import type { NevoaAtiva } from '../../lib/mapa/nevoa';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import estilos from './casca.module.css';
import { SeloNumero } from './Hud';
import { Icone } from './Icone';

export type Visao = 'vila' | 'reino';

export function PopupMercador({
  restante, enviando, aoResponder, animado = true,
}: { restante: string; enviando: boolean; aoResponder: (aceitar: boolean) => void; animado?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  }, []);
  return (
    <section ref={ref} className={`caixa pergaminho com-linha ${estilos.popup}`} aria-labelledby="titulo-evento" role="dialog">
      <div className={`caixa ${estilos.popupImagem}`}>
        <SpriteAnimado className={estilos.pixel} sprite={{ grupo: 'evento', id: 'mercador' }} lado={128} animado={animado} />
      </div>
      <div className={estilos.popupCorpo}>
        <p className={estilos.popupRotulo}>EVENTO</p>
        <h2 id="titulo-evento" className={estilos.popupTitulo}>Mercador Viajante</h2>
        <p className={estilos.popupTexto}>Um comboio acampou junto ao portão. Trocas favoráveis enquanto durar a visita.</p>
        <div className={estilos.popupAcoes}>
          <button type="button" className={`caixa botao botao-dourado ${estilos.botaoCasca}`} disabled={enviando} onClick={() => aoResponder(true)}>
            Negociar
          </button>
          <button type="button" className={`caixa botao botao-claro ${estilos.botaoCasca}`} disabled={enviando} onClick={() => aoResponder(false)}>
            Ignorar
          </button>
        </div>
      </div>
      <div>
        <div className={`caixa ${estilos.cartao} ${estilos.popupTempo}`}>
          <Icone nome="icone-tempo" />
          {restante}
        </div>
        <p className={estilos.popupRestantes}>restantes</p>
      </div>
    </section>
  );
}

export function ChipEvento({ restante, aoAbrir }: { restante: string; aoAbrir: () => void }) {
  return (
    <button type="button" className={`caixa pergaminho ${estilos.chipEvento}`} onClick={aoAbrir} aria-label="Mercador Viajante: abrir na Vila">
      <Icone nome="icone-evento" />
      <span className={estilos.chipEventoTitulo}>Mercador Viajante</span>
      <span className={estilos.chipEventoAcao}>Negociar</span>
      <span className={estilos.chipEventoTempo}>{restante}</span>
    </button>
  );
}

export function AlternarVisao({ visao, aoTrocar }: { visao: Visao; aoTrocar: (v: Visao) => void }) {
  return (
    <div className={`caixa ${estilos.alternar}`} role="group" aria-label="Visão do mapa">
      {(['vila', 'reino'] as const).map((v) => (
        <button
          key={v}
          type="button"
          className={`caixa botao ${v === visao ? 'botao-dourado' : estilos.inativo} ${estilos.botaoCasca}`}
          aria-pressed={v === visao}
          onClick={() => v !== visao && aoTrocar(v)}
        >
          {v === 'vila' ? 'Vila' : 'Reino'}
        </button>
      ))}
    </div>
  );
}

export function ControleZoom({ zoom, minimo, maximo, aoZoom }: { zoom: number; minimo: number; maximo: number; aoZoom: (passo: 1 | -1) => void }) {
  return (
    <div className={`caixa ${estilos.zoom}`} role="group" aria-label="Zoom">
      <button type="button" className="caixa botao" aria-label="Aproximar" disabled={zoom >= maximo} onClick={() => aoZoom(1)}>
        +
      </button>
      <p className={estilos.zoomValor}>{zoom}x</p>
      <p className={estilos.zoomRotulo}>zoom</p>
      <button type="button" className="caixa botao" aria-label="Afastar" disabled={zoom <= minimo} onClick={() => aoZoom(-1)}>
        −
      </button>
    </div>
  );
}

// ---------- Minimapa ----------

/** Tamanho do minimapa (Figma "Mapa reduzido") e quanto de mundo cabe em 1 px dele. */
const MINI = { largura: 200, altura: 144 } as const;
/** 3072 x 2304 / 16 = 192 x 144: redução inteira, sem esticar. */
const REDUCAO = 16;

/** Névoa no minimapa: a cor do tile Nevoa Cheia do Figma (#1A2A4A), na opacidade média dele. */
const COR_NEVOA_MINI = 'rgb(26 42 74 / 0.55)';

/** Desenha a imagem do mapa reduzida (vizinho mais próximo), a névoa por cima e devolve onde a imagem caiu. */
export function desenharMinimapa(ctx: CanvasRenderingContext2D, m: MapaJogo, base: HTMLImageElement | HTMLCanvasElement | null, nevoas: readonly NevoaAtiva[] = []) {
  const w = m.largura / REDUCAO;
  const h = m.altura / REDUCAO;
  const ox = Math.floor((MINI.largura - w) / 2);
  const oy = Math.floor((MINI.altura - h) / 2);
  ctx.fillStyle = '#1a100a';
  ctx.fillRect(0, 0, MINI.largura, MINI.altura);
  if (base) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, m.largura, m.altura, ox, oy, w, h);
  }
  // Névoa: um pixel do minimapa por bloco de 16 x 16 do mundo cujo centro cai no círculo.
  ctx.fillStyle = COR_NEVOA_MINI;
  for (const n of nevoas) {
    const r = n.raio / REDUCAO;
    const cx = n.x / REDUCAO;
    const cy = n.y / REDUCAO;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  return { ox, oy };
}

export function Minimapa({ mapa, cam, vp, nevoas = [], aoCentrar }: { mapa: MapaJogo; cam: Camera | null; vp: Tamanho; nevoas?: readonly NevoaAtiva[]; aoCentrar: (p: Ponto) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const origem = useRef({ ox: 0, oy: 0 });
  // A arte parada (mapa + árvores em repouso + frente), composta uma vez: as mesmas URLs do mapa, já em cache.
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let ativo = true;
    comporArteParada(mapa)
      .then((img) => ativo && setBase(img))
      .catch((erro: unknown) => console.error('[minimapa]', erro));
    return () => {
      ativo = false;
    };
  }, [mapa]);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    origem.current = desenharMinimapa(ctx, mapa, base, nevoas);
    if (!cam) return;
    // Área visível: retângulo branco de 2 px.
    const escala = 1 / REDUCAO;
    const w = (vp.largura / cam.zoom) * escala;
    const h = (vp.altura / cam.zoom) * escala;
    const x = origem.current.ox + cam.x * escala - w / 2;
    const y = origem.current.oy + cam.y * escala - h / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
  }, [mapa, base, cam, vp, nevoas]);

  return (
    <div className={`caixa ${estilos.minimapa}`}>
      <canvas
        ref={ref}
        width={MINI.largura}
        height={MINI.altura}
        aria-label="Minimapa: clique para levar a câmera"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          // 2 px de borda + 2 px de respiro em volta dos 200 x 144.
          const px = ((e.clientX - r.left) * 208) / r.width - 4;
          const py = ((e.clientY - r.top) * 152) / r.height - 4;
          aoCentrar({ x: (px - origem.current.ox) * REDUCAO, y: (py - origem.current.oy) * REDUCAO });
        }}
      />
    </div>
  );
}

/** Celular (A12): o Construir flutua sobre o mapa, acima das abas (no desktop ele fica no HUD). */
export function BotaoConstruirFlutuante({ selo, aoAbrir }: { selo: number; aoAbrir: () => void }) {
  return (
    <span className={`${estilos.comSelo} ${estilos.construirFlutuante}`}>
      <button
        type="button"
        className="caixa botao botao-dourado"
        onClick={aoAbrir}
        aria-label={selo > 0 ? `${TEXTOS_CATALOGO.botao} (${selo} disponíve${selo === 1 ? 'l' : 'is'})` : TEXTOS_CATALOGO.botao}
      >
        <Hammer size={22} strokeWidth={2.5} aria-hidden="true" />
        {TEXTOS_CATALOGO.botao}
      </button>
      {selo > 0 && <SeloNumero n={selo} />}
    </span>
  );
}
