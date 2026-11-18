'use client';

// Preview do mapa grande (/jogo/mapa, só em desenvolvimento): a imagem
// arrastável em tela cheia, botões de zoom 1x a 4x e a grade com o meta (área
// jogável, núcleo, destinos). Usa o estado de exemplo e não fala com o
// servidor: o clique roda a mesma previsão do game-core localmente.

import { estadoInicial, ganhoCliqueMicro, nivelReliquia, objetosDoMapa, preverAcao, preverEstado, recursoDoObjeto, tetos, ZOOM_MAPA, type PesquisaId, type VisaoCliente } from '@cronarca/game-core';
import { Grid3x3 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Camera } from '../../lib/mapa/camera';
import { estadoDeExemplo } from '../../lib/mapa/exemplo';
import { VISOES } from '../../lib/mapa/visoes';
import { CanvasMapa, type CliqueObjeto, type ControleMapa } from '../mapa/CanvasMapa';
import estilos from './preview.module.css';

const ZOOMS = Array.from({ length: ZOOM_MAPA.maximo - ZOOM_MAPA.minimo + 1 }, (_, i) => ZOOM_MAPA.minimo + i);

export function MapaDePreview({ pesquisas = [], exemplo = true }: { pesquisas?: readonly PesquisaId[]; exemplo?: boolean }) {
  const objetos = useMemo(() => objetosDoMapa(), []);
  const [estado, setEstado] = useState<VisaoCliente>(() => {
    const e = exemplo ? estadoDeExemplo(Date.now()) : estadoInicial({ semente: 1, agora: Date.now() });
    e.pesquisas.concluidas.push(...pesquisas);
    return e;
  });
  const atual = useRef(estado);
  atual.current = estado;
  const controle = useRef<ControleMapa>(null);

  const clicarObjeto = (id: string): CliqueObjeto => {
    const agora = Date.now();
    const antes = preverEstado(atual.current, agora).estado;
    const r = preverAcao(antes, { tipo: 'clicar', objeto: id, quantidade: 1 }, agora, { objetosDoMapa: objetos });
    const recurso = recursoDoObjeto(antes, id, { objetosDoMapa: objetos });
    if (!r.ok || !recurso) return { ganho: 0, cheio: false, aceito: Promise.resolve(false) };
    setEstado(r.estado);
    const ganho = r.estado.recursos[recurso] - antes.recursos[recurso];
    return { ganho, cheio: ganho === 0 && r.estado.recursos[recurso] >= tetos(r.estado)[recurso], ganhoPorCliqueMicro: ganhoCliqueMicro(r.estado, recurso), aceito: Promise.resolve(true) };
  };

  return (
    <div className={estilos.preview} data-preview-mapa>
      <CanvasMapa estado={estado} relogio={Date.now} clicarObjeto={clicarObjeto} depuracao controle={controle} ajustavel mostrarAjuda={false} cameraInicial={VISOES.mapa}>
        {(cam: Camera) => (
          <div className={estilos.barra} role="toolbar" aria-label="Zoom do mapa">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                className={`caixa botao ${cam.zoom === z ? 'botao-dourado' : 'botao-claro'}`}
                aria-pressed={cam.zoom === z}
                data-zoom={z}
                onClick={() => controle.current?.definirZoom(z)}
              >
                {z}x
              </button>
            ))}
            <button type="button" className="caixa botao botao-claro" data-grade onClick={() => controle.current?.alternarGrade()} aria-label="Grade e meta (G)">
              <Grid3x3 size={18} strokeWidth={2.5} aria-hidden="true" />
              Grade
            </button>
          </div>
        )}
      </CanvasMapa>
    </div>
  );
}
