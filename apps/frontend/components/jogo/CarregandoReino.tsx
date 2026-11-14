'use client';

// Tela de carregamento do jogo (Portão 10). No estilo do Início: fundo da
// tela, título em Alegreya SC e a fogueira animada (quadros.json).
// Só aparece se o carregamento passar de 300 ms (não pisca em conexão
// rápida); passou de 10 s, ou deu erro, vira mensagem com "Tentar de novo".

import { useEffect, useState } from 'react';
import { CARREGAMENTO } from '../../lib/jogo/config';
import { SpriteAnimado } from '../anim/SpriteAnimado';
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
        {/* Sprite 1x ampliado em inteiro pelo CSS (sem otimização de imagem). */}
        <SpriteAnimado className={estilos.fogueira} sprite={{ grupo: 'cenario', id: 'fogueira' }} lado={32} />
        <h1 className={estilos.titulo}>Cronarca</h1>
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
