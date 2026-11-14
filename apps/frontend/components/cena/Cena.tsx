import type { CSSProperties, ReactNode } from 'react';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import { PreCargaCena } from './PreCargaCena';
import { SPRITES_COM_QUADROS, temQuadros, type DadosCena, type Faixa } from './dados';
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
 * Um sprite da cena com o lado em px. Com quadros novos (quadros_cena.json),
 * o SpriteAnimado do relógio global, com a fase pelo id da instância; sem
 * eles, os dois SVGs alternados por CSS.
 */
function SpriteDaCena({ nome, lado, instancia, quadro = 1 }: { nome: string; lado: number; instancia: string; quadro?: 1 | 2 }) {
  if (temQuadros(nome)) {
    return <SpriteAnimado sprite={{ grupo: 'cena', id: nome }} lado={lado} instancia={instancia} />;
  }
  return (
    <span className={`sprite-svg${quadro === 2 ? ' comeca-no-2' : ''}`} style={{ width: lado, height: lado }}>
      <img className="quadro-1" src={`/sprites/${nome}-1.svg`} alt="" width={lado} height={lado} />
      <img className="quadro-2" src={`/sprites/${nome}-2.svg`} alt="" width={lado} height={lado} />
    </span>
  );
}

/**
 * Cenário em pixel art do Figma (frame 1440x900) com zoom inteiro por pixel
 * de sprite. O conteúdo (children) é posicionado nas coordenadas do frame.
 * Abaixo de CONSULTA_CENA_CELULAR o palco vira coluna única (globals.css):
 * o fundo e os sprites do desktop saem e entram a paisagem e a fileira do celular.
 */
export function Cena({ dados, children }: { dados: DadosCena; children?: ReactNode }) {
  const estilo: CSSProperties = {
    background: `${gradienteDaBorda(dados.esquerda)} left top / 50% 100% no-repeat, ${gradienteDaBorda(dados.direita)} right top / 50% 100% no-repeat`,
  };
  const cel = dados.celular;
  return (
    <div className={`cena cena-${dados.id}`} style={estilo}>
      <div className="cena-centro">
        <div className="cena-palco">
          <img className="cena-fundo" src={dados.fundo} alt="" width={1440} height={900} />
          {dados.sprites.map((s, i) => {
            const lado = s.canvas * PIXEL_DO_FIGMA;
            return (
              <span
                key={i}
                className={`sprite${temQuadros(s.nome) ? ' sprite-quadros' : ''}`}
                style={{ left: s.x, top: s.y, width: lado, height: lado }}
                aria-hidden="true"
              >
                <SpriteDaCena nome={s.nome} lado={lado} instancia={`${dados.id}-${s.nome}-${i}`} quadro={s.quadro} />
              </span>
            );
          })}

          {/* Só no celular: castelo sobre o mesmo fundo (a 2x ou 4x), pinheiros cortados pelas bordas. */}
          <div className="cena-celular-paisagem" style={{ height: 48 * cel.castelo }} aria-hidden="true">
            <img className="cena-celular-fundo" src={dados.fundo} alt="" />
            {cel.pinheiros > 0 && (
              <>
                <span className="cena-celular-pinheiro esq">
                  <SpriteDaCena nome="pinheiro" lado={32 * cel.pinheiros} instancia={`${dados.id}-cel-pinheiro-esq`} />
                </span>
                <span className="cena-celular-pinheiro dir">
                  <SpriteDaCena nome="pinheiro" lado={32 * cel.pinheiros} instancia={`${dados.id}-cel-pinheiro-dir`} quadro={2} />
                </span>
              </>
            )}
            <span className="cena-celular-castelo">
              <SpriteDaCena nome="castelo" lado={48 * cel.castelo} instancia={`${dados.id}-cel-castelo`} />
            </span>
          </div>
          {cel.fileira.length > 0 && (
            <div className="cena-celular-fileira" aria-hidden="true">
              {cel.fileira.map((nome) => (
                <SpriteDaCena key={nome} nome={nome} lado={32 * cel.escalaFileira} instancia={`${dados.id}-cel-${nome}`} />
              ))}
            </div>
          )}

          {children}
        </div>
      </div>
      <PreCargaCena nomes={SPRITES_COM_QUADROS} />
    </div>
  );
}
