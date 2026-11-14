import type { CSSProperties, ReactNode } from 'react';
import type { DadosCena, Faixa } from './dados';
import { ALTURA_PALCO, PIXEL_DO_FIGMA } from './escala';

/** Gradiente com paradas secas que prolonga a coluna da borda da cena até a lateral da tela. */
function gradienteDaBorda(faixas: readonly Faixa[]): string {
  const topo = `(50% - var(--u) * ${ALTURA_PALCO / PIXEL_DO_FIGMA / 2})`;
  const paradas = faixas.map(([y0, y1, cor]) => {
    const a = `calc(${topo} + var(--u) * ${y0 / PIXEL_DO_FIGMA})`;
    const b = `calc(${topo} + var(--u) * ${y1 / PIXEL_DO_FIGMA})`;
    return `${cor} ${a} ${b}`;
  });
  const primeira = faixas[0]![2];
  const ultima = faixas.at(-1)![2];
  return `linear-gradient(to bottom, ${primeira} 0, ${paradas.join(', ')}, ${ultima} 100%)`;
}

/**
 * Cenário em pixel art do Figma (frame 1440x900) com zoom inteiro por pixel
 * de sprite. O conteúdo (children) é posicionado nas coordenadas do frame.
 */
export function Cena({ dados, children }: { dados: DadosCena; children?: ReactNode }) {
  const estilo: CSSProperties = {
    background: `${gradienteDaBorda(dados.esquerda)} left top / 50% 100% no-repeat, ${gradienteDaBorda(dados.direita)} right top / 50% 100% no-repeat`,
  };
  return (
    <div className="cena" style={estilo}>
      <div className="cena-centro">
        <div className="cena-palco">
          <img className="cena-fundo" src={dados.fundo} alt="" width={1440} height={900} />
          {dados.sprites.map((s, i) => {
            const lado = s.canvas * PIXEL_DO_FIGMA;
            return (
              <span
                key={i}
                className={`sprite${s.quadro === 2 ? ' comeca-no-2' : ''}`}
                style={{ left: s.x, top: s.y, width: lado, height: lado }}
                aria-hidden="true"
              >
                <img className="quadro-1" src={`/sprites/${s.nome}-1.svg`} alt="" width={lado} height={lado} />
                <img className="quadro-2" src={`/sprites/${s.nome}-2.svg`} alt="" width={lado} height={lado} />
              </span>
            );
          })}
          {children}
        </div>
      </div>
    </div>
  );
}
