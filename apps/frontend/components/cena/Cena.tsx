import type { CSSProperties, ReactNode } from 'react';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import { PreCargaCena } from './PreCargaCena';
import { ladoDaArte, SPRITES_DA_CENA, type DadosCena, type SpriteCelular, type SpriteNaCena } from './dados';

/**
 * Um sprite da cena: sempre o SpriteAnimado do relógio global (quadros e durações do
 * quadros_cena.json), com a fase pelo id da instância. O tamanho e a posição são do CSS
 * (globals.css), em pixel inteiro de tela; aqui só vão os números como variáveis:
 * --a (lado da arte), --cx e --by (centro horizontal e pé, em px do frame).
 */
function SpriteDesktop({ s, instancia }: { s: SpriteNaCena; instancia: string }) {
  const arte = ladoDaArte(s.nome);
  const lado = arte * s.k;
  const estilo = { '--a': arte, '--cx': s.x + lado / 2, '--by': s.y + lado } as CSSProperties;
  return (
    <span className={`sprite k${s.k}`} style={estilo} aria-hidden="true">
      <SpriteAnimado sprite={{ grupo: 'cena', id: s.nome }} lado={lado} instancia={instancia} />
    </span>
  );
}

/** Sprite da paisagem do celular: âncora na borda ou no centro, pé em --by, escala --m3 ou --m4 (globals.css). */
function SpriteCelularCena({ s, instancia }: { s: SpriteCelular; instancia: string }) {
  const arte = ladoDaArte(s.nome);
  const estilo = { '--a': arte, '--dx': s.dx, '--by': s.y + arte * s.k } as CSSProperties;
  return (
    <span className={`cel-sprite k${s.k} ancora-${s.ancora}`} style={estilo}>
      <SpriteAnimado sprite={{ grupo: 'cena', id: s.nome }} lado={arte * s.k} instancia={instancia} />
    </span>
  );
}

/**
 * Cenário em pixel art do Figma (frame 1440x900) com zoom inteiro por pixel
 * de sprite. O conteúdo (children) é posicionado nas coordenadas do frame.
 * Abaixo de CONSULTA_CENA_CELULAR o palco vira coluna única (globals.css):
 * o fundo e os sprites do desktop saem e entra a paisagem do celular.
 */
export function Cena({ dados, children }: { dados: DadosCena; children?: ReactNode }) {
  const cel = dados.celular;
  return (
    <div className={`cena cena-${dados.id}`}>
      <div className="cena-centro">
        <div className="cena-palco">
          <img className="cena-fundo" src={dados.fundo} alt="" width={2520} height={1260} draggable={false} />
          {dados.sprites.map((s, i) => (
            <SpriteDesktop key={i} s={s} instancia={`${dados.id}-${s.nome}-${i}`} />
          ))}

          {/* Só no celular: o fundo a 6x e os sprites ancorados nas bordas e no centro (frame de 390 do Figma). */}
          <div
            className="cena-celular-paisagem"
            style={{ height: cel.altura, marginTop: cel.margemTopo, '--fundo-y': cel.fundoY } as CSSProperties}
            aria-hidden="true"
          >
            <img className="cena-celular-fundo" src={dados.fundo} alt="" width={2520} height={1260} draggable={false} />
            {cel.sprites.map((s, i) => (
              <SpriteCelularCena key={i} s={s} instancia={`${dados.id}-cel-${s.nome}-${i}`} />
            ))}
          </div>

          {children}
        </div>
      </div>
      <PreCargaCena nomes={SPRITES_DA_CENA} />
    </div>
  );
}
