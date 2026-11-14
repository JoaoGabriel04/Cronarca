'use client';

// Tela de carregamento do jogo (Portão 10). No estilo do Início: fundo da
// tela, o selo do relógio e o nome em pixel art (portão Logo e ícone).
// Só aparece se o carregamento passar de 300 ms (não pisca em conexão
// rápida); passou de 10 s, ou deu erro, vira mensagem com "Tentar de novo".

import { useEffect, useState } from 'react';
import { CARREGAMENTO } from '../../lib/jogo/config';
import { MARCA } from '../../lib/marca';
import estilos from './carregando.module.css';

export interface PropsCarregando {
  /** A leitura falhou (rede, servidor). */
  erro: boolean;
  aoTentarDeNovo: () => void;
}

export function CarregandoReino({ erro, aoTentarDeNovo }: PropsCarregando) {
  const [visivel, setVisivel] = useState(false);
  const [desistiu, setDesistiu] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setVisivel(false);
    setDesistiu(false);
    const mostrar = setTimeout(() => setVisivel(true), CARREGAMENTO.mostrarApósMs);
    const desistir = setTimeout(() => setDesistiu(true), CARREGAMENTO.desistirApósMs);
    return () => {
      clearTimeout(mostrar);
      clearTimeout(desistir);
    };
  }, [tentativa]);

  const falhou = erro || desistiu;
  if (!visivel && !falhou) return <main className={estilos.pagina} aria-busy="true" />;

  return (
    <main className={estilos.pagina} aria-busy={!falhou}>
      <div className={estilos.bloco}>
        {/* Selo do relógio a 4x (128 px) e o nome em pixel art a 4x (224 x 40): ampliação inteira, sem borrar. */}
        <img className={estilos.selo} src={MARCA.selo(128)} width={128} height={128} alt="" draggable={false} />
        <h1 className={estilos.titulo}>
          <img className={estilos.nome} src={MARCA.nome8x.src} width={224} height={40} alt={MARCA.nome} draggable={false} />
        </h1>
        {falhou ? (
          <>
            <p className={estilos.texto} role="alert">
              Não foi possível carregar o seu reino.
            </p>
            <button
              type="button"
              className="caixa botao"
              onClick={() => {
                setTentativa((t) => t + 1);
                aoTentarDeNovo();
              }}
            >
              Tentar de novo
            </button>
          </>
        ) : (
          <p className={estilos.texto}>Carregando seu reino...</p>
        )}
      </div>
    </main>
  );
}
